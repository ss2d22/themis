// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Covenant} from "../src/Covenant.sol";
import {IKuruOrderBook} from "../src/interfaces/kuru/IKuruOrderBook.sol";
import {CovenantBase} from "./CovenantBase.t.sol";

contract CovenantLifecycleTest is CovenantBase {
    function test_proposeEscrowsLoanAndRetainer() public {
        vm.prank(issuer);
        uint256 id = covenant.propose(defaultTerms());

        assertEq(base.balanceOf(address(covenant)), 100e18);
        assertEq(usdc.balanceOf(address(covenant)), 30_000e6);
        assertEq(uint8(covenant.engagement(id).status), uint8(Covenant.Status.Proposed));
    }

    function test_proposeRejectsUnverifiedMarket() public {
        Covenant.Terms memory t = defaultTerms();
        t.market = IKuruOrderBook(address(0xbeef));
        vm.prank(issuer);
        vm.expectRevert(Covenant.InvalidTerms.selector);
        covenant.propose(t);
    }

    function test_proposeRejectsOptionsAboveLoan() public {
        Covenant.Terms memory t = defaultTerms();
        t.options = t.loan + 1;
        vm.prank(issuer);
        vm.expectRevert(Covenant.InvalidTerms.selector);
        covenant.propose(t);
    }

    function test_cancelReturnsEscrowToIssuer() public {
        vm.prank(issuer);
        uint256 id = covenant.propose(defaultTerms());
        vm.prank(issuer);
        covenant.cancel(id);

        vm.startPrank(issuer);
        covenant.claim(address(base));
        covenant.claim(address(usdc));
        vm.stopPrank();
        assertEq(base.balanceOf(issuer), 1000e18);
        assertEq(usdc.balanceOf(issuer), 1_000_000e6);
    }

    function test_onlyMakerCanAccept() public {
        vm.prank(issuer);
        uint256 id = covenant.propose(defaultTerms());
        vm.prank(issuer);
        vm.expectRevert(Covenant.Unauthorized.selector);
        covenant.accept(id, operator);
    }

    function test_acceptMovesInventoryOntoKuru() public {
        uint256 id = open();
        Covenant.Engagement memory e = covenant.engagement(id);

        assertEq(uint8(e.status), uint8(Covenant.Status.Active));
        assertEq(core.getBalance(e.account, address(base)), 100e18);
        assertEq(core.getBalance(e.account, address(usdc)), 200_000e6);
        assertEq(usdc.balanceOf(address(covenant)), 30_000e6 + 10_000e6);
        assertEq(core.ownerOf(core.rootOf(e.account)), address(covenant));
        assertEq(covenant.engagementOfAccount(e.account), id);
        assertEq(e.endBlock, e.startBlock + 100_000);
    }

    function test_engagementsGetSeparateAccounts() public {
        uint256 a = open();
        uint256 b = open();
        assertTrue(account(a) != account(b));
        assertEq(core.rootOf(account(a)), core.rootOf(account(b)));
    }

    function test_terminateShortensTermAfterNotice() public {
        uint256 id = open();
        vm.prank(issuer);
        covenant.terminate(id);
        assertEq(covenant.engagement(id).endBlock, block.number + 5000);
    }

    function test_enableHookRequiresKuruAccess() public {
        uint256 id = open();
        vm.expectRevert();
        covenant.enableHook(id);

        core.setPostFillHookAccess(account(id), true);
        covenant.enableHook(id);
        assertEq(book.getPostFillHook(account(id)), address(covenant));
    }
}
