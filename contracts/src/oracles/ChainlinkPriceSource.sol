// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IPriceSource} from "../interfaces/IPriceSource.sol";

interface IAggregatorV3 {
    function decimals() external view returns (uint8);
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

/// @notice Serves a Chainlink-style feed as a covenant reference price in a Kuru market's price units.
/// @dev The feed must quote the market's base in its quote currency, or in a unit the quote tracks one to one
///      (a USD feed for a USDC-quoted market). A non-positive or overflowing answer reads as zero, which the escrow
///      treats as unusable and falls back to the book.
contract ChainlinkPriceSource is IPriceSource {
    IAggregatorV3 public immutable feed;
    uint256 public immutable pricePrecision;
    uint256 public immutable tickSize;
    uint256 internal immutable _feedUnit;

    constructor(IAggregatorV3 feed_, uint256 pricePrecision_, uint256 tickSize_) {
        feed = feed_;
        pricePrecision = pricePrecision_;
        tickSize = tickSize_;
        _feedUnit = 10 ** feed_.decimals();
    }

    /// @inheritdoc IPriceSource
    function latestPrice() external view returns (uint32 price, uint64 updatedAt) {
        (, int256 answer,, uint256 updated,) = feed.latestRoundData();
        if (answer <= 0) return (0, uint64(updated));
        uint256 raw = uint256(answer) * pricePrecision / _feedUnit;
        raw = raw / tickSize * tickSize;
        if (raw > type(uint32).max) return (0, uint64(updated));
        return (uint32(raw), uint64(updated));
    }
}
