// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {Covenant} from "../src/Covenant.sol";
import {IKuruAccountCore} from "../src/interfaces/kuru/IKuruAccountCore.sol";
import {IKuruOrderBook} from "../src/interfaces/kuru/IKuruOrderBook.sol";
import {IPriceSource} from "../src/interfaces/IPriceSource.sol";
import {KuruCodec} from "../src/libraries/KuruCodec.sol";
import {MockAccountCore} from "./mocks/MockAccountCore.sol";
import {MockOrderBook} from "./mocks/MockOrderBook.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

abstract contract CovenantBase is Test {
    uint32 internal constant PRICE = 200_000; // 2,000.00 quote per base
    uint96 internal constant ONE = 1e10; // one base token in size units

    MockAccountCore internal core;
    MockOrderBook internal book;
    MockERC20 internal base;
    MockERC20 internal usdc;
    Covenant internal covenant;

    address internal issuer = makeAddr("issuer");
    address internal maker = makeAddr("maker");
    address internal operator = makeAddr("operator");
    address internal watcher = makeAddr("watcher");
    address internal taker = makeAddr("taker");

    function setUp() public virtual {
        vm.roll(1000);
        base = new MockERC20("Launch", "LAUNCH", 18);
        usdc = new MockERC20("USD Coin", "USDC", 6);
        core = new MockAccountCore();
        book = new MockOrderBook(core, address(base), address(usdc), ONE, 100, 1, 18, 6);
        core.registerBook(address(book));
        book.setExternalQuotes(199_000, 201_000);
        covenant = new Covenant(IKuruAccountCore(address(core)));

        base.mint(issuer, 1000e18);
        usdc.mint(issuer, 1_000_000e6);
        usdc.mint(maker, 1_000_000e6);
        base.mint(taker, 1000e18);
        usdc.mint(taker, 10_000_000e6);

        vm.prank(issuer);
        base.approve(address(covenant), type(uint256).max);
        vm.prank(issuer);
        usdc.approve(address(covenant), type(uint256).max);
        vm.prank(maker);
        usdc.approve(address(covenant), type(uint256).max);
        vm.prank(taker);
        base.approve(address(book), type(uint256).max);
        vm.prank(taker);
        usdc.approve(address(book), type(uint256).max);
    }

    function defaultTerms() internal view returns (Covenant.Terms memory t) {
        t.market = IKuruOrderBook(address(book));
        t.maker = maker;
        t.loan = 100e18;
        t.makerCollateral = 200_000e6;
        t.bond = 10_000e6;
        t.options = 50e18;
        t.retainer = 30_000e6;
        t.strike = 210_000;
        t.initialPrice = PRICE;
        t.termBlocks = 100_000;
        t.noticeBlocks = 5000;
        t.exerciseWindowBlocks = 1000;
        t.ob = Covenant.Obligations({
            maxSpreadBps: 100,
            depthBandBps: 200,
            uptimeTargetBps: 9500,
            sustainedBreachEpochs: 3,
            volatileSpreadBps: 300,
            volatilityTriggerBps: 200,
            epochBlocks: 1000,
            maxCreditBlocks: 150,
            minQuoteLifeBlocks: 3,
            graceBlocks: 25,
            minBidDepth: 20_000e6,
            minAskDepth: 20_000e6
        });
        t.risk = Covenant.Risk({
            priceBandBps: 500,
            maxRefStepBps: 5,
            penaltyBps: 1000,
            breachSlashBps: 5000,
            sellWindowBlocks: 10_000,
            backstopLockBlocks: 1000,
            maxNetSell: 20e18,
            watchBounty: 10e6,
            clawbackBounty: 100e6,
            priceSource: IPriceSource(address(0)),
            maxPriceAge: 0
        });
        t.termsHash = keccak256("master agreement v1");
    }

    function open() internal returns (uint256 id) {
        return open(defaultTerms());
    }

    function open(Covenant.Terms memory t) internal returns (uint256 id) {
        vm.prank(issuer);
        id = covenant.propose(t);
        vm.prank(maker);
        covenant.accept(id, operator);
    }

    function account(uint256 id) internal view returns (uint40) {
        return covenant.engagement(id).account;
    }

    // --- quote building ---

    function op(uint8 slot, bool isBuy, uint32 price, uint96 size) internal pure returns (bytes32) {
        uint8 flags = KuruCodec.FLAG_ALO | (isBuy ? KuruCodec.FLAG_BUY : 0);
        return KuruCodec.encodeOp(KuruCodec.SlotOp(slot, flags, price, size, 0));
    }

    function cancelOp(uint8 slot) internal pure returns (bytes32) {
        return KuruCodec.encodeOp(KuruCodec.SlotOp(slot, 0, 0, 0, 0));
    }

    /// @dev Three bids and three asks of 4 base each within 0.5% of 2,000.
    function ladder() internal pure returns (bytes memory) {
        return abi.encodePacked(
            op(0, true, 199_800, 4 * ONE),
            op(1, true, 199_500, 4 * ONE),
            op(2, true, 199_000, 4 * ONE),
            op(32, false, 200_200, 4 * ONE),
            op(33, false, 200_500, 4 * ONE),
            op(34, false, 201_000, 4 * ONE)
        );
    }

    function quote(uint256 id, bytes memory ops) internal {
        vm.prank(operator);
        covenant.quote(id, ops);
    }

    /// @dev Reads the block through the cheatcode; via-ir may reuse a cached `block.number` after a roll.
    function advance(uint256 blocks) internal {
        vm.roll(vm.getBlockNumber() + blocks);
    }
}
