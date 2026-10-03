// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {FixedPointMathLib} from "solady/utils/FixedPointMathLib.sol";

/// @notice Unit conversions for a Kuru market.
/// @dev Kuru prices are `quote per base * pricePrecision`, order sizes are `base * sizePrecision`.
///      One whole base token is `sizePrecision * baseSizeMultiplier` raw atoms.
library MarketMath {
    using FixedPointMathLib for uint256;

    uint256 internal constant BPS = 10_000;

    struct Units {
        uint96 sizePrecision;
        uint96 baseSizeMultiplier;
        uint32 pricePrecision;
        uint32 tickSize;
        uint64 quoteUnit;
    }

    function baseAtoms(Units memory u, uint256 size) internal pure returns (uint256) {
        return size * u.baseSizeMultiplier;
    }

    /// @dev Raw quote atoms for `atoms` of base at `price`, rounded down.
    function quoteFor(Units memory u, uint256 atoms, uint256 price) internal pure returns (uint256) {
        return atoms.fullMulDiv(
            price * u.quoteUnit, uint256(u.sizePrecision) * u.baseSizeMultiplier * u.pricePrecision
        );
    }

    /// @dev Raw quote atoms for `atoms` of base at `price`, rounded up. Used for amounts owed to the issuer.
    function quoteForUp(Units memory u, uint256 atoms, uint256 price) internal pure returns (uint256) {
        return atoms.fullMulDivUp(
            price * u.quoteUnit, uint256(u.sizePrecision) * u.baseSizeMultiplier * u.pricePrecision
        );
    }

    /// @dev Raw quote atoms for an order of `size` (size units) at `price`.
    function quoteForSize(Units memory u, uint256 size, uint256 price) internal pure returns (uint256) {
        return size.fullMulDiv(price * u.quoteUnit, uint256(u.sizePrecision) * u.pricePrecision);
    }

    function withinBps(uint256 price, uint256 ref, uint256 bps) internal pure returns (bool) {
        uint256 diff = price > ref ? price - ref : ref - price;
        return diff * BPS <= ref * bps;
    }

    function spreadBps(uint256 bid, uint256 ask, uint256 ref) internal pure returns (uint256) {
        if (ask <= bid) return 0;
        return (ask - bid).fullMulDivUp(BPS, ref);
    }
}
