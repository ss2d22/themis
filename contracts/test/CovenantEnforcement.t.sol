// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Vm} from "forge-std/Vm.sol";
import {Covenant} from "../src/Covenant.sol";
import {IPostFillHook} from "../src/interfaces/kuru/IPostFillHook.sol";
import {Settlement} from "../src/libraries/Settlement.sol";
import {CovenantBase} from "./CovenantBase.t.sol";

contract CovenantEnforcementTest is CovenantBase {
    uint256 internal id;
    uint64 internal start;

    function setUp() public override {
        super.setUp();
        id = open();
        start = covenant.engagement(id).startBlock;
    }

    /// @dev Keeps the ladder up and observes at the credit cap until `until`.
    function quoteHonestly(uint64 until) internal {
        vm.pauseGasMetering();
        quote(id, ladder());
        while (vm.getBlockNumber() + 150 <= until) {
            advance(150);
            covenant.poke(id);
        }
        vm.roll(until);
        covenant.poke(id);
        vm.resumeGasMetering();
    }

    function test_epochPassesWhenUptimeMet() public {
        quoteHonestly(start + 1000);
        covenant.closeEpoch(id);
        Covenant.Engagement memory e = covenant.engagement(id);
        assertEq(e.nextEpoch, 1);
        assertEq(e.failingStreak, 0);
        assertEq(covenant.epochCredit(id, 0), 1000);
    }

    function test_epochCannotCloseEarly() public {
        vm.roll(start + 999);
        vm.expectRevert(Covenant.EpochNotOver.selector);
        covenant.closeEpoch(id);
    }

    function test_sustainedBreachMakesEngagementClawable() public {
        for (uint64 epoch; epoch < 3; ++epoch) {
            vm.roll(start + (epoch + 1) * 1000);
            vm.prank(watcher);
            covenant.closeEpoch(id);
        }
        Covenant.Engagement memory e = covenant.engagement(id);
        assertEq(uint8(e.status), uint8(Covenant.Status.ClawbackEligible));
        assertEq(e.failingStreak, 3);
        assertEq(covenant.owed(watcher, address(usdc)), 30e6);
        (,,, uint32 failedEpochs,,) = covenant.makerStats(maker);
        assertEq(failedEpochs, 3);
    }

    function test_passingEpochResetsStreak() public {
        vm.roll(start + 1000);
        covenant.closeEpoch(id);
        vm.roll(start + 1000);
        quoteHonestly(start + 2000);
        covenant.closeEpoch(id);
        assertEq(covenant.engagement(id).failingStreak, 0);
    }

    function test_clawbackSendsLoanToPassiveBand() public {
        quote(id, ladder());
        book.fill(account(id), 32, 4 * ONE, taker);
        for (uint64 epoch; epoch < 3; ++epoch) {
            vm.roll(start + (epoch + 1) * 1000);
            vm.prank(watcher);
            covenant.closeEpoch(id);
        }

        vm.prank(watcher);
        covenant.clawback(id);

        Covenant.Engagement memory e = covenant.engagement(id);
        assertEq(uint8(e.status), uint8(Covenant.Status.ClawedBack));
        assertGt(e.backstopPosition, 0);
        assertEq(book.getOrderId(e.account, 0), 0);

        // 4 base were sold. No options vested, so the shortfall is charged at strike +10%.
        uint256 penaltyQuote = 4 * 2310e6;
        assertEq(core.getBalance(e.account, address(base)), 0);
        assertEq(core.getBalance(e.account, address(usdc)), 0);
        assertEq(covenant.kuruOwed(maker, address(usdc)), 200_000e6 + 4 * 2002e6 - penaltyQuote);

        uint256 bondAfterBounties = 10_000e6 - 30e6;
        uint256 slash = bondAfterBounties / 2;
        assertEq(covenant.owed(issuer, address(usdc)), slash + 30_000e6);
        assertEq(covenant.owed(watcher, address(usdc)), 30e6 + 100e6);
        assertEq(covenant.owed(maker, address(usdc)), bondAfterBounties - slash - 100e6);
    }

    function test_issuerReleasesBackstopAfterLock() public {
        for (uint64 epoch; epoch < 3; ++epoch) {
            vm.roll(start + (epoch + 1) * 1000);
            covenant.closeEpoch(id);
        }
        covenant.clawback(id);

        vm.prank(issuer);
        vm.expectRevert(Covenant.BackstopLocked.selector);
        covenant.releaseBackstop(id);

        advance(1000);
        vm.prank(issuer);
        covenant.releaseBackstop(id);
        assertEq(covenant.kuruOwed(issuer, address(base)), 100e18);

        vm.prank(issuer);
        covenant.claim(address(base));
        assertEq(base.balanceOf(issuer), 1000e18);
    }

    function test_settleReturnsLoanAndPaysVesting() public {
        quoteHonestly(start + 100_000);
        vm.prank(maker);
        covenant.settle(id, 0);

        Covenant.Engagement memory e = covenant.engagement(id);
        assertEq(uint8(e.status), uint8(Covenant.Status.Settled));
        assertEq(covenant.kuruOwed(issuer, address(base)), 100e18);
        assertEq(covenant.kuruOwed(maker, address(usdc)), 200_000e6);
        assertEq(covenant.owed(maker, address(usdc)), 10_000e6 + 30_000e6);
        assertEq(covenant.vested(id), 50e18);
    }

    function test_settleChargesShortfallAtStrikeThenPenalty() public {
        quote(id, ladder());
        book.fill(account(id), 32, 4 * ONE, taker);
        book.fill(account(id), 33, 4 * ONE, taker);
        vm.roll(start + 2000);
        quoteHonestly(start + 100_000);
        vm.recordLogs();
        vm.prank(maker);
        covenant.settle(id, 0);

        Settlement.Output memory r = _settledResult();
        assertEq(r.shortfall, 8e18);
        assertEq(r.exercised, 8e18);
        assertEq(covenant.kuruOwed(issuer, address(usdc)), 8 * 2100e6);
    }

    function test_makerExercisesExtraDuringWindow() public {
        quoteHonestly(start + 100_000);
        vm.prank(maker);
        covenant.settle(id, 10e18);
        assertEq(covenant.kuruOwed(maker, address(base)), 10e18);
        assertEq(covenant.kuruOwed(issuer, address(base)), 90e18);
        assertEq(covenant.kuruOwed(issuer, address(usdc)), 10 * 2100e6);
    }

    function test_onlyMakerSettlesDuringExerciseWindow() public {
        vm.roll(start + 100_000);
        vm.prank(watcher);
        vm.expectRevert(Covenant.Unauthorized.selector);
        covenant.settle(id, 0);

        vm.roll(start + 101_000);
        vm.prank(watcher);
        covenant.settle(id, 50e18);
        assertEq(covenant.kuruOwed(maker, address(base)), 0);
    }

    function test_hookReplenishesFilledQuote() public {
        core.setPostFillHookAccess(account(id), true);
        covenant.enableHook(id);
        vm.prank(maker);
        covenant.setRefreshPolicy(id, true, 50);
        quote(id, ladder());

        book.fill(account(id), 32, 4 * ONE, taker);

        assertGt(book.getOrderId(account(id), 32), 0);
        assertEq(covenant.slot(id, 32).price, 200_250);
        advance(1);
        assertTrue(covenant.poke(id));
    }

    function test_hookRespectsSellLimit() public {
        core.setPostFillHookAccess(account(id), true);
        covenant.enableHook(id);
        vm.prank(maker);
        covenant.setRefreshPolicy(id, true, 50);
        quote(id, ladder());

        book.fill(account(id), 32, 4 * ONE, taker);
        book.fill(account(id), 32, 4 * ONE, taker);
        book.fill(account(id), 32, 4 * ONE, taker);

        assertEq(book.getOrderId(account(id), 32), 0);
    }

    function test_hookOnlyFromMarket() public {
        Covenant.Engagement memory e = covenant.engagement(id);
        vm.expectRevert(Covenant.Unauthorized.selector);
        covenant.postFill(
            IPostFillHook.PostFillContext(e.account, 32, 1, 0, 200_200, 4 * ONE, 0, 0, 0, false)
        );
    }

    function test_retainerStreamsWithCompliance() public {
        quoteHonestly(start + 10_000);
        vm.prank(maker);
        covenant.claimRetainer(id);
        assertEq(usdc.balanceOf(maker), 1_000_000e6 - 210_000e6 + 3000e6);
    }

    function test_claimPaysLocalWhenKuruWithdrawalIsBlocked() public {
        quoteHonestly(start + 100_000);
        vm.prank(maker);
        covenant.settle(id, 0);

        core.setWithdrawalsFrozen(true);
        uint256 before = usdc.balanceOf(maker);
        vm.prank(maker);
        covenant.claim(address(usdc));
        assertEq(usdc.balanceOf(maker) - before, 10_000e6 + 30_000e6);
        assertEq(covenant.kuruOwed(maker, address(usdc)), 200_000e6);

        core.setWithdrawalsFrozen(false);
        vm.prank(maker);
        covenant.claimKuru(address(usdc), 50_000e6);
        assertEq(covenant.kuruOwed(maker, address(usdc)), 150_000e6);
        vm.prank(maker);
        covenant.claim(address(usdc));
        assertEq(covenant.kuruOwed(maker, address(usdc)), 0);
    }

    function test_claimRevertsWhenOnlyBlockedFundsAreOwed() public {
        quoteHonestly(start + 100_000);
        vm.prank(maker);
        covenant.settle(id, 0);
        core.setWithdrawalsFrozen(true);
        vm.prank(issuer);
        vm.expectRevert(Covenant.KuruWithdrawalBlocked.selector);
        covenant.claim(address(base));
    }

    function _settledResult() internal view returns (Settlement.Output memory) {
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i = logs.length; i > 0; --i) {
            if (logs[i - 1].topics[0] == Covenant.Settled.selector) {
                return abi.decode(logs[i - 1].data, (Settlement.Output));
            }
        }
        revert("no settlement");
    }
}
