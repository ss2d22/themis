// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Covenant} from "../src/Covenant.sol";
import {KuruCodec} from "../src/libraries/KuruCodec.sol";
import {CovenantBase} from "./CovenantBase.t.sol";

contract CovenantQuotingTest is CovenantBase {
    uint256 internal id;

    function setUp() public override {
        super.setUp();
        id = open();
    }

    function test_ladderIsCompliant() public {
        quote(id, ladder());
        Covenant.Metrics memory m = covenant.metrics(id);

        assertTrue(m.compliant);
        assertEq(m.bestBid, 199_800);
        assertEq(m.bestAsk, 200_200);
        assertEq(m.spreadBps, 20);
        assertApproxEqAbs(m.bidDepth, 4 * 1998e6 + 4 * 1995e6 + 4 * 1990e6, 1);
        assertEq(m.askDepth, 24_000e6);
        assertEq(covenant.engagement(id).liveMask, (uint64(7)) | (uint64(7) << 32));
    }

    function test_creditAccruesBetweenCompliantObservations() public {
        quote(id, ladder());
        advance(100);
        covenant.poke(id);
        assertEq(covenant.engagement(id).creditedBlocks, 100);
        assertEq(covenant.vested(id), uint256(50e18) * 100 / 100_000);
    }

    function test_creditIsCappedPerObservation() public {
        quote(id, ladder());
        advance(1000);
        covenant.poke(id);
        assertEq(covenant.engagement(id).creditedBlocks, 150);
    }

    function test_noCreditUntilFirstCompliantObservation() public {
        advance(50);
        quote(id, ladder());
        assertEq(covenant.engagement(id).creditedBlocks, 0);
    }

    function test_creditSplitsAcrossEpochs() public {
        uint64 start = covenant.engagement(id).startBlock;
        vm.roll(start + 950);
        quote(id, ladder());
        advance(100);
        covenant.poke(id);
        assertEq(covenant.epochCredit(id, 0), 50);
        assertEq(covenant.epochCredit(id, 1), 50);
    }

    function test_partialFillDipEarnsNothingForInterval() public {
        quote(id, ladder());
        advance(100);
        covenant.poke(id);

        advance(20);
        book.fill(account(id), 32, 3 * ONE, taker);
        book.fill(account(id), 33, 3 * ONE, taker);
        advance(20);
        assertFalse(covenant.poke(id));
        assertEq(covenant.engagement(id).creditedBlocks, 100);
    }

    function test_breachBountyNeedsBreachToOutlastGrace() public {
        quote(id, ladder());
        advance(10);
        covenant.poke(id);

        vm.startPrank(watcher);
        book.fill(account(id), 32, 4 * ONE, taker);
        covenant.poke(id);
        assertEq(covenant.owed(watcher, address(usdc)), 0);

        advance(25);
        covenant.poke(id);
        assertEq(covenant.owed(watcher, address(usdc)), 10e6);

        advance(25);
        covenant.poke(id);
        assertEq(covenant.owed(watcher, address(usdc)), 10e6);
        vm.stopPrank();
    }

    function test_curedBreachCanBeReportedAgain() public {
        quote(id, ladder());
        book.fill(account(id), 32, 4 * ONE, taker);
        advance(1);
        covenant.poke(id);
        advance(25);
        vm.prank(watcher);
        covenant.poke(id);

        quote(id, abi.encodePacked(op(35, false, 200_300, 4 * ONE)));
        assertTrue(covenant.engagement(id).lastCompliant);
        book.fill(account(id), 33, 4 * ONE, taker);
        advance(1);
        covenant.poke(id);
        advance(25);
        vm.prank(watcher);
        covenant.poke(id);
        assertEq(covenant.owed(watcher, address(usdc)), 20e6);
    }

    function test_fullFillWithoutHookDropsSlot() public {
        quote(id, ladder());
        book.fill(account(id), 32, 4 * ONE, taker);
        advance(1);
        covenant.poke(id);
        assertEq(covenant.engagement(id).liveMask & (uint64(1) << 32), 0);
        assertEq(covenant.metrics(id).bestAsk, 200_500);
    }

    function test_onlyOperatorQuotes() public {
        vm.prank(maker);
        vm.expectRevert(Covenant.Unauthorized.selector);
        covenant.quote(id, ladder());
    }

    function test_rejectsOrdersWithoutPostOnly() public {
        bytes32 takerOrder = KuruCodec.encodeOp(KuruCodec.SlotOp(0, 0, 199_000, ONE, 0));
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(Covenant.NotPostOnly.selector, 0));
        covenant.quote(id, abi.encodePacked(takerOrder));
    }

    function test_rejectsUnknownFlags() public {
        bytes32 word = KuruCodec.encodeOp(KuruCodec.SlotOp(0, KuruCodec.FLAG_ALO | 2, 199_000, ONE, 0));
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(Covenant.NotPostOnly.selector, 0));
        covenant.quote(id, abi.encodePacked(word));
    }

    function test_rejectsReduceAfterBlock() public {
        bytes32 word = KuruCodec.encodeOp(
            KuruCodec.SlotOp(0, KuruCodec.FLAG_ALO, 201_000, 4 * ONE, uint32(block.number + 5))
        );
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(Covenant.ReduceAfterBlockNotAllowed.selector, 0));
        covenant.quote(id, abi.encodePacked(word));
    }

    function test_rejectsCheapAskOutsideBand() public {
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(Covenant.OutsidePriceBand.selector, 40, 180_000, PRICE));
        covenant.quote(id, abi.encodePacked(op(40, false, 180_000, ONE)));
    }

    function test_rejectsTouchingQuoteBeforeMinimumLife() public {
        quote(id, ladder());
        advance(1);
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(Covenant.QuoteTooYoung.selector, 0));
        covenant.quote(id, abi.encodePacked(cancelOp(0)));

        advance(2);
        quote(id, abi.encodePacked(cancelOp(0)));
        assertEq(book.getOrderId(account(id), 0), 0);
    }

    function test_rejectsAskExposureAboveSellLimit() public {
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(Covenant.SellLimitExceeded.selector, 24e18, 20e18));
        covenant.quote(
            id,
            abi.encodePacked(
                op(32, false, 200_200, 8 * ONE),
                op(33, false, 200_500, 8 * ONE),
                op(34, false, 201_000, 8 * ONE)
            )
        );
    }

    function test_sellLimitCountsAlreadySoldBase() public {
        quote(id, ladder());
        book.fill(account(id), 32, 4 * ONE, taker);
        book.fill(account(id), 33, 4 * ONE, taker);
        advance(3);
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(Covenant.SellLimitExceeded.selector, 24e18, 20e18));
        covenant.quote(id, abi.encodePacked(op(32, false, 200_200, 4 * ONE), op(33, false, 200_500, 8 * ONE)));
    }

    function test_sellLimitResetsNextWindow() public {
        quote(id, ladder());
        book.fill(account(id), 32, 4 * ONE, taker);
        book.fill(account(id), 33, 4 * ONE, taker);
        advance(10_000);
        quote(id, abi.encodePacked(op(32, false, 200_200, 4 * ONE), op(33, false, 200_500, 8 * ONE)));
        assertEq(covenant.netSold(id), 0);
    }

    function test_crossingQuoteIsSkippedAndNotCounted() public {
        book.setExternalQuotes(199_000, 200_100);
        vm.expectEmit(true, false, false, true, address(covenant));
        emit Covenant.QuoteSkipped(id, 0);
        quote(id, abi.encodePacked(op(0, true, 200_100, ONE)));
        assertEq(covenant.engagement(id).liveMask, 0);
    }

    function test_outOfBandQuotesDoNotCountAsDepth() public {
        quote(
            id,
            abi.encodePacked(
                op(0, true, 199_800, ONE),
                op(1, true, 192_000, 20 * ONE),
                op(32, false, 200_200, ONE),
                op(33, false, 208_000, 9 * ONE)
            )
        );
        Covenant.Metrics memory m = covenant.metrics(id);
        assertEq(m.bidDepth, 1998e6);
        assertEq(m.askDepth, 2000e6);
        assertFalse(m.compliant);
    }

    function test_wideSpreadIsNotCompliant() public {
        quote(id, abi.encodePacked(op(0, true, 198_000, 12 * ONE), op(32, false, 202_000, 12 * ONE)));
        Covenant.Metrics memory m = covenant.metrics(id);
        assertEq(m.spreadBps, 200);
        assertFalse(m.compliant);
    }

    function test_pausedMarketSuspendsObligations() public {
        book.setMarketState(1);
        Covenant.Metrics memory m = covenant.metrics(id);
        assertTrue(m.compliant);
        assertTrue(m.suspended);
    }

    function test_referenceMovesAtBoundedSpeed() public {
        book.setExternalQuotes(219_000, 221_000);
        advance(4);
        covenant.poke(id);
        // 5 bps per block over 4 blocks
        assertEq(covenant.engagement(id).refPrice, 200_400);
        assertTrue(covenant.engagement(id).volatile);
    }

    function test_quotingClosedAfterTerm() public {
        advance(100_000);
        vm.prank(operator);
        vm.expectRevert(Covenant.TermEnded.selector);
        covenant.quote(id, ladder());
    }
}
