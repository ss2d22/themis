// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {Covenant} from "../../src/Covenant.sol";
import {KuruCodec} from "../../src/libraries/KuruCodec.sol";
import {CovenantBase} from "../CovenantBase.t.sol";
import {MockOrderBook} from "../mocks/MockOrderBook.sol";

/// @dev Drives one live engagement through random quoting, fills, time and enforcement calls.
contract Handler is Test {
    Covenant internal covenant;
    MockOrderBook internal book;
    uint256 internal id;
    uint40 internal account;
    address internal operator;
    address internal taker;
    uint256 public block_;

    constructor(Covenant covenant_, MockOrderBook book_, uint256 id_, address operator_, address taker_) {
        covenant = covenant_;
        book = book_;
        id = id_;
        account = covenant.engagement(id).account;
        operator = operator_;
        taker = taker_;
        block_ = block.number;
    }

    function quote(uint8 slot, bool isBuy, uint256 offsetBps, uint96 size, bool postOnly, bool rab) external {
        slot = uint8(bound(slot, 0, 61));
        uint256 ref = covenant.engagement(id).refPrice;
        offsetBps = bound(offsetBps, 1, 800);
        uint256 price = isBuy ? ref - ref * offsetBps / 10_000 : ref + ref * offsetBps / 10_000;
        size = uint96(bound(size, 1e8, 6e10));
        uint8 flags = (postOnly ? KuruCodec.FLAG_ALO : 0) | (isBuy ? KuruCodec.FLAG_BUY : 0);
        bytes32 word = KuruCodec.encodeOp(
            KuruCodec.SlotOp(slot, flags, uint32(price), size, rab ? uint32(block_ + 5) : 0)
        );
        vm.prank(operator);
        try covenant.quote(id, abi.encodePacked(word)) {} catch {}
    }

    function cancel(uint8 slot) external {
        slot = uint8(bound(slot, 0, 61));
        vm.prank(operator);
        try covenant.quote(id, abi.encodePacked(KuruCodec.encodeOp(KuruCodec.SlotOp(slot, 0, 0, 0, 0)))) {}
            catch {}
    }

    function fill(uint8 slot, uint256 fraction) external {
        slot = uint8(bound(slot, 0, 61));
        Covenant.Slot memory s = covenant.slot(id, slot);
        if (book.getOrderId(account, slot) == 0) return;
        fraction = bound(fraction, 1, 100);
        uint96 size = uint96(uint256(s.size) * fraction / 100);
        if (size == 0) return;
        try book.fill(account, slot, size, taker) {} catch {}
    }

    function advance(uint256 blocks) external {
        block_ += bound(blocks, 1, 400);
        vm.roll(block_);
    }

    function poke() external {
        try covenant.poke(id) {} catch {}
    }

    function closeEpoch() external {
        try covenant.closeEpoch(id) {} catch {}
    }
}

contract CovenantInvariantsTest is CovenantBase {
    Handler internal handler;
    uint256 internal id;
    uint40 internal escrowAccount;

    function setUp() public override {
        super.setUp();
        Covenant.Terms memory t = defaultTerms();
        t.termBlocks = 20_000;
        id = open(t);
        escrowAccount = covenant.engagement(id).account;
        core.setPostFillHookAccess(escrowAccount, true);
        covenant.enableHook(id);
        vm.prank(maker);
        covenant.setRefreshPolicy(id, true, 20);

        handler = new Handler(covenant, book, id, operator, taker);
        targetContract(address(handler));
    }

    /// Credit can never exceed the blocks that have actually passed within the term.
    function invariant_creditBoundedByElapsedTime() public view {
        Covenant.Engagement memory e = covenant.engagement(id);
        uint256 head = handler.block_() < e.endBlock ? handler.block_() : e.endBlock;
        assertLe(e.creditedBlocks, head - e.startBlock);
    }

    /// Per-epoch credit always sums to the total.
    function invariant_epochCreditSumsToTotal() public view {
        Covenant.Engagement memory e = covenant.engagement(id);
        uint256 sum;
        uint32 epochs = uint32((e.terms.termBlocks + e.terms.ob.epochBlocks - 1) / e.terms.ob.epochBlocks);
        for (uint32 epoch; epoch < epochs; ++epoch) {
            sum += covenant.epochCredit(id, epoch);
        }
        assertEq(sum, e.creditedBlocks);
    }

    function invariant_vestingWithinGrant() public view {
        Covenant.Engagement memory e = covenant.engagement(id);
        assertLe(covenant.vested(id), e.terms.options);
        assertLe(covenant.retainerEarned(id), e.terms.retainer);
        assertLe(e.bondLeft, e.terms.bond);
    }

    /// Only post-only orders without reduce-after-block ever reach the book.
    function invariant_onlySafeOrdersReachKuru() public view {
        assertEq(book.unsafePlacements(escrowAccount), 0);
    }

    /// Base already sold plus base still resting in asks never exceeds the window's sell limit, so even if every
    /// ask filled the maker could not sell more than agreed.
    function invariant_sellLimitHolds() public view {
        Covenant.Engagement memory e = covenant.engagement(id);
        (uint256 restingBase,) = book.makerLockedReserves(escrowAccount);
        assertLe(covenant.netSold(id) + restingBase, e.terms.risk.maxNetSell);
    }
}
