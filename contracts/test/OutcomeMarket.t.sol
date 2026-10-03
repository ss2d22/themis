// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {OutcomeMarket} from "../src/outcome/OutcomeMarket.sol";
import {OutcomeToken} from "../src/outcome/OutcomeToken.sol";
import {CovenantBase} from "./CovenantBase.t.sol";

contract OutcomeMarketTest is CovenantBase {
    OutcomeMarket internal outcomes;
    uint256 internal id;
    uint64 internal start;
    address internal hedger = makeAddr("hedger");

    function setUp() public override {
        super.setUp();
        outcomes = new OutcomeMarket(covenant);
        id = open();
        start = covenant.engagement(id).startBlock;
        usdc.mint(hedger, 10_000e6);
        vm.prank(hedger);
        usdc.approve(address(outcomes), type(uint256).max);
    }

    function quoteThrough(uint64 until) internal {
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

    function test_createNamesTokensByPeriod() public {
        uint256 m = outcomes.create(id, 0, 2);
        OutcomeMarket.Market memory mk = outcomes.market(m);
        assertEq(mk.kept.symbol(), "KEPT-1-E0+2");
        assertEq(mk.broken.symbol(), "BROKEN-1-E0+2");
        assertEq(mk.kept.decimals(), 6);
    }

    function test_cannotCreateDuplicateOrPastPeriods() public {
        outcomes.create(id, 0, 2);
        vm.expectRevert(OutcomeMarket.AlreadyExists.selector);
        outcomes.create(id, 0, 2);

        vm.roll(start + 2000);
        vm.expectRevert(OutcomeMarket.InvalidRange.selector);
        outcomes.create(id, 1, 1);
    }

    function test_setIsFullyCollateralised() public {
        uint256 m = outcomes.create(id, 0, 2);
        vm.startPrank(hedger);
        outcomes.mintSet(m, 1000e6);
        assertEq(usdc.balanceOf(address(outcomes)), 1000e6);
        outcomes.redeemSet(m, 400e6);
        vm.stopPrank();
        assertEq(usdc.balanceOf(hedger), 9400e6);
        assertEq(outcomes.market(m).kept.balanceOf(hedger), 600e6);
    }

    function test_resolvesKeptFromLedger() public {
        uint256 m = outcomes.create(id, 0, 2);
        vm.prank(hedger);
        outcomes.mintSet(m, 1000e6);

        quoteThrough(start + 2000);
        outcomes.resolve(m);
        assertEq(uint8(outcomes.market(m).outcome), uint8(OutcomeMarket.Outcome.Kept));

        vm.prank(hedger);
        outcomes.redeem(m, 1000e6);
        assertEq(usdc.balanceOf(hedger), 10_000e6);

        OutcomeToken broken = outcomes.market(m).broken;
        vm.prank(hedger);
        vm.expectRevert();
        outcomes.redeem(m, 1);
        assertEq(broken.balanceOf(hedger), 1000e6);
    }

    function test_resolvesBrokenWhenUptimeMissed() public {
        uint256 m = outcomes.create(id, 0, 2);
        vm.roll(start + 1000);
        quoteThrough(start + 2000);
        outcomes.resolve(m);
        assertEq(uint8(outcomes.market(m).outcome), uint8(OutcomeMarket.Outcome.Broken));
    }

    function test_resolveObservesStaleLedger() public {
        uint256 m = outcomes.create(id, 0, 1);
        quote(id, ladder());
        vm.roll(start + 1000);
        outcomes.resolve(m);
        // Only one capped interval was observable, so the period cannot be proven kept.
        assertEq(uint8(outcomes.market(m).outcome), uint8(OutcomeMarket.Outcome.Broken));
        assertEq(covenant.engagement(id).lastObsBlock, start + 1000);
    }

    function test_cannotResolveEarly() public {
        uint256 m = outcomes.create(id, 0, 1);
        vm.roll(start + 999);
        vm.expectRevert(OutcomeMarket.PeriodNotOver.selector);
        outcomes.resolve(m);
    }
}
