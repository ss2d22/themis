// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ReentrancyGuard} from "solady/utils/ReentrancyGuard.sol";
import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";
import {FixedPointMathLib} from "solady/utils/FixedPointMathLib.sol";
import {SafeCastLib} from "solady/utils/SafeCastLib.sol";

import {IKuruAccountCore} from "./interfaces/kuru/IKuruAccountCore.sol";
import {IKuruOrderBook} from "./interfaces/kuru/IKuruOrderBook.sol";
import {IPostFillHook} from "./interfaces/kuru/IPostFillHook.sol";
import {IPriceSource} from "./interfaces/IPriceSource.sol";
import {KuruCodec} from "./libraries/KuruCodec.sol";
import {MarketMath} from "./libraries/MarketMath.sol";
import {Settlement} from "./libraries/Settlement.sol";

/// @title Covenant
/// @notice Escrow for market-making agreements on Kuru. The escrow owns the Kuru account that holds the
///         issuer's token loan and the market maker's quote collateral. The market maker can only place
///         post-only quotes through `quote`, inside a band around a reference price, and is paid in
///         options and retainer that vest per block only while spread, depth and uptime targets hold.
contract Covenant is IPostFillHook, ReentrancyGuard {
    using MarketMath for MarketMath.Units;
    using SafeTransferLib for address;
    using SafeCastLib for uint256;

    uint256 internal constant MAX_SLOTS = 62;
    uint256 internal constant FEE_DENOMINATOR = 10_000_000;

    enum Status {
        None,
        Proposed,
        Active,
        ClawbackEligible,
        Settled,
        ClawedBack,
        Cancelled
    }

    struct Obligations {
        uint16 maxSpreadBps;
        uint16 depthBandBps;
        uint16 uptimeTargetBps;
        uint16 sustainedBreachEpochs;
        uint16 volatileSpreadBps;
        uint16 volatilityTriggerBps;
        uint32 epochBlocks;
        uint32 maxCreditBlocks;
        uint32 minQuoteLifeBlocks;
        uint32 graceBlocks;
        uint128 minBidDepth;
        uint128 minAskDepth;
    }

    struct Risk {
        uint16 priceBandBps;
        uint16 maxRefStepBps;
        uint16 penaltyBps;
        uint16 breachSlashBps;
        uint32 sellWindowBlocks;
        uint32 backstopLockBlocks;
        uint128 maxNetSell;
        uint128 watchBounty;
        uint128 clawbackBounty;
        IPriceSource priceSource;
        uint32 maxPriceAge;
    }

    struct Terms {
        IKuruOrderBook market;
        address maker;
        uint128 loan;
        uint128 makerCollateral;
        uint128 bond;
        uint128 options;
        uint128 retainer;
        uint32 strike;
        uint32 initialPrice;
        uint32 termBlocks;
        uint32 noticeBlocks;
        uint32 exerciseWindowBlocks;
        Obligations ob;
        Risk risk;
        bytes32 termsHash;
    }

    struct Engagement {
        Terms terms;
        address issuer;
        address operator;
        Status status;
        uint40 account;
        uint64 startBlock;
        uint64 endBlock;
        MarketMath.Units units;
        address base;
        address quote;
        // ledger
        uint64 lastObsBlock;
        bool lastCompliant;
        uint64 creditedBlocks;
        uint64 nonCompliantSince;
        bool breachReported;
        uint32 nextEpoch;
        uint16 failingStreak;
        // reference price
        uint32 refPrice;
        uint64 refBlock;
        bool volatile;
        // sell limiter
        uint64 sellWindowStart;
        uint256 windowHoldings;
        // quoting
        uint64 liveMask;
        bool refreshEnabled;
        uint16 refreshOffsetTicks;
        // payouts
        uint128 bondLeft;
        uint128 retainerPaid;
        uint64 backstopPosition;
        uint64 backstopUnlock;
    }

    struct Slot {
        uint32 price;
        uint96 size;
        uint64 orderId;
        uint64 placedBlock;
        bool isBuy;
    }

    struct Metrics {
        bool compliant;
        bool suspended;
        uint32 refPrice;
        uint32 bestBid;
        uint32 bestAsk;
        uint256 spreadBps;
        uint256 allowedSpreadBps;
        uint256 bidDepth;
        uint256 askDepth;
    }

    struct MakerStats {
        uint32 engagements;
        uint32 clawbacks;
        uint32 defaults;
        uint32 failedEpochs;
        uint64 creditedBlocks;
        uint64 termBlocks;
    }

    IKuruAccountCore public immutable accountCore;
    uint40 public rootAccount;
    uint256 public engagementCount;

    mapping(uint256 => Engagement) internal _engagements;
    mapping(uint256 => Slot[MAX_SLOTS]) internal _slots;
    mapping(uint256 => mapping(uint256 => uint32)) public epochCredit;
    mapping(uint40 => uint256) public engagementOfAccount;
    mapping(address => MakerStats) public makerStats;

    /// @dev Owed amounts held directly by this contract.
    mapping(address => mapping(address => uint256)) public owed;
    /// @dev Owed amounts held in the escrow's Kuru root account.
    mapping(address => mapping(address => uint256)) public kuruOwed;

    event Proposed(
        uint256 indexed id, address indexed issuer, address indexed maker, address market, bytes32 termsHash
    );
    event Cancelled(uint256 indexed id);
    event Accepted(uint256 indexed id, uint40 account, address operator, uint64 startBlock, uint64 endBlock);
    event OperatorSet(uint256 indexed id, address operator);
    event RefreshPolicySet(uint256 indexed id, bool enabled, uint16 offsetTicks);
    event HookEnabled(uint256 indexed id);
    event Quoted(uint256 indexed id, bytes ops);
    event QuoteSkipped(uint256 indexed id, uint8 slot);
    event Observed(
        uint256 indexed id,
        bool compliant,
        uint64 credited,
        uint32 refPrice,
        uint32 bestBid,
        uint32 bestAsk,
        uint256 bidDepth,
        uint256 askDepth
    );
    event ComplianceChanged(uint256 indexed id, bool compliant);
    event Filled(uint256 indexed id, uint8 slot, uint32 price, uint96 size, bool isBuy, bool replenished);
    event EpochClosed(
        uint256 indexed id, uint32 epoch, uint32 credited, uint32 length, bool passed, uint16 streak
    );
    event ClawbackEligible(uint256 indexed id);
    event BountyPaid(uint256 indexed id, address indexed to, uint256 amount);
    event Terminated(uint256 indexed id, uint64 endBlock);
    event Settled(uint256 indexed id, Settlement.Output result);
    event ClawedBack(
        uint256 indexed id, address indexed caller, Settlement.Output result, uint64 backstopPosition
    );
    event BackstopReleased(uint256 indexed id, uint256 base, uint256 quote);
    event RetainerClaimed(uint256 indexed id, uint256 amount);
    event Claimed(address indexed account, address indexed token, uint256 amount);
    event KuruWithdrawalDeferred(address indexed account, address indexed token, uint256 amount);

    error InvalidTerms();
    error InvalidStatus();
    error Unauthorized();
    error TermEnded();
    error TermNotEnded();
    error BadOps();
    error SlotOutOfRange(uint8 slot);
    error QuoteTooYoung(uint8 slot);
    error NotPostOnly(uint8 slot);
    error ReduceAfterBlockNotAllowed(uint8 slot);
    error OutsidePriceBand(uint8 slot, uint32 price, uint32 refPrice);
    error SellLimitExceeded(uint256 exposure, uint256 limit);
    error EpochNotOver();
    error BackstopLocked();
    error NothingToClaim();
    error KuruWithdrawalBlocked();

    constructor(IKuruAccountCore accountCore_) {
        accountCore = accountCore_;
    }

    // -------------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------------

    /// @notice Issuer offers an agreement and escrows the loan and retainer.
    function propose(Terms calldata t) external nonReentrant returns (uint256 id) {
        _validate(t);

        id = ++engagementCount;
        Engagement storage e = _engagements[id];
        e.terms = t;
        e.issuer = msg.sender;
        e.status = Status.Proposed;
        e.base = t.market.baseToken();
        e.quote = t.market.quoteToken();
        e.units = MarketMath.Units({
            sizePrecision: t.market.sizePrecision(),
            baseSizeMultiplier: t.market.baseSizeMultiplier(),
            pricePrecision: t.market.pricePrecision(),
            tickSize: t.market.tickSize(),
            quoteUnit: uint64(10 ** t.market.quoteTokenDecimals())
        });
        if (e.base == address(0) || e.quote == address(0)) revert InvalidTerms();

        e.base.safeTransferFrom(msg.sender, address(this), t.loan);
        if (t.retainer > 0) e.quote.safeTransferFrom(msg.sender, address(this), t.retainer);

        emit Proposed(id, msg.sender, t.maker, address(t.market), t.termsHash);
    }

    /// @notice Issuer withdraws an offer the market maker has not accepted.
    function cancel(uint256 id) external nonReentrant {
        Engagement storage e = _engagements[id];
        if (e.status != Status.Proposed) revert InvalidStatus();
        if (msg.sender != e.issuer) revert Unauthorized();
        e.status = Status.Cancelled;
        owed[e.issuer][e.base] += e.terms.loan;
        owed[e.issuer][e.quote] += e.terms.retainer;
        emit Cancelled(id);
    }

    /// @notice Market maker accepts, posts collateral and bond, and the loan moves onto Kuru.
    function accept(uint256 id, address operator) external nonReentrant {
        Engagement storage e = _engagements[id];
        Terms storage t = e.terms;
        if (e.status != Status.Proposed) revert InvalidStatus();
        if (msg.sender != t.maker) revert Unauthorized();

        uint256 quoteIn = uint256(t.makerCollateral) + t.bond;
        if (quoteIn > 0) e.quote.safeTransferFrom(msg.sender, address(this), quoteIn);

        e.account = _openAccount(e.base, e.quote, t.loan, t.makerCollateral);
        engagementOfAccount[e.account] = id;

        uint64 start = uint64(block.number);
        e.status = Status.Active;
        e.operator = operator;
        e.startBlock = start;
        e.endBlock = start + t.termBlocks;
        e.lastObsBlock = start;
        e.refPrice = t.initialPrice;
        e.refBlock = start;
        e.sellWindowStart = start;
        e.windowHoldings = t.loan;
        e.bondLeft = t.bond;

        makerStats[t.maker].engagements++;

        emit Accepted(id, e.account, operator, start, e.endBlock);
    }

    function setOperator(uint256 id, address operator) external {
        Engagement storage e = _engagements[id];
        if (msg.sender != e.terms.maker) revert Unauthorized();
        e.operator = operator;
        emit OperatorSet(id, operator);
    }

    /// @notice Market maker commits to replenishing filled quotes from the post-fill hook.
    function setRefreshPolicy(uint256 id, bool enabled, uint16 offsetTicks) external {
        Engagement storage e = _engagements[id];
        if (msg.sender != e.terms.maker) revert Unauthorized();
        e.refreshEnabled = enabled;
        e.refreshOffsetTicks = offsetTicks;
        emit RefreshPolicySet(id, enabled, offsetTicks);
    }

    /// @notice Registers this contract as the post-fill hook once Kuru has granted the account access.
    function enableHook(uint256 id) external {
        Engagement storage e = _engagements[id];
        if (e.status != Status.Active) revert InvalidStatus();
        e.terms.market.setPostFillHook(e.account, address(this));
        emit HookEnabled(id);
    }

    /// @notice Issuer ends the agreement early after the agreed notice period.
    function terminate(uint256 id) external {
        Engagement storage e = _engagements[id];
        if (msg.sender != e.issuer) revert Unauthorized();
        if (e.status != Status.Active) revert InvalidStatus();
        uint64 end = uint64(block.number) + e.terms.noticeBlocks;
        if (end < e.endBlock) {
            _observe(id);
            e.endBlock = end;
            emit Terminated(id, end);
        }
    }

    // -------------------------------------------------------------------------
    // Quoting
    // -------------------------------------------------------------------------

    /// @notice Places, replaces or cancels quotes. `ops` is a sequence of Kuru packed slot operations.
    function quote(uint256 id, bytes calldata ops) external nonReentrant {
        Engagement storage e = _engagements[id];
        if (msg.sender != e.operator) revert Unauthorized();
        if (e.status != Status.Active) revert InvalidStatus();
        if (block.number >= e.endBlock) revert TermEnded();
        if (ops.length == 0 || ops.length % 32 != 0) revert BadOps();

        _observe(id);

        Slot[MAX_SLOTS] storage slots = _slots[id];
        uint64 mask = e.liveMask;
        uint256 n = ops.length / 32;
        for (uint256 k; k < n; ++k) {
            KuruCodec.SlotOp memory op = KuruCodec.decodeOp(bytes32(ops[k * 32:(k + 1) * 32]));
            if (op.slot >= MAX_SLOTS) revert SlotOutOfRange(op.slot);
            Slot storage s = slots[op.slot];
            uint64 bit = uint64(1) << op.slot;

            if (mask & bit != 0 && block.number < s.placedBlock + e.terms.ob.minQuoteLifeBlocks) {
                revert QuoteTooYoung(op.slot);
            }
            if (KuruCodec.isCancel(op)) {
                mask &= ~bit;
                continue;
            }
            if (op.flags & ~KuruCodec.FLAG_BUY != KuruCodec.FLAG_ALO) revert NotPostOnly(op.slot);
            if (op.minSizeAfterBlock != 0) revert ReduceAfterBlockNotAllowed(op.slot);
            if (!MarketMath.withinBps(op.price, e.refPrice, e.terms.risk.priceBandBps)) {
                revert OutsidePriceBand(op.slot, op.price, e.refPrice);
            }

            s.price = op.price;
            s.size = op.size;
            s.isBuy = KuruCodec.isBuy(op);
            s.orderId = 0;
            s.placedBlock = uint64(block.number);
            mask |= bit;
        }
        e.liveMask = mask;
        _checkSellLimit(id, 0);

        e.terms.market.replaceBySlotPacked(e.account, ops);

        for (uint256 k; k < n; ++k) {
            uint8 index = uint8(ops[k * 32 + 31]);
            if (mask & (uint64(1) << index) == 0) continue;
            uint64 orderId = e.terms.market.getOrderId(e.account, index);
            if (orderId == 0) {
                mask &= ~(uint64(1) << index);
                emit QuoteSkipped(id, index);
            } else {
                slots[index].orderId = orderId;
            }
        }
        e.liveMask = mask;

        _observe(id);
        emit Quoted(id, ops);
    }

    // -------------------------------------------------------------------------
    // Enforcement
    // -------------------------------------------------------------------------

    /// @notice Records the current state of the book. Pays a bounty, once per breach, for reporting a breach
    ///         that has outlasted the grace period. Paying on the first observation would let a taker drain
    ///         the bond by lifting quotes and poking in the same transaction.
    function poke(uint256 id) external nonReentrant returns (bool compliant) {
        Engagement storage e = _engagements[id];
        if (e.status != Status.Active) revert InvalidStatus();
        compliant = _observe(id);
        if (
            !compliant && !e.breachReported && e.nonCompliantSince != 0
                && block.number >= e.nonCompliantSince + e.terms.ob.graceBlocks && block.number < e.endBlock
        ) {
            e.breachReported = true;
            _payBounty(id, msg.sender, e.terms.risk.watchBounty);
        }
    }

    /// @notice Closes the next finished epoch. Consecutive failed epochs make the engagement clawable.
    function closeEpoch(uint256 id) external nonReentrant {
        Engagement storage e = _engagements[id];
        if (e.status != Status.Active) revert InvalidStatus();

        uint32 epoch = e.nextEpoch;
        (uint64 from, uint64 to) = epochBounds(id, epoch);
        if (from >= e.endBlock || block.number < to) revert EpochNotOver();

        _observe(id);

        uint32 credited = epochCredit[id][epoch];
        uint32 length = uint32(to - from);
        bool passed = uint256(credited) * MarketMath.BPS >= uint256(e.terms.ob.uptimeTargetBps) * length;
        e.nextEpoch = epoch + 1;

        if (passed) {
            e.failingStreak = 0;
        } else {
            e.failingStreak++;
            makerStats[e.terms.maker].failedEpochs++;
            _payBounty(id, msg.sender, e.terms.risk.watchBounty);
            if (e.failingStreak >= e.terms.ob.sustainedBreachEpochs) {
                e.status = Status.ClawbackEligible;
                emit ClawbackEligible(id);
            }
        }
        emit EpochClosed(id, epoch, credited, length, passed, e.failingStreak);
    }

    /// @notice Ends a breached engagement: the loan returns to the issuer as passive liquidity on Kuru.
    function clawback(uint256 id) external nonReentrant {
        Engagement storage e = _engagements[id];
        if (e.status != Status.ClawbackEligible) revert InvalidStatus();
        Terms storage t = e.terms;

        e.status = Status.ClawedBack;
        e.endBlock = uint64(block.number);
        Settlement.Output memory r = _close(id, 0);

        uint256 slash = FixedPointMathLib.fullMulDiv(r.bondToMaker, t.risk.breachSlashBps, MarketMath.BPS);
        r.bondToMaker -= slash;
        r.bondToIssuer += slash;
        uint256 bounty = t.risk.clawbackBounty < r.bondToMaker ? t.risk.clawbackBounty : r.bondToMaker;
        r.bondToMaker -= bounty;
        if (bounty > 0) {
            owed[msg.sender][e.quote] += bounty;
            emit BountyPaid(id, msg.sender, bounty);
        }

        uint64 position = _mintBackstop(id, r.issuerBase, r.issuerQuote);
        _distribute(id, r, position != 0);
        makerStats[t.maker].clawbacks++;

        emit ClawedBack(id, msg.sender, r, position);
    }

    /// @notice Settles a matured engagement. During the exercise window only the market maker can settle,
    ///         and may exercise vested options beyond any shortfall.
    function settle(uint256 id, uint256 extraExercise) external nonReentrant {
        Engagement storage e = _engagements[id];
        if (e.status != Status.Active) revert InvalidStatus();
        if (block.number < e.endBlock) revert TermNotEnded();
        if (block.number < e.endBlock + e.terms.exerciseWindowBlocks) {
            if (msg.sender != e.terms.maker) revert Unauthorized();
        } else {
            extraExercise = 0;
        }

        e.status = Status.Settled;
        Settlement.Output memory r = _close(id, extraExercise);
        _distribute(id, r, false);

        emit Settled(id, r);
    }

    function releaseBackstop(uint256 id) external nonReentrant {
        Engagement storage e = _engagements[id];
        if (msg.sender != e.issuer) revert Unauthorized();
        if (e.backstopPosition == 0) revert InvalidStatus();
        if (block.number < e.backstopUnlock) revert BackstopLocked();

        uint64 position = e.backstopPosition;
        e.backstopPosition = 0;
        IKuruOrderBook market = e.terms.market;
        IKuruOrderBook.PassivePositionView memory p = market.getPassivePosition(position);
        (uint128 b, uint128 q, uint128 bf, uint128 qf) =
            market.burnPassiveLiquidity(e.account, position, p.shares);
        uint256 base = uint256(b) + bf;
        uint256 quoteOut = uint256(q) + qf;
        _sweepToRoot(e.account, e.base, base);
        _sweepToRoot(e.account, e.quote, quoteOut);
        kuruOwed[e.issuer][e.base] += base;
        kuruOwed[e.issuer][e.quote] += quoteOut;

        emit BackstopReleased(id, base, quoteOut);
    }

    // -------------------------------------------------------------------------
    // Payouts
    // -------------------------------------------------------------------------

    function claimRetainer(uint256 id) external nonReentrant {
        Engagement storage e = _engagements[id];
        if (msg.sender != e.terms.maker) revert Unauthorized();
        if (e.status == Status.Active) _observe(id);
        uint256 amount = retainerEarned(id) - e.retainerPaid;
        if (amount == 0) revert NothingToClaim();
        e.retainerPaid += amount.toUint128();
        e.quote.safeTransfer(msg.sender, amount);
        emit RetainerClaimed(id, amount);
    }

    /// @notice Pays out everything owed to the caller in `token`. Kuru's withdrawal limiter can hold back the part
    ///         held on Kuru; that part stays owed and can be claimed later, in full or in pieces, with `claimKuru`.
    function claim(address token) external nonReentrant {
        uint256 local = owed[msg.sender][token];
        uint256 onKuru = kuruOwed[msg.sender][token];
        if (local + onKuru == 0) revert NothingToClaim();

        uint256 paid;
        if (local > 0) {
            owed[msg.sender][token] = 0;
            token.safeTransfer(msg.sender, local);
            paid = local;
        }
        if (onKuru > 0) {
            kuruOwed[msg.sender][token] = 0;
            try accountCore.withdraw(rootAccount, token, onKuru, msg.sender) {
                paid += onKuru;
            } catch {
                kuruOwed[msg.sender][token] = onKuru;
                emit KuruWithdrawalDeferred(msg.sender, token, onKuru);
            }
        }
        if (paid == 0) revert KuruWithdrawalBlocked();
        emit Claimed(msg.sender, token, paid);
    }

    /// @notice Withdraws part of what is owed on Kuru, for when the limiter's capacity is below the full amount.
    function claimKuru(address token, uint256 amount) external nonReentrant {
        uint256 onKuru = kuruOwed[msg.sender][token];
        if (amount == 0 || amount > onKuru) revert NothingToClaim();
        kuruOwed[msg.sender][token] = onKuru - amount;
        accountCore.withdraw(rootAccount, token, amount, msg.sender);
        emit Claimed(msg.sender, token, amount);
    }

    // -------------------------------------------------------------------------
    // Post-fill hook
    // -------------------------------------------------------------------------

    /// @inheritdoc IPostFillHook
    function postFill(PostFillContext calldata ctx) external returns (uint256, uint256, uint256) {
        uint256 id = engagementOfAccount[ctx.userId];
        Engagement storage e = _engagements[id];
        if (id == 0 || msg.sender != address(e.terms.market)) revert Unauthorized();

        Slot storage s = _slots[id][ctx.filledSlotIdx];
        uint64 bit = uint64(1) << ctx.filledSlotIdx;
        e.liveMask &= ~bit;

        uint32 price = _refreshPrice(e, s.isBuy, ctx.fillPrice);
        bool replenish = price != 0 && e.status == Status.Active && block.number < e.endBlock;
        if (replenish && !s.isBuy) replenish = _sellHeadroom(id, s.size);

        emit Filled(id, ctx.filledSlotIdx, ctx.fillPrice, s.size, s.isBuy, replenish);
        if (!replenish) return (KuruCodec.HOOK_NOOP, 0, 0);

        s.price = price;
        s.orderId = 0;
        s.placedBlock = uint64(block.number);
        e.liveMask |= bit;
        return (KuruCodec.HOOK_REPLENISH_ONLY, KuruCodec.packHookQuote(price, s.size), 0);
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    function engagement(uint256 id) external view returns (Engagement memory) {
        return _engagements[id];
    }

    function slot(uint256 id, uint8 index) external view returns (Slot memory) {
        return _slots[id][index];
    }

    /// @notice Compliance of the book as it stands now, without recording it.
    function metrics(uint256 id) external view returns (Metrics memory) {
        return _evaluate(id);
    }

    function vested(uint256 id) public view returns (uint256) {
        Engagement storage e = _engagements[id];
        return FixedPointMathLib.fullMulDiv(e.terms.options, e.creditedBlocks, e.terms.termBlocks);
    }

    function retainerEarned(uint256 id) public view returns (uint256) {
        Engagement storage e = _engagements[id];
        return FixedPointMathLib.fullMulDiv(e.terms.retainer, e.creditedBlocks, e.terms.termBlocks);
    }

    function epochBounds(uint256 id, uint32 epoch) public view returns (uint64 from, uint64 to) {
        Engagement storage e = _engagements[id];
        uint64 len = e.terms.ob.epochBlocks;
        from = e.startBlock + uint64(epoch) * len;
        to = from + len;
        if (to > e.endBlock) to = e.endBlock;
    }

    /// @notice Net base sold in the current sell window, in raw atoms.
    function netSold(uint256 id) public view returns (uint256) {
        Engagement storage e = _engagements[id];
        uint256 holdings = _baseHoldings(e);
        return e.windowHoldings > holdings ? e.windowHoldings - holdings : 0;
    }

    // -------------------------------------------------------------------------
    // Ledger
    // -------------------------------------------------------------------------

    /// @dev Credits the interval since the last observation only if the book was compliant at both ends.
    ///      Depth can only rise through this contract, and every fill that removes a slot runs the hook, so a
    ///      dip between observations can only come from a partial fill and is caught at the next one.
    function _observe(uint256 id) internal returns (bool compliant) {
        Engagement storage e = _engagements[id];
        _prune(id);
        _updateReference(e);
        _rollSellWindow(e);

        Metrics memory m = _evaluate(id);
        compliant = m.compliant;

        uint64 last = e.lastObsBlock;
        uint64 now_ = uint64(block.number) < e.endBlock ? uint64(block.number) : e.endBlock;
        uint64 credited;
        if (now_ > last) {
            if (e.lastCompliant && compliant) {
                credited = now_ - last;
                if (credited > e.terms.ob.maxCreditBlocks) credited = e.terms.ob.maxCreditBlocks;
                _credit(id, last, last + credited);
            }
            e.lastObsBlock = now_;
        }

        if (compliant != e.lastCompliant) {
            e.lastCompliant = compliant;
            e.nonCompliantSince = compliant ? 0 : uint64(block.number);
            if (compliant) e.breachReported = false;
            emit ComplianceChanged(id, compliant);
        }
        emit Observed(id, compliant, credited, m.refPrice, m.bestBid, m.bestAsk, m.bidDepth, m.askDepth);
    }

    function _credit(uint256 id, uint64 from, uint64 to) internal {
        Engagement storage e = _engagements[id];
        uint64 len = e.terms.ob.epochBlocks;
        e.creditedBlocks += to - from;
        while (from < to) {
            uint64 epoch = (from - e.startBlock) / len;
            uint64 epochEnd = e.startBlock + (epoch + 1) * len;
            uint64 upto = to < epochEnd ? to : epochEnd;
            epochCredit[id][epoch] += uint32(upto - from);
            from = upto;
        }
    }

    function _evaluate(uint256 id) internal view returns (Metrics memory m) {
        Engagement storage e = _engagements[id];
        Terms storage t = e.terms;
        IKuruOrderBook market = t.market;

        m.refPrice = e.refPrice;
        m.allowedSpreadBps = e.volatile ? t.ob.volatileSpreadBps : t.ob.maxSpreadBps;
        if (market.marketState() != KuruCodec.MARKET_ACTIVE) {
            m.compliant = true;
            m.suspended = true;
            return m;
        }

        Slot[MAX_SLOTS] storage slots = _slots[id];
        uint256 outsideBidQuote;
        uint256 outsideAskBase;
        uint64 mask = e.liveMask;
        while (mask != 0) {
            uint8 i = _lowestBit(mask);
            mask &= mask - 1;
            Slot storage s = slots[i];
            if (market.getOrderId(e.account, i) == 0) continue;
            if (!MarketMath.withinBps(s.price, m.refPrice, t.ob.depthBandBps)) {
                if (s.isBuy) outsideBidQuote += e.units.quoteForSize(s.size, s.price);
                else outsideAskBase += e.units.baseAtoms(s.size);
            } else if (s.isBuy) {
                if (s.price > m.bestBid) m.bestBid = s.price;
            } else if (m.bestAsk == 0 || s.price < m.bestAsk) {
                m.bestAsk = s.price;
            }
        }

        (uint256 baseReserved, uint256 quoteReserved) = market.makerLockedReserves(e.account);
        uint256 bidQuote = FixedPointMathLib.fullMulDiv(
            quoteReserved, FEE_DENOMINATOR, FEE_DENOMINATOR + market.makerFeePps()
        );
        m.bidDepth = bidQuote > outsideBidQuote ? bidQuote - outsideBidQuote : 0;
        uint256 askBase = baseReserved > outsideAskBase ? baseReserved - outsideAskBase : 0;
        m.askDepth = e.units.quoteFor(askBase, m.refPrice);

        if (m.bestBid == 0 || m.bestAsk == 0) return m;
        m.spreadBps = MarketMath.spreadBps(m.bestBid, m.bestAsk, m.refPrice);
        m.compliant = m.spreadBps <= m.allowedSpreadBps && m.bidDepth >= t.ob.minBidDepth
            && m.askDepth >= t.ob.minAskDepth;
    }

    /// @dev Drops slots Kuru no longer holds and adopts order ids assigned by hook replenishment.
    function _prune(uint256 id) internal {
        Engagement storage e = _engagements[id];
        Slot[MAX_SLOTS] storage slots = _slots[id];
        uint64 mask = e.liveMask;
        uint64 live = mask;
        while (mask != 0) {
            uint8 i = _lowestBit(mask);
            mask &= mask - 1;
            uint64 orderId = e.terms.market.getOrderId(e.account, i);
            if (orderId == 0) live &= ~(uint64(1) << i);
            else if (slots[i].orderId != orderId) slots[i].orderId = orderId;
        }
        e.liveMask = live;
    }

    /// @dev Moves the reference toward the external source, or the book mid, by at most `maxRefStepBps`
    ///      per block. A sample further away than `volatilityTriggerBps` switches to the volatile spread.
    function _updateReference(Engagement storage e) internal {
        uint256 elapsed = block.number - e.refBlock;
        if (elapsed == 0) return;
        e.refBlock = uint64(block.number);

        uint256 sample = _sampleReference(e);
        if (sample == 0) return;

        uint256 ref = e.refPrice;
        uint256 diff = sample > ref ? sample - ref : ref - sample;
        e.volatile = diff * MarketMath.BPS > ref * e.terms.ob.volatilityTriggerBps;

        uint256 maxStep =
            FixedPointMathLib.fullMulDiv(ref, e.terms.risk.maxRefStepBps * elapsed, MarketMath.BPS);
        if (diff > maxStep) diff = maxStep;
        uint256 next = sample > ref ? ref + diff : ref - diff;
        uint256 tick = e.units.tickSize;
        next = next / tick * tick;
        if (next == 0) next = tick;
        e.refPrice = next.toUint32();
    }

    function _sampleReference(Engagement storage e) internal view returns (uint256) {
        IPriceSource src = e.terms.risk.priceSource;
        if (address(src) != address(0)) {
            try src.latestPrice() returns (uint32 price, uint64 updatedAt) {
                if (price != 0 && block.timestamp <= updatedAt + e.terms.risk.maxPriceAge) return price;
            } catch {}
        }
        (uint32 bid, uint32 ask) = e.terms.market.bestBidAsk();
        if (bid == KuruCodec.EMPTY_BID || ask == KuruCodec.EMPTY_ASK || ask <= bid) return 0;
        return (uint256(bid) + ask) / 2;
    }

    function _rollSellWindow(Engagement storage e) internal {
        uint64 window = e.terms.risk.sellWindowBlocks;
        if (block.number < e.sellWindowStart + window) return;
        uint64 elapsedWindows = (uint64(block.number) - e.sellWindowStart) / window;
        e.sellWindowStart += elapsedWindows * window;
        e.windowHoldings = _baseHoldings(e);
    }

    /// @dev Reverts if every resting ask filling, plus `extra` base, would exceed the window's sell limit.
    function _checkSellLimit(uint256 id, uint256 extra) internal view {
        Engagement storage e = _engagements[id];
        uint256 exposure = netSold(id) + _askExposure(id) + extra;
        if (exposure > e.terms.risk.maxNetSell) revert SellLimitExceeded(exposure, e.terms.risk.maxNetSell);
    }

    function _sellHeadroom(uint256 id, uint96 size) internal view returns (bool) {
        Engagement storage e = _engagements[id];
        return netSold(id) + _askExposure(id) + e.units.baseAtoms(size) <= e.terms.risk.maxNetSell;
    }

    function _askExposure(uint256 id) internal view returns (uint256 atoms) {
        Engagement storage e = _engagements[id];
        Slot[MAX_SLOTS] storage slots = _slots[id];
        uint64 mask = e.liveMask;
        while (mask != 0) {
            uint8 i = _lowestBit(mask);
            mask &= mask - 1;
            if (!slots[i].isBuy) atoms += e.units.baseAtoms(slots[i].size);
        }
    }

    function _baseHoldings(Engagement storage e) internal view returns (uint256) {
        if (e.account == 0) return 0;
        (uint256 baseReserved,) = e.terms.market.makerLockedReserves(e.account);
        return accountCore.getBalance(e.account, e.base) + baseReserved;
    }

    function _refreshPrice(Engagement storage e, bool isBuy, uint32 fillPrice)
        internal
        view
        returns (uint32)
    {
        if (!e.refreshEnabled) return 0;
        uint256 offset = uint256(e.refreshOffsetTicks) * e.units.tickSize;
        uint256 price = isBuy ? (fillPrice > offset ? fillPrice - offset : 0) : fillPrice + offset;
        if (price == 0 || price > type(uint32).max) return 0;
        if (!MarketMath.withinBps(price, e.refPrice, e.terms.risk.priceBandBps)) return 0;
        return uint32(price);
    }

    // -------------------------------------------------------------------------
    // Settlement internals
    // -------------------------------------------------------------------------

    function _close(uint256 id, uint256 extraExercise) internal returns (Settlement.Output memory r) {
        Engagement storage e = _engagements[id];
        Terms storage t = e.terms;

        _observe(id);
        t.market.cancelAllOrders(e.account);
        e.liveMask = 0;

        r = Settlement.compute(
            e.units,
            Settlement.Input({
                loan: t.loan,
                baseHeld: accountCore.getBalance(e.account, e.base),
                quoteHeld: accountCore.getBalance(e.account, e.quote),
                vested: vested(id),
                extraExercise: extraExercise,
                strike: t.strike,
                refPrice: e.refPrice,
                penaltyBps: t.risk.penaltyBps,
                bond: e.bondLeft
            })
        );
        e.bondLeft = 0;

        MakerStats storage stats = makerStats[t.maker];
        stats.creditedBlocks += e.creditedBlocks;
        stats.termBlocks += e.endBlock - e.startBlock;
        if (r.deficit > 0) stats.defaults++;
    }

    /// @dev Routes settlement output to claimable balances. Issuer inventory already minted into a
    ///      backstop position stays in the account.
    function _distribute(uint256 id, Settlement.Output memory r, bool issuerInBackstop) internal {
        Engagement storage e = _engagements[id];
        address issuer = e.issuer;
        address maker = e.terms.maker;

        uint256 makerBase = r.makerBase;
        uint256 makerQuote = r.makerQuote;
        uint256 issuerBase = issuerInBackstop ? 0 : r.issuerBase;
        uint256 issuerQuote = issuerInBackstop ? 0 : r.issuerQuote;

        _sweepToRoot(e.account, e.base, makerBase + issuerBase);
        _sweepToRoot(e.account, e.quote, makerQuote + issuerQuote);
        kuruOwed[maker][e.base] += makerBase;
        kuruOwed[maker][e.quote] += makerQuote;
        kuruOwed[issuer][e.base] += issuerBase;
        kuruOwed[issuer][e.quote] += issuerQuote;

        owed[maker][e.quote] += r.bondToMaker;
        owed[issuer][e.quote] += r.bondToIssuer;

        uint256 earned = retainerEarned(id);
        owed[maker][e.quote] += earned - e.retainerPaid;
        owed[issuer][e.quote] += e.terms.retainer - earned;
        e.retainerPaid = earned.toUint128();
    }

    /// @dev Places the issuer's recovered inventory in a passive band around the reference. Legs that would
    ///      cross the book are clipped by Kuru; whatever is not used stays claimable by the issuer.
    function _mintBackstop(uint256 id, uint256 base, uint256 quoteAmount) internal returns (uint64 position) {
        Engagement storage e = _engagements[id];
        IKuruOrderBook market = e.terms.market;
        uint256 width = uint256(market.passiveSpreadTicks()) * e.units.tickSize;
        if (width == 0 || (base == 0 && quoteAmount == 0)) return 0;
        uint256 low = e.refPrice / width * width;
        if (low == 0) low = width;

        IKuruOrderBook.PassiveMintParams[] memory mints = new IKuruOrderBook.PassiveMintParams[](1);
        mints[0] = IKuruOrderBook.PassiveMintParams({
            lowPrice: low.toUint32(),
            baseAmount: base.toUint128(),
            quoteAmount: quoteAmount.toUint128(),
            minSharesOut: 0
        });
        try market.batchMintPassiveLiquidity(e.account, mints, uint64(block.timestamp)) returns (
            IKuruOrderBook.PassiveMintResult[] memory results
        ) {
            if (results.length == 1 && results[0].sharesOut > 0) {
                position = results[0].positionId;
                base -= results[0].baseUsed;
                quoteAmount -= results[0].quoteUsed;
                e.backstopPosition = position;
                e.backstopUnlock = uint64(block.number) + e.terms.risk.backstopLockBlocks;
            }
        } catch {}

        _sweepToRoot(e.account, e.base, base);
        _sweepToRoot(e.account, e.quote, quoteAmount);
        kuruOwed[e.issuer][e.base] += base;
        kuruOwed[e.issuer][e.quote] += quoteAmount;
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    function _openAccount(address base, address quote_, uint256 loan, uint256 collateral)
        internal
        returns (uint40 account)
    {
        _deposit(base, loan);
        _deposit(quote_, collateral);
        if (rootAccount == 0) rootAccount = accountCore.rootAccountIdOf(address(this));
        account = accountCore.createSubaccount(address(this));
        if (loan > 0) accountCore.transferBetweenAccounts(rootAccount, account, base, loan);
        if (collateral > 0) accountCore.transferBetweenAccounts(rootAccount, account, quote_, collateral);
    }

    function _deposit(address token, uint256 amount) internal {
        if (amount == 0) return;
        token.safeApprove(address(accountCore), amount);
        accountCore.deposit(address(this), token, amount);
    }

    function _sweepToRoot(uint40 account, address token, uint256 amount) internal {
        if (amount > 0) accountCore.transferBetweenAccounts(account, rootAccount, token, amount);
    }

    function _payBounty(uint256 id, address to, uint256 amount) internal {
        Engagement storage e = _engagements[id];
        if (amount > e.bondLeft) amount = e.bondLeft;
        if (amount == 0) return;
        e.bondLeft -= amount.toUint128();
        owed[to][e.quote] += amount;
        emit BountyPaid(id, to, amount);
    }

    function _lowestBit(uint64 mask) internal pure returns (uint8) {
        return uint8(FixedPointMathLib.log2(mask & (~mask + 1)));
    }

    function _validate(Terms calldata t) internal view {
        Obligations calldata ob = t.ob;
        Risk calldata rk = t.risk;
        bool ok = address(t.market) != address(0) && accountCore.verifiedSpotOrderBook(address(t.market))
            && t.maker != address(0) && t.loan > 0 && t.options <= t.loan && t.initialPrice > 0
            && t.termBlocks > 0 && ob.epochBlocks > 0 && ob.epochBlocks <= t.termBlocks
            && ob.maxCreditBlocks > 0 && ob.uptimeTargetBps <= MarketMath.BPS && ob.sustainedBreachEpochs > 0
            && ob.volatileSpreadBps >= ob.maxSpreadBps && rk.priceBandBps > 0 && rk.sellWindowBlocks > 0
            && rk.breachSlashBps <= MarketMath.BPS;
        if (!ok) revert InvalidTerms();
    }
}
