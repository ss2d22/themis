// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {Covenant} from "../../src/Covenant.sol";
import {IKuruOrderBook} from "../../src/interfaces/kuru/IKuruOrderBook.sol";
import {IPriceSource} from "../../src/interfaces/IPriceSource.sol";
import {KuruCodec} from "../../src/libraries/KuruCodec.sol";
import {KuruTestnet} from "./KuruTestnet.sol";
import {AccountProbe} from "./KuruAccountProbe.t.sol";

/// @dev Runs the escrow against the live Kuru WETH/USDC market on a testnet fork.
contract CovenantForkTest is Test {
    IKuruOrderBook internal book = KuruTestnet.WETH_USDC;
    Covenant internal covenant;
    AccountProbe internal taker;

    address internal issuer = makeAddr("issuer");
    address internal maker = makeAddr("maker");
    address internal operator = makeAddr("operator");

    uint32 internal mid;
    uint96 internal constant ONE = 1e10;

    function setUp() public {
        vm.createSelectFork(vm.rpcUrl("monad_testnet"));
        covenant = new Covenant(KuruTestnet.ACCOUNT_CORE);

        (uint32 bid, uint32 ask) = book.bestBidAsk();
        mid = (bid + ask) / 2;

        deal(KuruTestnet.WETH, issuer, 100e18);
        deal(KuruTestnet.USDC, issuer, 1_000_000e6);
        deal(KuruTestnet.USDC, maker, 1_000_000e6);
        vm.prank(issuer);
        IERC20(KuruTestnet.WETH).approve(address(covenant), type(uint256).max);
        vm.prank(issuer);
        IERC20(KuruTestnet.USDC).approve(address(covenant), type(uint256).max);
        vm.prank(maker);
        IERC20(KuruTestnet.USDC).approve(address(covenant), type(uint256).max);

        taker = new AccountProbe(KuruTestnet.ACCOUNT_CORE, book);
        deal(KuruTestnet.WETH, address(taker), 10e18);
        deal(KuruTestnet.USDC, address(taker), 100_000e6);
        taker.open(10e18, 100_000e6);
    }

    function terms() internal view returns (Covenant.Terms memory t) {
        t.market = book;
        t.maker = maker;
        t.loan = 10e18;
        t.makerCollateral = 50_000e6;
        t.bond = 1000e6;
        t.options = 5e18;
        t.retainer = 3000e6;
        t.strike = mid * 105 / 100;
        t.initialPrice = mid;
        t.termBlocks = 600;
        t.noticeBlocks = 100;
        t.exerciseWindowBlocks = 50;
        t.ob = Covenant.Obligations({
            maxSpreadBps: 100,
            depthBandBps: 200,
            uptimeTargetBps: 9000,
            sustainedBreachEpochs: 3,
            volatileSpreadBps: 300,
            volatilityTriggerBps: 300,
            epochBlocks: 100,
            maxCreditBlocks: 150,
            minQuoteLifeBlocks: 3,
            graceBlocks: 10,
            minBidDepth: 5000e6,
            minAskDepth: 5000e6
        });
        t.risk = Covenant.Risk({
            priceBandBps: 500,
            maxRefStepBps: 5,
            penaltyBps: 1000,
            breachSlashBps: 5000,
            sellWindowBlocks: 1000,
            backstopLockBlocks: 100,
            maxNetSell: 5e18,
            watchBounty: 5e6,
            clawbackBounty: 25e6,
            priceSource: IPriceSource(address(0)),
            maxPriceAge: 0
        });
    }

    function open() internal returns (uint256 id) {
        vm.prank(issuer);
        id = covenant.propose(terms());
        vm.prank(maker);
        covenant.accept(id, operator);
    }

    function op(uint8 slot, bool isBuy, uint32 price, uint96 size) internal pure returns (bytes32) {
        uint8 flags = KuruCodec.FLAG_ALO | (isBuy ? KuruCodec.FLAG_BUY : 0);
        return KuruCodec.encodeOp(KuruCodec.SlotOp(slot, flags, price, size, 0));
    }

    function ladder() internal view returns (bytes memory) {
        return abi.encodePacked(
            op(0, true, mid - 50, ONE),
            op(1, true, mid - 150, ONE),
            op(2, true, mid - 300, ONE),
            op(32, false, mid + 50, ONE),
            op(33, false, mid + 150, ONE),
            op(34, false, mid + 300, ONE)
        );
    }

    function test_quotesLiveOnKuru() public {
        uint256 id = open();
        uint40 account = covenant.engagement(id).account;

        vm.prank(operator);
        covenant.quote(id, ladder());

        (uint32 bid, uint32 ask) = book.bestBidAsk();
        assertEq(bid, mid - 50);
        assertEq(ask, mid + 50);
        assertGt(book.getOrderId(account, 0), 0);

        Covenant.Metrics memory m = covenant.metrics(id);
        assertTrue(m.compliant);
        assertGt(m.bidDepth, 5000e6);
        assertGt(m.askDepth, 5000e6);
    }

    function test_takerFillRunsHookAndReplenishes() public {
        uint256 id = open();
        uint40 account = covenant.engagement(id).account;
        vm.prank(KuruTestnet.GOVERNANCE);
        KuruTestnet.ACCOUNT_CORE.setPostFillHookAccess(account, true);
        covenant.enableHook(id);
        vm.prank(maker);
        covenant.setRefreshPolicy(id, true, 20);

        vm.prank(operator);
        covenant.quote(id, ladder());
        uint64 before = book.getOrderId(account, 32);

        taker.swap(true, 2700e6);

        uint64 replenished = book.getOrderId(account, 32);
        assertGt(replenished, 0);
        assertTrue(replenished != before);
        assertEq(covenant.slot(id, 32).price, mid + 70);
    }

    function test_marketSellIsImpossible() public {
        uint256 id = open();
        bytes32 ioc = KuruCodec.encodeOp(KuruCodec.SlotOp(40, 0, mid - 1000, 5 * ONE, 0));
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(Covenant.NotPostOnly.selector, 40));
        covenant.quote(id, abi.encodePacked(ioc));
    }

    function test_clawbackMintsPassiveBand() public {
        uint256 id = open();
        uint64 start = covenant.engagement(id).startBlock;
        for (uint64 epoch; epoch < 3; ++epoch) {
            vm.roll(start + (epoch + 1) * 100);
            covenant.closeEpoch(id);
        }
        covenant.clawback(id);

        Covenant.Engagement memory e = covenant.engagement(id);
        assertGt(e.backstopPosition, 0, "no passive position");
        IKuruOrderBook.PassivePositionView memory p = book.getPassivePosition(e.backstopPosition);
        assertEq(p.ownerId, e.account);
        assertGt(p.shares, 0);
        emit log_named_uint("band low", p.lowPrice);
        emit log_named_uint("band high", p.highPrice);
    }

    function test_honestTermSettles() public {
        uint256 id = open();
        uint64 start = covenant.engagement(id).startBlock;
        vm.prank(operator);
        covenant.quote(id, ladder());
        for (uint64 b = start + 100; b <= start + 600; b += 100) {
            vm.roll(b);
            covenant.poke(id);
        }
        vm.prank(maker);
        covenant.settle(id, 0);

        assertEq(covenant.vested(id), 5e18);
        assertEq(covenant.kuruOwed(issuer, KuruTestnet.WETH), 10e18);

        vm.prank(issuer);
        covenant.claim(KuruTestnet.WETH);
        assertEq(IERC20(KuruTestnet.WETH).balanceOf(issuer), 100e18);
    }
}
