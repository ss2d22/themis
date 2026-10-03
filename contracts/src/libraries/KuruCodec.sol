// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice Encoding helpers for Kuru packed slot operations and post-fill hook words.
/// @dev Layouts mirror SDK 0.2.0 (`encodePackedReplaceOp`, `packPostFill*`).
library KuruCodec {
    uint8 internal constant SIDE_BUY = 0;
    uint8 internal constant SIDE_SELL = 1;
    uint8 internal constant TIF_GTC = 0;
    uint8 internal constant EXEC_POST_ONLY = 1;

    uint8 internal constant MARKET_ACTIVE = 0;

    uint8 internal constant FLAG_BUY = 1;
    uint8 internal constant FLAG_ALO = 8;

    uint256 internal constant HOOK_NOOP = 0;
    uint256 internal constant HOOK_REQUOTE_PAIR = 1;
    uint256 internal constant HOOK_REPLENISH_ONLY = 2;
    uint256 internal constant HOOK_REPLACE_ONLY = 3;

    uint32 internal constant EMPTY_BID = type(uint32).max;
    uint32 internal constant EMPTY_ASK = 0;

    /// @dev One 32-byte packed replace word. Zero price and size encodes a cancel.
    struct SlotOp {
        uint8 slot;
        uint8 flags;
        uint32 price;
        uint96 size;
        uint32 minSizeAfterBlock;
    }

    function encodeOp(SlotOp memory op) internal pure returns (bytes32) {
        return bytes32(
            uint256(op.slot) | (uint256(op.flags) << 8) | (uint256(op.price) << 16) | (uint256(op.size) << 48)
                | (uint256(op.minSizeAfterBlock) << 144)
        );
    }

    function decodeOp(bytes32 word) internal pure returns (SlotOp memory op) {
        uint256 w = uint256(word);
        // forge-lint: disable-start(unsafe-typecast)
        op.slot = uint8(w);
        op.flags = uint8(w >> 8);
        op.price = uint32(w >> 16);
        op.size = uint96(w >> 48);
        op.minSizeAfterBlock = uint32(w >> 144);
        // forge-lint: disable-end(unsafe-typecast)
    }

    function isCancel(SlotOp memory op) internal pure returns (bool) {
        return op.price == 0 && op.size == 0;
    }

    function isBuy(SlotOp memory op) internal pure returns (bool) {
        return op.flags & FLAG_BUY != 0;
    }

    function packHookQuote(uint32 price, uint96 size) internal pure returns (uint256) {
        return uint256(price) | (uint256(size) << 32);
    }

    function packHookReplacementHeader(uint256 action, uint8 slot, uint64 expectedOrderId)
        internal
        pure
        returns (uint256)
    {
        return action | (uint256(slot) << 8) | (uint256(expectedOrderId) << 16);
    }
}
