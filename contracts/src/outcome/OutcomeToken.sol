// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC20} from "solady/tokens/ERC20.sol";

/// @notice One side of a covenant outcome. Minted and burned only by its market.
contract OutcomeToken is ERC20 {
    address public immutable market;
    uint8 internal immutable _decimals;
    string internal _name;
    string internal _symbol;

    error OnlyMarket();

    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
        market = msg.sender;
        _name = name_;
        _symbol = symbol_;
        _decimals = decimals_;
    }

    modifier onlyMarket() {
        if (msg.sender != market) revert OnlyMarket();
        _;
    }

    function name() public view override returns (string memory) {
        return _name;
    }

    function symbol() public view override returns (string memory) {
        return _symbol;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external onlyMarket {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyMarket {
        _burn(from, amount);
    }
}
