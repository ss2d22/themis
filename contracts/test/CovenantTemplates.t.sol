// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Covenant} from "../src/Covenant.sol";
import {CovenantBase} from "./CovenantBase.t.sol";

contract CovenantBuybackTest is CovenantBase {
    uint256 internal id;

    function buybackTerms() internal view returns (Covenant.Terms memory t) {
        t = defaultTerms();
        t.template = Covenant.Template.Buyback;
        t.loan = 50_000e6; // quote budget
        t.options = 0;
        t.makerCollateral = 0;
        t.ob.minAskDepth = 0;
        t.ob.minBidDepth = 10_000e6;
        t.risk.maxNetSell = 10e18; // max base bought per window
    }

    function setUp() public override {
        super.setUp();
        id = open(buybackTerms());
    }

    function test_budgetMovesOntoKuruAsQuote() public view {
        Covenant.Engagement memory e = covenant.engagement(id);
        assertEq(core.getBalance(e.account, address(usdc)), 50_000e6);
        assertEq(core.getBalance(e.account, address(base)), 0);
    }

    function test_onlyBidsAreAllowed() public {
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(Covenant.SideNotAllowed.selector, 32));
        covenant.quote(id, abi.encodePacked(op(32, false, 200_200, ONE)));
    }

    function test_compliantWithBidDepthAlone() public {
        quote(id, abi.encodePacked(op(0, true, 199_800, 3 * ONE), op(1, true, 199_500, 3 * ONE)));
        Covenant.Metrics memory m = covenant.metrics(id);
        assertTrue(m.compliant);
        assertEq(m.bestAsk, 0);
    }

    function test_buyPaceIsCapped() public {
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(Covenant.SellLimitExceeded.selector, 12e18, 10e18));
        covenant.quote(id, abi.encodePacked(op(0, true, 199_800, 6 * ONE), op(1, true, 199_500, 6 * ONE)));

        quote(id, abi.encodePacked(op(0, true, 199_800, 4 * ONE)));
        book.fill(account(id), 0, 4 * ONE, taker);
        advance(3);
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(Covenant.SellLimitExceeded.selector, 11e18, 10e18));
        covenant.quote(id, abi.encodePacked(op(0, true, 199_800, 7 * ONE)));
        assertEq(covenant.netBought(id), 4e18);
    }

    function test_settlementGivesIssuerTokensAndUnspentBudget() public {
        quote(id, abi.encodePacked(op(0, true, 199_800, 4 * ONE)));
        book.fill(account(id), 0, 4 * ONE, taker);
        vm.roll(covenant.engagement(id).endBlock);
        vm.prank(maker);
        covenant.settle(id, 0);

        assertEq(covenant.kuruOwed(issuer, address(base)), 4e18);
        assertEq(covenant.kuruOwed(issuer, address(usdc)), 50_000e6 - 4 * 1998e6);
        assertEq(covenant.kuruOwed(maker, address(base)), 0);
        assertEq(covenant.owed(maker, address(usdc)), 10_000e6);
    }

    function test_cancelReturnsBudgetInQuote() public {
        vm.prank(issuer);
        uint256 pending = covenant.propose(buybackTerms());
        vm.prank(issuer);
        covenant.cancel(pending);
        assertEq(covenant.owed(issuer, address(usdc)), 50_000e6 + 30_000e6);
    }

    function test_rejectsOptionsOrCollateral() public {
        Covenant.Terms memory t = buybackTerms();
        t.options = 1;
        vm.prank(issuer);
        vm.expectRevert(Covenant.InvalidTerms.selector);
        covenant.propose(t);
    }
}

contract CovenantDistributionTest is CovenantBase {
    uint256 internal id;

    function distributionTerms() internal view returns (Covenant.Terms memory t) {
        t = defaultTerms();
        t.template = Covenant.Template.Distribution;
        t.options = 0;
        t.makerCollateral = 0;
        t.ob.minBidDepth = 0;
        t.ob.minAskDepth = 10_000e6;
        t.risk.maxNetSell = 10e18;
    }

    function setUp() public override {
        super.setUp();
        id = open(distributionTerms());
    }

    function test_onlyAsksAreAllowed() public {
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(Covenant.SideNotAllowed.selector, 0));
        covenant.quote(id, abi.encodePacked(op(0, true, 199_800, ONE)));
    }

    function test_compliantWithAskDepthAlone() public {
        quote(id, abi.encodePacked(op(32, false, 200_200, 6 * ONE)));
        assertTrue(covenant.metrics(id).compliant);
    }

    function test_sellPaceIsCapped() public {
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(Covenant.SellLimitExceeded.selector, 12e18, 10e18));
        covenant.quote(id, abi.encodePacked(op(32, false, 200_200, 12 * ONE)));
    }

    function test_noBackstopOnClawback() public {
        uint64 start = covenant.engagement(id).startBlock;
        for (uint64 epoch; epoch < 3; ++epoch) {
            vm.roll(start + (epoch + 1) * 1000);
            covenant.closeEpoch(id);
        }
        covenant.clawback(id);
        assertEq(covenant.engagement(id).backstopPosition, 0);
        assertEq(covenant.kuruOwed(issuer, address(base)), 100e18);
    }

    function test_settlementGivesIssuerProceeds() public {
        quote(id, abi.encodePacked(op(32, false, 200_200, 6 * ONE)));
        book.fill(account(id), 32, 6 * ONE, taker);
        vm.roll(covenant.engagement(id).endBlock);
        vm.prank(maker);
        covenant.settle(id, 0);

        assertEq(covenant.kuruOwed(issuer, address(base)), 94e18);
        assertEq(covenant.kuruOwed(issuer, address(usdc)), 6 * 2002e6);
    }
}
