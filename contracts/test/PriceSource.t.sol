// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Covenant} from "../src/Covenant.sol";
import {IPriceSource} from "../src/interfaces/IPriceSource.sol";
import {ChainlinkPriceSource, IAggregatorV3} from "../src/oracles/ChainlinkPriceSource.sol";
import {CovenantBase} from "./CovenantBase.t.sol";
import {MockAggregator} from "./mocks/MockAggregator.sol";

contract PriceSourceTest is CovenantBase {
    MockAggregator internal aggregator;
    ChainlinkPriceSource internal source;

    function setUp() public override {
        super.setUp();
        vm.warp(1_800_000_000);
        aggregator = new MockAggregator(8);
        source = new ChainlinkPriceSource(IAggregatorV3(address(aggregator)), 100, 1);
    }

    function test_convertsFeedToKuruUnits() public {
        aggregator.set(2000.4567e8, block.timestamp);
        (uint32 price, uint64 updatedAt) = source.latestPrice();
        assertEq(price, 200_045);
        assertEq(updatedAt, block.timestamp);
    }

    function test_roundsDownToTick() public {
        ChainlinkPriceSource coarse = new ChainlinkPriceSource(IAggregatorV3(address(aggregator)), 100, 50);
        aggregator.set(2000.4567e8, block.timestamp);
        (uint32 price,) = coarse.latestPrice();
        assertEq(price, 200_000);
    }

    function test_badAnswersReadAsZero() public {
        aggregator.set(-1, block.timestamp);
        (uint32 price,) = source.latestPrice();
        assertEq(price, 0);
        aggregator.set(type(int256).max / 1e18, block.timestamp);
        (price,) = source.latestPrice();
        assertEq(price, 0);
    }

    function test_referenceFollowsFreshFeed() public {
        Covenant.Terms memory t = defaultTerms();
        t.risk.priceSource = IPriceSource(address(source));
        t.risk.maxPriceAge = 60;
        uint256 id = open(t);

        // The book mid stays at 2,000 while the feed says 2,010.
        aggregator.set(2010e8, block.timestamp);
        advance(10);
        covenant.poke(id);
        assertEq(covenant.engagement(id).refPrice, 201_000);
    }

    function test_staleFeedFallsBackToBook() public {
        Covenant.Terms memory t = defaultTerms();
        t.risk.priceSource = IPriceSource(address(source));
        t.risk.maxPriceAge = 60;
        uint256 id = open(t);

        aggregator.set(2100e8, block.timestamp - 61);
        book.setExternalQuotes(199_000, 202_000);
        advance(10);
        covenant.poke(id);
        assertEq(covenant.engagement(id).refPrice, 200_500);
    }
}
