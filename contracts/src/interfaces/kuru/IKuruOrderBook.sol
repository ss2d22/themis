// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice Subset of the Kuru Spot V2 OrderBook used by Covenant.
/// @dev Matches SDK 0.2.0 ABI, OrderBook revision cdac5ae1.
interface IKuruOrderBook {
    struct NativeOrder {
        uint8 side;
        uint96 quantity;
        uint32 price;
        uint8 tif;
        uint8 executionInstruction;
        uint32 minSizeAfterBlock;
    }

    struct PassivePositionView {
        uint40 ownerId;
        uint32 lowPrice;
        uint32 highPrice;
        uint128 shares;
        uint256 lastFeeGrowthBaseX128;
        uint256 lastFeeGrowthQuoteX128;
    }

    event TradesPacked(
        uint40 indexed accountId,
        address indexed executor,
        bytes32 clientOrderId,
        uint24 effectiveTakerFeePps,
        address builder,
        uint24 builderFeePps,
        bytes packedTrades
    );
    event BookUpdatesPacked(
        uint40 indexed accountId, address indexed executor, bytes32 clientOrderId, bytes packedUpdates
    );

    function baseToken() external view returns (address);
    function quoteToken() external view returns (address);
    function sizePrecision() external view returns (uint96);
    function pricePrecision() external view returns (uint32);
    function tickSize() external view returns (uint32);
    function baseSizeMultiplier() external view returns (uint96);
    function quoteTokenDecimals() external view returns (uint8);
    function minQuoteNotional() external view returns (uint96);
    function marketState() external view returns (uint8);

    function bestBidAsk() external view returns (uint32 bid, uint32 ask);
    function lastTradeObservation() external view returns (uint64 priceX8, uint32 timestamp);
    function getOrderId(uint40 userId, uint8 slotIdx) external view returns (uint64 orderId);
    function makerLockedReserves(uint40 userId)
        external
        view
        returns (uint256 baseReserved, uint256 quoteReserved);
    function getL2Book(uint256 levels)
        external
        view
        returns (
            uint32[] memory bidPrices,
            uint96[] memory bidSizes,
            uint32[] memory askPrices,
            uint96[] memory askSizes
        );

    function batch(uint40 userId, NativeOrder[] calldata orders, uint8[] calldata cancelSlotIdxs) external;
    function replaceBySlotPacked(uint40 userId, bytes calldata packedOps) external;
    function cancelAllOrders(uint40 userId) external;

    function swap(uint40 userId, bool isBuy, uint128 amountIn, uint128 minAmountOut, uint64 deadline)
        external
        returns (uint128 amountInUsed, uint128 amountOut);

    function mintPassiveLiquidity(
        uint40 userId,
        uint32 lowPrice,
        uint128 baseAmount,
        uint128 quoteAmount,
        uint128 minSharesOut,
        uint64 deadline
    ) external returns (uint64 positionId, uint128 sharesOut);
    function burnPassiveLiquidity(uint40 userId, uint64 positionId, uint128 sharesToBurn)
        external
        returns (uint128 basePrincipalOut, uint128 quotePrincipalOut, uint128 baseFeeOut, uint128 quoteFeeOut);
    function getPassivePosition(uint64 positionId) external view returns (PassivePositionView memory position);

    function setPostFillHook(uint40 userId, address hook) external;
    function getPostFillHook(uint40 userId) external view returns (address hook);
}
