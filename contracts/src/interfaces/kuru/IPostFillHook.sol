// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice Maker callback invoked by a Kuru OrderBook after a fill removes a maker slot.
interface IPostFillHook {
    struct PostFillContext {
        uint40 userId;
        uint8 filledSlotIdx;
        uint64 filledOrderId;
        uint40 takerId;
        uint32 fillPrice;
        uint96 filledSize;
        uint96 remainingBaseSize;
        uint32 bestBid;
        uint32 bestAsk;
        bool filledOrderIsBuy;
    }

    function postFill(PostFillContext calldata ctx)
        external
        returns (uint256 header, uint256 replenishWord, uint256 replacementWord);
}
