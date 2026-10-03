// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice External reference price, quoted in the market's Kuru price units.
interface IPriceSource {
    function latestPrice() external view returns (uint32 price, uint64 updatedAt);
}
