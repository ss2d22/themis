// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

contract MockAggregator {
    uint8 public immutable decimals;
    int256 internal _answer;
    uint256 internal _updatedAt;

    constructor(uint8 decimals_) {
        decimals = decimals_;
    }

    function set(int256 answer, uint256 updatedAt) external {
        _answer = answer;
        _updatedAt = updatedAt;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, _answer, _updatedAt, _updatedAt, 1);
    }
}
