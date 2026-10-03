// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";
import {FixedPointMathLib} from "solady/utils/FixedPointMathLib.sol";
import {IKuruOrderBook} from "../../src/interfaces/kuru/IKuruOrderBook.sol";
import {IPostFillHook} from "../../src/interfaces/kuru/IPostFillHook.sol";
import {KuruCodec} from "../../src/libraries/KuruCodec.sol";
import {MockAccountCore} from "./MockAccountCore.sol";

/// @dev Single-market stand-in for a Kuru OrderBook. Supports slot quoting with post-only skips, test-driven
///      taker fills, the post-fill hook and passive positions. Maker fees are zero.
contract MockOrderBook {
    using SafeTransferLib for address;

    struct Order {
        bool isBuy;
        uint32 price;
        uint96 size;
        uint64 id;
    }

    struct Position {
        uint40 owner;
        uint32 lowPrice;
        uint128 base;
        uint128 quote;
        uint128 shares;
    }

    MockAccountCore public immutable core;
    address public immutable baseToken;
    address public immutable quoteToken;
    uint96 public immutable sizePrecision;
    uint32 public immutable pricePrecision;
    uint32 public immutable tickSize;
    uint96 public immutable baseSizeMultiplier;
    uint8 public immutable quoteTokenDecimals;

    uint8 public marketState;
    uint32 public passiveSpreadTicks = 100;
    uint256 public constant makerFeePps = 0;
    uint96 public constant minQuoteNotional = 0;

    uint32 public externalBid = type(uint32).max;
    uint32 public externalAsk;

    uint64 internal _nextOrderId;
    uint64 internal _nextPosition;
    uint40[] internal _makers;
    mapping(uint40 => bool) internal _known;
    mapping(uint40 => mapping(uint8 => Order)) internal _orders;
    mapping(uint40 => address) public getPostFillHook;
    mapping(uint64 => Position) internal _positions;
    /// @dev Orders that arrived without post-only or with reduce-after-block, per account.
    mapping(uint40 => uint256) public unsafePlacements;

    error Unauthorized();
    error HookAccessDenied();

    constructor(
        MockAccountCore core_,
        address base,
        address quote,
        uint96 sizePrecision_,
        uint32 pricePrecision_,
        uint32 tickSize_,
        uint8 baseDecimals,
        uint8 quoteDecimals
    ) {
        core = core_;
        baseToken = base;
        quoteToken = quote;
        sizePrecision = sizePrecision_;
        pricePrecision = pricePrecision_;
        tickSize = tickSize_;
        baseSizeMultiplier = uint96(10 ** baseDecimals / sizePrecision_);
        quoteTokenDecimals = quoteDecimals;
    }

    modifier onlyTrader(uint40 user) {
        if (!core.isOwner(user, msg.sender)) revert Unauthorized();
        _;
    }

    // --- test controls ---

    function setMarketState(uint8 state) external {
        marketState = state;
    }

    function setExternalQuotes(uint32 bid, uint32 ask) external {
        externalBid = bid;
        externalAsk = ask;
    }

    function setPassiveSpreadTicks(uint32 ticks) external {
        passiveSpreadTicks = ticks;
    }

    /// @dev Simulates a taker hitting `size` of a maker slot. The taker settles in real tokens.
    function fill(uint40 user, uint8 slot, uint96 size, address taker) external {
        Order storage o = _orders[user][slot];
        require(o.id != 0 && size <= o.size, "no order");
        uint256 baseAmt = uint256(size) * baseSizeMultiplier;
        uint256 quoteAmt = quoteForSize(size, o.price);
        if (o.isBuy) {
            baseToken.safeTransferFrom(taker, address(core), baseAmt);
            core.credit(user, baseToken, baseAmt);
            core.consumeReserve(user, quoteToken, quoteAmt, taker);
        } else {
            quoteToken.safeTransferFrom(taker, address(core), quoteAmt);
            core.credit(user, quoteToken, quoteAmt);
            core.consumeReserve(user, baseToken, baseAmt, taker);
        }
        o.size -= size;
        if (o.size > 0) return;

        Order memory filled = o;
        delete _orders[user][slot];
        address hook = getPostFillHook[user];
        if (hook == address(0)) return;

        (uint32 bid, uint32 ask) = bestBidAsk();
        IPostFillHook.PostFillContext memory ctx = IPostFillHook.PostFillContext({
            userId: user,
            filledSlotIdx: slot,
            filledOrderId: filled.id,
            takerId: 0,
            fillPrice: filled.price,
            filledSize: size,
            remainingBaseSize: 0,
            bestBid: bid,
            bestAsk: ask,
            filledOrderIsBuy: filled.isBuy
        });
        try IPostFillHook(hook).postFill{gas: 500_000}(ctx) returns (
            uint256 header, uint256 replenish, uint256
        ) {
            if (header == KuruCodec.HOOK_REPLENISH_ONLY) {
                uint32 price = uint32(replenish);
                uint96 qty = uint96(replenish >> 32);
                _place(user, slot, filled.isBuy, price, qty, true);
            }
        } catch {}
    }

    // --- IKuruOrderBook surface ---

    function replaceBySlotPacked(uint40 user, bytes calldata ops) external onlyTrader(user) {
        _track(user);
        for (uint256 k; k < ops.length / 32; ++k) {
            KuruCodec.SlotOp memory op = KuruCodec.decodeOp(bytes32(ops[k * 32:(k + 1) * 32]));
            _cancel(user, op.slot);
            if (KuruCodec.isCancel(op)) continue;
            if (op.flags & KuruCodec.FLAG_ALO == 0 || op.minSizeAfterBlock != 0) unsafePlacements[user]++;
            _place(user, op.slot, KuruCodec.isBuy(op), op.price, op.size, op.flags & KuruCodec.FLAG_ALO != 0);
        }
    }

    function cancelAllOrders(uint40 user) external onlyTrader(user) {
        for (uint8 i; i < 62; ++i) {
            _cancel(user, i);
        }
    }

    function setPostFillHook(uint40 user, address hook) external onlyTrader(user) {
        if (hook != address(0) && !core.postFillHookAccess(user)) revert HookAccessDenied();
        getPostFillHook[user] = hook;
    }

    function getOrderId(uint40 user, uint8 slot) external view returns (uint64) {
        return _orders[user][slot].id;
    }

    function makerLockedReserves(uint40 user) external view returns (uint256, uint256) {
        return (core.reserved(user, baseToken), core.reserved(user, quoteToken));
    }

    function bestBidAsk() public view returns (uint32 bid, uint32 ask) {
        bid = externalBid;
        ask = externalAsk;
        for (uint256 m; m < _makers.length; ++m) {
            for (uint8 i; i < 62; ++i) {
                Order storage o = _orders[_makers[m]][i];
                if (o.id == 0) continue;
                if (o.isBuy && (bid == type(uint32).max || o.price > bid)) bid = o.price;
                if (!o.isBuy && (ask == 0 || o.price < ask)) ask = o.price;
            }
        }
    }

    function batchMintPassiveLiquidity(uint40 user, IKuruOrderBook.PassiveMintParams[] calldata mints, uint64)
        external
        onlyTrader(user)
        returns (IKuruOrderBook.PassiveMintResult[] memory results)
    {
        results = new IKuruOrderBook.PassiveMintResult[](mints.length);
        for (uint256 i; i < mints.length; ++i) {
            IKuruOrderBook.PassiveMintParams calldata p = mints[i];
            core.lock(user, baseToken, p.baseAmount);
            core.lock(user, quoteToken, p.quoteAmount);
            uint64 id = ++_nextPosition;
            uint128 shares = p.baseAmount + p.quoteAmount;
            _positions[id] = Position(user, p.lowPrice, p.baseAmount, p.quoteAmount, shares);
            results[i] = IKuruOrderBook.PassiveMintResult(id, shares, p.baseAmount, p.quoteAmount);
        }
    }

    function burnPassiveLiquidity(uint40 user, uint64 positionId, uint128)
        external
        onlyTrader(user)
        returns (uint128 base, uint128 quote, uint128, uint128)
    {
        Position memory p = _positions[positionId];
        require(p.owner == user, "owner");
        delete _positions[positionId];
        core.credit(user, baseToken, p.base);
        core.credit(user, quoteToken, p.quote);
        return (p.base, p.quote, 0, 0);
    }

    function getPassivePosition(uint64 positionId)
        external
        view
        returns (IKuruOrderBook.PassivePositionView memory v)
    {
        Position memory p = _positions[positionId];
        v.ownerId = p.owner;
        v.lowPrice = p.lowPrice;
        v.highPrice = p.lowPrice + passiveSpreadTicks * tickSize;
        v.shares = p.shares;
    }

    function quoteForSize(uint256 size, uint256 price) public view returns (uint256) {
        return FixedPointMathLib.fullMulDiv(
            size, price * 10 ** quoteTokenDecimals, uint256(sizePrecision) * pricePrecision
        );
    }

    // --- internals ---

    function _place(uint40 user, uint8 slot, bool isBuy, uint32 price, uint96 size, bool postOnly) internal {
        (uint32 bid, uint32 ask) = bestBidAsk();
        bool crosses = isBuy ? (ask != 0 && price >= ask) : (bid != type(uint32).max && price <= bid);
        if (crosses && postOnly) return;
        require(!crosses, "taker path not mocked");
        if (isBuy) core.reserve(user, quoteToken, quoteForSize(size, price));
        else core.reserve(user, baseToken, uint256(size) * baseSizeMultiplier);
        _orders[user][slot] = Order(isBuy, price, size, ++_nextOrderId);
    }

    function _cancel(uint40 user, uint8 slot) internal {
        Order memory o = _orders[user][slot];
        if (o.id == 0) return;
        delete _orders[user][slot];
        if (o.isBuy) core.release(user, quoteToken, quoteForSize(o.size, o.price));
        else core.release(user, baseToken, uint256(o.size) * baseSizeMultiplier);
    }

    function _track(uint40 user) internal {
        if (_known[user]) return;
        _known[user] = true;
        _makers.push(user);
    }
}
