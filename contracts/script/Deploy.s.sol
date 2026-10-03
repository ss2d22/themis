// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {Covenant} from "../src/Covenant.sol";
import {IKuruAccountCore} from "../src/interfaces/kuru/IKuruAccountCore.sol";
import {OutcomeMarket} from "../src/outcome/OutcomeMarket.sol";

/// @notice Deploys the escrow and outcome market against Kuru AccountCore.
/// @dev forge script script/Deploy.s.sol --rpc-url monad_testnet --broadcast
///      Set DEPLOYMENT_FILE to write somewhere other than deployments/<chainId>.json, e.g. for a local fork.
contract Deploy is Script {
    address internal constant TESTNET_ACCOUNT_CORE = 0xdbaaDe7B42c95399bb1E9614D51B5B9e2cf78038;

    function run() external returns (Covenant covenant, OutcomeMarket outcomes) {
        address accountCore = vm.envOr("KURU_ACCOUNT_CORE", TESTNET_ACCOUNT_CORE);

        vm.startBroadcast();
        covenant = new Covenant(IKuruAccountCore(accountCore));
        outcomes = new OutcomeMarket(covenant);
        vm.stopBroadcast();

        string memory json = "deployment";
        vm.serializeUint(json, "chainId", block.chainid);
        vm.serializeUint(json, "startBlock", block.number);
        vm.serializeAddress(json, "accountCore", accountCore);
        vm.serializeAddress(json, "covenant", address(covenant));
        string memory out = vm.serializeAddress(json, "outcomeMarket", address(outcomes));
        string memory file =
            vm.envOr("DEPLOYMENT_FILE", string.concat("deployments/", vm.toString(block.chainid), ".json"));
        vm.writeJson(out, string.concat(vm.projectRoot(), "/", file));

        console.log("Covenant", address(covenant));
        console.log("OutcomeMarket", address(outcomes));
    }
}
