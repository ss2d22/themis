// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {IKuruAccountCore} from "../../src/interfaces/kuru/IKuruAccountCore.sol";
import {IKuruOrderBook} from "../../src/interfaces/kuru/IKuruOrderBook.sol";
import {KuruCodec} from "../../src/libraries/KuruCodec.sol";
import {KuruTestnet} from "./KuruTestnet.sol";

/// @dev Contract-owned Kuru account, the shape the escrow relies on.
contract AccountProbe {
    IKuruAccountCore internal immutable core;
    IKuruOrderBook internal immutable book;
    uint40 public rootId;
    uint40 public subId;

    constructor(IKuruAccountCore core_, IKuruOrderBook book_) {
        core = core_;
        book = book_;
    }

    function open(uint256 baseAmount, uint256 quoteAmount) external {
        address base = book.baseToken();
        address quote = book.quoteToken();
        IERC20(base).approve(address(core), baseAmount);
        IERC20(quote).approve(address(core), quoteAmount);
        core.deposit(address(this), base, baseAmount);
        core.deposit(address(this), quote, quoteAmount);
        rootId = core.rootAccountIdOf(address(this));
        subId = core.createSubaccount(address(this));
        core.transferBetweenAccounts(rootId, subId, base, baseAmount);
        core.transferBetweenAccounts(rootId, subId, quote, quoteAmount);
    }

    function replace(bytes calldata ops) external {
        book.replaceBySlotPacked(subId, ops);
    }

    function batch(IKuruOrderBook.NativeOrder[] calldata orders, uint8[] calldata cancels) external {
        book.batch(subId, orders, cancels);
    }

    function setHook(address hook) external {
        book.setPostFillHook(subId, hook);
    }

    function swap(bool isBuy, uint128 amountIn) external returns (uint128, uint128) {
        return book.swap(subId, isBuy, amountIn, 0, uint64(block.timestamp + 60));
    }
}

contract KuruAccountProbeTest is Test {
    IKuruOrderBook internal book = KuruTestnet.WETH_USDC;
    IKuruAccountCore internal core = KuruTestnet.ACCOUNT_CORE;
    AccountProbe internal probe;

    uint32 internal bid;
    uint32 internal ask;

    function setUp() public {
        vm.createSelectFork(vm.rpcUrl("monad_testnet"));
        probe = new AccountProbe(core, book);
        deal(KuruTestnet.WETH, address(probe), 10e18);
        deal(KuruTestnet.USDC, address(probe), 100_000e6);
        probe.open(10e18, 100_000e6);
        (bid, ask) = book.bestBidAsk();
    }

    function test_contractRootOwnsSubaccount() public view {
        assertGt(probe.rootId(), 0);
        assertGt(probe.subId(), 0);
        assertEq(core.getAccountRootId(probe.subId()), probe.rootId());
        assertEq(core.getBalance(probe.subId(), KuruTestnet.WETH), 10e18);
    }

    function test_packedReplacePlacesIntoChosenSlots() public {
        uint32 tick = book.tickSize();
        uint32 bidPx = bid - 100 * tick;
        uint32 askPx = ask + 100 * tick;

        bytes memory ops = abi.encodePacked(
            KuruCodec.encodeOp(KuruCodec.SlotOp(7, KuruCodec.FLAG_BUY | KuruCodec.FLAG_ALO, bidPx, 1e9, 0)),
            KuruCodec.encodeOp(KuruCodec.SlotOp(40, KuruCodec.FLAG_ALO, askPx, 1e9, 0))
        );
        probe.replace(ops);

        assertGt(book.getOrderId(probe.subId(), 7), 0, "bid slot");
        assertGt(book.getOrderId(probe.subId(), 40), 0, "ask slot");
        assertEq(book.getOrderId(probe.subId(), 0), 0, "untouched slot");

        (uint256 baseReserved, uint256 quoteReserved) = book.makerLockedReserves(probe.subId());
        emit log_named_uint("baseReserved", baseReserved);
        emit log_named_uint("quoteReserved", quoteReserved);
        emit log_named_uint("spotReservedBase", core.getSpotReservedBalance(probe.subId(), KuruTestnet.WETH));
        assertGt(baseReserved, 0);
        assertGt(quoteReserved, 0);

        probe.replace(abi.encodePacked(KuruCodec.encodeOp(KuruCodec.SlotOp(7, 0, 0, 0, 0))));
        assertEq(book.getOrderId(probe.subId(), 7), 0, "cancelled");
    }

    function test_crossingPostOnlyIsSkipped() public {
        bytes memory ops =
            abi.encodePacked(KuruCodec.encodeOp(KuruCodec.SlotOp(3, KuruCodec.FLAG_ALO, bid, 1e9, 0)));
        probe.replace(ops);
        assertEq(book.getOrderId(probe.subId(), 3), 0);
    }
}
