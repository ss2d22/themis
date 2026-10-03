// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {MarketMath} from "../src/libraries/MarketMath.sol";
import {Settlement} from "../src/libraries/Settlement.sol";

contract SettlementTest is Test {
    using MarketMath for MarketMath.Units;

    MarketMath.Units internal units = MarketMath.Units({
        sizePrecision: 1e10, baseSizeMultiplier: 1e8, pricePrecision: 100, tickSize: 1, quoteUnit: 1e6
    });

    function compute(Settlement.Input memory i) external view returns (Settlement.Output memory) {
        return Settlement.compute(units, i);
    }

    function _bound(Settlement.Input memory i) internal pure returns (Settlement.Input memory) {
        i.loan = bound(i.loan, 1e18, 1e27);
        i.baseHeld = bound(i.baseHeld, 0, 2 * i.loan);
        i.quoteHeld = bound(i.quoteHeld, 0, 1e18);
        i.vested = bound(i.vested, 0, i.loan);
        i.extraExercise = bound(i.extraExercise, 0, i.loan);
        i.strike = bound(i.strike, 1, 1e9);
        i.refPrice = bound(i.refPrice, 1, 1e9);
        i.penaltyBps = bound(i.penaltyBps, 0, 10_000);
        i.bond = bound(i.bond, 0, 1e15);
        return i;
    }

    function testFuzz_conservesInventory(Settlement.Input memory i) public view {
        i = _bound(i);
        Settlement.Output memory o = this.compute(i);

        assertEq(o.issuerBase + o.makerBase, i.baseHeld, "base");
        assertEq(o.issuerQuote + o.makerQuote, i.quoteHeld, "quote");
        assertEq(o.bondToIssuer + o.bondToMaker, i.bond, "bond");
        assertLe(o.exercised, i.vested, "exercise");
    }

    function testFuzz_issuerMadeWholeAtLeastAtStrike(Settlement.Input memory i) public view {
        i = _bound(i);
        i.extraExercise = 0;
        Settlement.Output memory o = this.compute(i);

        uint256 received = o.issuerQuote + o.bondToIssuer + o.deficit;
        assertGe(received, units.quoteForUp(o.shortfall, i.strike));
        if (o.shortfall == 0) assertEq(o.issuerBase, i.loan);
    }

    function testFuzz_unvestedShortfallCostsMoreThanReference(Settlement.Input memory i) public view {
        i = _bound(i);
        i.extraExercise = 0;
        i.vested = 0;
        i.baseHeld = bound(i.baseHeld, 0, i.loan - 1);
        Settlement.Output memory o = this.compute(i);

        uint256 received = o.issuerQuote + o.bondToIssuer + o.deficit;
        assertGe(received, units.quoteForUp(o.shortfall, i.refPrice));
    }

    function testFuzz_deficitOnlyWhenBondExhausted(Settlement.Input memory i) public view {
        i = _bound(i);
        Settlement.Output memory o = this.compute(i);
        if (o.deficit > 0) {
            assertEq(o.bondToMaker, 0);
            assertEq(o.makerQuote, 0);
        }
    }

    function test_penaltyPriceUsesHigherOfStrikeAndReference() public pure {
        assertEq(Settlement.penaltyPrice(210_000, 200_000, 1000), 231_000);
        assertEq(Settlement.penaltyPrice(150_000, 200_000, 1000), 220_000);
    }

    function test_noShortfallReturnsLoan() public view {
        Settlement.Output memory o = this.compute(
            Settlement.Input({
                loan: 100e18,
                baseHeld: 103e18,
                quoteHeld: 50_000e6,
                vested: 10e18,
                extraExercise: 0,
                strike: 210_000,
                refPrice: 200_000,
                penaltyBps: 1000,
                bond: 1000e6
            })
        );
        assertEq(o.issuerBase, 100e18);
        assertEq(o.makerBase, 3e18);
        assertEq(o.makerQuote, 50_000e6);
        assertEq(o.bondToMaker, 1000e6);
    }

    function test_bondCoversQuoteGap() public view {
        Settlement.Output memory o = this.compute(
            Settlement.Input({
                loan: 100e18,
                baseHeld: 90e18,
                quoteHeld: 20_000e6,
                vested: 0,
                extraExercise: 0,
                strike: 210_000,
                refPrice: 200_000,
                penaltyBps: 1000,
                bond: 5000e6
            })
        );
        // 10 base at 2,310 = 23,100. Quote covers 20,000 and the bond 3,100.
        assertEq(o.issuerQuote, 20_000e6);
        assertEq(o.bondToIssuer, 3100e6);
        assertEq(o.bondToMaker, 1900e6);
        assertEq(o.deficit, 0);
    }
}
