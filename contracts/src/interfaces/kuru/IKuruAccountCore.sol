// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice Subset of the Kuru Spot V2 AccountCore used by Covenant.
interface IKuruAccountCore {
    event SubaccountCreated(
        uint40 indexed rootAccountId, uint40 indexed subaccountId, address indexed authorizer
    );

    function deposit(address rootOwner, address token, uint256 amount) external payable;
    function deposit(uint40 rootAccountId, address token, uint256 amount) external payable;
    function withdraw(uint40 rootAccountId, address token, uint256 amount, address recipient) external;
    function transferBetweenAccounts(uint40 fromAccountId, uint40 toAccountId, address token, uint256 amount)
        external;
    function createSubaccount(address rootOwner) external returns (uint40 subaccountId);

    function rootAccountIdOf(address owner) external view returns (uint40);
    function getAccountRootId(uint40 accountId) external view returns (uint40);
    function getBalance(uint40 accountId, address token) external view returns (uint256);
    function getSpotReservedBalance(uint40 accountId, address token) external view returns (uint256);
    function postFillHookAccess(uint40 accountId) external view returns (bool);
    function setPostFillHookAccess(uint40 accountId, bool allowed) external;
    function verifiedSpotOrderBook(address market) external view returns (bool);
    function spotTokenEnabled(address token) external view returns (bool);
}
