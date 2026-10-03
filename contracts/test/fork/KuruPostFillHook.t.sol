// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {IKuruAccountCore} from "../../src/interfaces/kuru/IKuruAccountCore.sol";
import {IKuruOrderBook} from "../../src/interfaces/kuru/IKuruOrderBook.sol";
import {IPostFillHook} from "../../src/interfaces/kuru/IPostFillHook.sol";
import {KuruCodec} from "../../src/libraries/KuruCodec.sol";
import {KuruTestnet} from "./KuruTestnet.sol";
import {AccountProbe} from "./KuruAccountProbe.t.sol";

contract ReplenishingHook is IPostFillHook {
    uint256 public calls;
    PostFillContext public last;

    function postFill(PostFillContext calldata ctx) external returns (uint256, uint256, uint256) {
        calls++;
        last = ctx;
        return (KuruCodec.HOOK_REPLENISH_ONLY, KuruCodec.packHookQuote(ctx.fillPrice + 10, ctx.filledSize), 0);
    }
}

contract KuruPostFillHookTest is Test {
    IKuruOrderBook internal book = KuruTestnet.WETH_USDC;
    IKuruAccountCore internal core = KuruTestnet.ACCOUNT_CORE;

    AccountProbe internal maker;
    AccountProbe internal taker;
    ReplenishingHook internal hook;

    function setUp() public {
        vm.createSelectFork(vm.rpcUrl("monad_testnet"));
        maker = new AccountProbe(core, book);
        taker = new AccountProbe(core, book);
        deal(KuruTestnet.WETH, address(maker), 1e18);
        deal(KuruTestnet.USDC, address(maker), 10_000e6);
        deal(KuruTestnet.WETH, address(taker), 1e18);
        deal(KuruTestnet.USDC, address(taker), 10_000e6);
        maker.open(1e18, 10_000e6);
        taker.open(1e18, 10_000e6);

        hook = new ReplenishingHook();
        uint40 makerAccount = maker.subId();
        vm.prank(KuruTestnet.GOVERNANCE);
        core.setPostFillHookAccess(makerAccount, true);
        maker.setHook(address(hook));
    }

    function test_fullFillInvokesHookAndReplenishes() public {
        (uint32 bid, uint32 ask) = book.bestBidAsk();
        uint32 px = ask - book.tickSize();
        assertGt(px, bid, "spread too tight for an inside quote");

        uint8 slot = 5;
        maker.replace(
            abi.encodePacked(KuruCodec.encodeOp(KuruCodec.SlotOp(slot, KuruCodec.FLAG_ALO, px, 1e8, 0)))
        );
        uint64 placedId = book.getOrderId(maker.subId(), slot);
        assertGt(placedId, 0);

        taker.swap(true, 30e6);

        assertEq(hook.calls(), 1, "hook not called");
        (uint40 userId, uint8 filledSlot,,, uint32 fillPrice, uint96 filledSize,,,,) = hook.last();
        assertEq(userId, maker.subId());
        assertEq(filledSlot, slot);
        assertEq(fillPrice, px);
        assertEq(filledSize, 1e8);

        uint64 refreshedId = book.getOrderId(maker.subId(), slot);
        assertGt(refreshedId, 0, "slot not replenished");
        assertTrue(refreshedId != placedId);
    }
}
