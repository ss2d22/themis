// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC20} from "solady/tokens/ERC20.sol";
import {LibString} from "solady/utils/LibString.sol";
import {ReentrancyGuard} from "solady/utils/ReentrancyGuard.sol";
import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";
import {Covenant} from "../Covenant.sol";
import {MarketMath} from "../libraries/MarketMath.sol";
import {OutcomeToken} from "./OutcomeToken.sol";

/// @title OutcomeMarket
/// @notice Fully collateralised KEPT/BROKEN pairs on whether a market maker meets its uptime target over a
///         range of covenant epochs. One unit of the engagement's quote token mints one KEPT and one BROKEN.
///         Resolution reads the escrow's own ledger, so there is no oracle and nothing to dispute.
contract OutcomeMarket is ReentrancyGuard {
    using SafeTransferLib for address;

    enum Outcome {
        Open,
        Kept,
        Broken
    }

    struct Market {
        uint256 engagementId;
        uint32 firstEpoch;
        uint32 epochCount;
        address collateral;
        OutcomeToken kept;
        OutcomeToken broken;
        Outcome outcome;
    }

    Covenant public immutable covenant;
    uint256 public marketCount;
    mapping(uint256 => Market) internal _markets;
    mapping(bytes32 => uint256) public marketOf;

    event MarketCreated(
        uint256 indexed marketId,
        uint256 indexed engagementId,
        uint32 firstEpoch,
        uint32 epochCount,
        address kept,
        address broken
    );
    event SetMinted(uint256 indexed marketId, address indexed account, uint256 amount);
    event SetRedeemed(uint256 indexed marketId, address indexed account, uint256 amount);
    event Resolved(uint256 indexed marketId, Outcome outcome, uint256 credited, uint256 length);
    event Redeemed(uint256 indexed marketId, address indexed account, uint256 amount);

    error InvalidRange();
    error AlreadyExists();
    error NotOpen();
    error NotResolved();
    error PeriodNotOver();

    constructor(Covenant covenant_) {
        covenant = covenant_;
    }

    function create(uint256 engagementId, uint32 firstEpoch, uint32 epochCount)
        external
        returns (uint256 marketId)
    {
        bytes32 key = keccak256(abi.encode(engagementId, firstEpoch, epochCount));
        if (marketOf[key] != 0) revert AlreadyExists();

        Covenant.Engagement memory e = covenant.engagement(engagementId);
        if (e.status != Covenant.Status.Active || epochCount == 0) revert InvalidRange();
        (uint64 from,) = covenant.epochBounds(engagementId, firstEpoch);
        (, uint64 to) = covenant.epochBounds(engagementId, firstEpoch + epochCount - 1);
        if (from >= to || to > e.endBlock || to <= block.number) revert InvalidRange();

        marketId = ++marketCount;
        marketOf[key] = marketId;
        string memory tag = string.concat(
            LibString.toString(engagementId),
            "-E",
            LibString.toString(firstEpoch),
            "+",
            LibString.toString(epochCount)
        );
        uint8 decimals = ERC20(e.quote).decimals();
        OutcomeToken kept =
            new OutcomeToken(string.concat("Covenant Kept ", tag), string.concat("KEPT-", tag), decimals);
        OutcomeToken broken =
            new OutcomeToken(string.concat("Covenant Broken ", tag), string.concat("BROKEN-", tag), decimals);

        _markets[marketId] = Market({
            engagementId: engagementId,
            firstEpoch: firstEpoch,
            epochCount: epochCount,
            collateral: e.quote,
            kept: kept,
            broken: broken,
            outcome: Outcome.Open
        });

        emit MarketCreated(marketId, engagementId, firstEpoch, epochCount, address(kept), address(broken));
    }

    function mintSet(uint256 marketId, uint256 amount) external nonReentrant {
        Market storage m = _markets[marketId];
        if (m.outcome != Outcome.Open || address(m.kept) == address(0)) revert NotOpen();
        m.collateral.safeTransferFrom(msg.sender, address(this), amount);
        m.kept.mint(msg.sender, amount);
        m.broken.mint(msg.sender, amount);
        emit SetMinted(marketId, msg.sender, amount);
    }

    function redeemSet(uint256 marketId, uint256 amount) external nonReentrant {
        Market storage m = _markets[marketId];
        if (m.outcome != Outcome.Open) revert NotOpen();
        m.kept.burn(msg.sender, amount);
        m.broken.burn(msg.sender, amount);
        m.collateral.safeTransfer(msg.sender, amount);
        emit SetRedeemed(marketId, msg.sender, amount);
    }

    /// @notice Resolves once the period has ended, observing the escrow first if needed. A clawback before the
    ///         period ends resolves to BROKEN. Credit that was never observed counts as missed.
    function resolve(uint256 marketId) external {
        Market storage m = _markets[marketId];
        if (m.outcome != Outcome.Open) revert NotOpen();

        uint256 id = m.engagementId;
        (uint64 from,) = covenant.epochBounds(id, m.firstEpoch);
        (, uint64 to) = covenant.epochBounds(id, m.firstEpoch + m.epochCount - 1);
        if (block.number < to) revert PeriodNotOver();

        Covenant.Engagement memory e = covenant.engagement(id);
        if (e.status == Covenant.Status.Active && e.lastObsBlock < to) {
            covenant.poke(id);
            e = covenant.engagement(id);
        }

        uint256 credited;
        for (uint32 k; k < m.epochCount; ++k) {
            credited += covenant.epochCredit(id, m.firstEpoch + k);
        }
        uint256 length = to - from;
        bool brokenEarly = e.status == Covenant.Status.ClawedBack && e.endBlock < to;
        bool kept = !brokenEarly && credited * MarketMath.BPS >= uint256(e.terms.ob.uptimeTargetBps) * length;

        m.outcome = kept ? Outcome.Kept : Outcome.Broken;
        emit Resolved(marketId, m.outcome, credited, length);
    }

    function redeem(uint256 marketId, uint256 amount) external nonReentrant {
        Market storage m = _markets[marketId];
        if (m.outcome == Outcome.Open) revert NotResolved();
        OutcomeToken winner = m.outcome == Outcome.Kept ? m.kept : m.broken;
        winner.burn(msg.sender, amount);
        m.collateral.safeTransfer(msg.sender, amount);
        emit Redeemed(marketId, msg.sender, amount);
    }

    function market(uint256 marketId) external view returns (Market memory) {
        return _markets[marketId];
    }
}
