// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";

/// @dev Ledger-only stand-in for Kuru AccountCore: roots, subaccounts, free and reserved balances.
contract MockAccountCore {
    using SafeTransferLib for address;

    uint40 public nextId;
    mapping(uint40 => address) public ownerOf;
    mapping(uint40 => uint40) public rootOf;
    mapping(address => uint40) public rootAccountIdOf;
    mapping(uint40 => mapping(address => uint256)) public free;
    mapping(uint40 => mapping(address => uint256)) public reserved;
    mapping(uint40 => bool) public postFillHookAccess;
    mapping(address => bool) public verifiedSpotOrderBook;

    bool public withdrawalsFrozen;

    error Unauthorized();
    error Insufficient();
    error Frozen();

    modifier onlyBook() {
        if (!verifiedSpotOrderBook[msg.sender]) revert Unauthorized();
        _;
    }

    function setWithdrawalsFrozen(bool frozen) external {
        withdrawalsFrozen = frozen;
    }

    function registerBook(address book) external {
        verifiedSpotOrderBook[book] = true;
    }

    function setPostFillHookAccess(uint40 account, bool allowed) external {
        postFillHookAccess[account] = allowed;
    }

    function deposit(address rootOwner, address token, uint256 amount) external payable {
        uint40 root = rootAccountIdOf[rootOwner];
        if (root == 0) {
            root = ++nextId;
            rootAccountIdOf[rootOwner] = root;
            ownerOf[root] = rootOwner;
            rootOf[root] = root;
        }
        token.safeTransferFrom(msg.sender, address(this), amount);
        free[root][token] += amount;
    }

    function createSubaccount(address rootOwner) external returns (uint40 id) {
        uint40 root = rootAccountIdOf[rootOwner];
        if (root == 0 || msg.sender != rootOwner) revert Unauthorized();
        id = ++nextId;
        ownerOf[id] = rootOwner;
        rootOf[id] = root;
    }

    function transferBetweenAccounts(uint40 from, uint40 to, address token, uint256 amount) external {
        if (!isOwner(from, msg.sender) || rootOf[from] != rootOf[to]) revert Unauthorized();
        _debit(from, token, amount);
        free[to][token] += amount;
    }

    function withdraw(uint40 root, address token, uint256 amount, address recipient) external {
        if (rootOf[root] != root || !isOwner(root, msg.sender)) revert Unauthorized();
        if (withdrawalsFrozen) revert Frozen();
        _debit(root, token, amount);
        token.safeTransfer(recipient, amount);
    }

    function getAccountRootId(uint40 account) external view returns (uint40) {
        return rootOf[account];
    }

    function getBalance(uint40 account, address token) external view returns (uint256) {
        return free[account][token];
    }

    function getSpotReservedBalance(uint40 account, address token) external view returns (uint256) {
        return reserved[account][token];
    }

    function spotTokenEnabled(address) external pure returns (bool) {
        return true;
    }

    function isOwner(uint40 account, address who) public view returns (bool) {
        return ownerOf[rootOf[account]] == who;
    }

    // --- book-facing ---

    function reserve(uint40 account, address token, uint256 amount) external onlyBook {
        _debit(account, token, amount);
        reserved[account][token] += amount;
    }

    function release(uint40 account, address token, uint256 amount) external onlyBook {
        reserved[account][token] -= amount;
        free[account][token] += amount;
    }

    function consumeReserve(uint40 account, address token, uint256 amount, address to) external onlyBook {
        reserved[account][token] -= amount;
        token.safeTransfer(to, amount);
    }

    function credit(uint40 account, address token, uint256 amount) external onlyBook {
        free[account][token] += amount;
    }

    function lock(uint40 account, address token, uint256 amount) external onlyBook {
        _debit(account, token, amount);
    }

    function _debit(uint40 account, address token, uint256 amount) internal {
        if (free[account][token] < amount) revert Insufficient();
        free[account][token] -= amount;
    }
}
