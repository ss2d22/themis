// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {FixedPointMathLib} from "solady/utils/FixedPointMathLib.sol";
import {MarketMath} from "./MarketMath.sol";

/// @notice Splits an engagement's closing inventory between issuer and market maker.
/// @dev The issuer is owed the full loan back in base. Any base the market maker sold and did not buy
///      back is a shortfall. Vested options cover the shortfall at the strike; the rest is charged at
///      the higher of strike and reference plus a penalty, so selling the loan cheaply is never cheaper
///      than buying it back. If the market maker's quote cannot cover it, the bond makes up the rest.
library Settlement {
    using MarketMath for MarketMath.Units;

    struct Input {
        uint256 loan;
        uint256 baseHeld;
        uint256 quoteHeld;
        uint256 vested;
        uint256 extraExercise;
        uint256 strike;
        uint256 refPrice;
        uint256 penaltyBps;
        uint256 bond;
    }

    struct Output {
        uint256 issuerBase;
        uint256 issuerQuote;
        uint256 makerBase;
        uint256 makerQuote;
        uint256 bondToIssuer;
        uint256 bondToMaker;
        uint256 shortfall;
        uint256 exercised;
        uint256 deficit;
    }

    function penaltyPrice(uint256 strike, uint256 refPrice, uint256 penaltyBps)
        internal
        pure
        returns (uint256)
    {
        uint256 base = strike > refPrice ? strike : refPrice;
        return FixedPointMathLib.fullMulDivUp(base, MarketMath.BPS + penaltyBps, MarketMath.BPS);
    }

    function compute(MarketMath.Units memory u, Input memory i) internal pure returns (Output memory o) {
        uint256 owedQuote;

        if (i.baseHeld >= i.loan) {
            o.issuerBase = i.loan;
            o.makerBase = i.baseHeld - i.loan;
        } else {
            o.issuerBase = i.baseHeld;
            o.shortfall = i.loan - i.baseHeld;
            uint256 atStrike = o.shortfall < i.vested ? o.shortfall : i.vested;
            o.exercised = atStrike;
            owedQuote = u.quoteForUp(atStrike, i.strike)
                + u.quoteForUp(o.shortfall - atStrike, penaltyPrice(i.strike, i.refPrice, i.penaltyBps));
        }

        uint256 extra = i.extraExercise;
        uint256 vestedLeft = i.vested - o.exercised;
        if (extra > vestedLeft) extra = vestedLeft;
        if (extra > o.issuerBase) extra = o.issuerBase;
        if (extra > 0) {
            uint256 cost = u.quoteForUp(extra, i.strike);
            if (owedQuote + cost <= i.quoteHeld) {
                owedQuote += cost;
                o.issuerBase -= extra;
                o.makerBase += extra;
                o.exercised += extra;
            }
        }

        if (owedQuote <= i.quoteHeld) {
            o.issuerQuote = owedQuote;
            o.makerQuote = i.quoteHeld - owedQuote;
            o.bondToMaker = i.bond;
        } else {
            o.issuerQuote = i.quoteHeld;
            uint256 gap = owedQuote - i.quoteHeld;
            o.bondToIssuer = gap < i.bond ? gap : i.bond;
            o.bondToMaker = i.bond - o.bondToIssuer;
            o.deficit = gap - o.bondToIssuer;
        }
    }
}
