// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IKuruAccountCore} from "../../src/interfaces/kuru/IKuruAccountCore.sol";
import {IKuruOrderBook} from "../../src/interfaces/kuru/IKuruOrderBook.sol";

/// @dev Monad testnet deployment, verified at block 66669731 (29 Sep 2026).
library KuruTestnet {
    IKuruAccountCore internal constant ACCOUNT_CORE =
        IKuruAccountCore(0xdbaaDe7B42c95399bb1E9614D51B5B9e2cf78038);
    address internal constant SPOT_ROUTER = 0xf75A7529b83941e001d7D9bc113A73C92112947E;
    address internal constant PROTOCOL_AUTHORITY = 0xE3dea12b5141e42626A59d538E0e8A49620d657f;
    address internal constant GOVERNANCE = 0xc64346f7dDc776B34EAa44C0B61D564797038143;

    address internal constant USDC = 0xA402B424f392EAA05DBc8779e4502A1F6A96fEF1;
    address internal constant XAUT = 0x7553b18A8c8400a1b7746C1F5b4f453D57555838;
    address internal constant WETH = 0x63c84e18184021c6CcE5ea57d0c3Ec0E65f3b303;

    IKuruOrderBook internal constant XAUT_USDC = IKuruOrderBook(0x0E2A5D9378fB61B8eC100Bd770c449F6fdD3e4d6);
    IKuruOrderBook internal constant WETH_USDC = IKuruOrderBook(0x9d187971B64505Ac81f12c5FD2ac9c5247Ec62F3);
}
