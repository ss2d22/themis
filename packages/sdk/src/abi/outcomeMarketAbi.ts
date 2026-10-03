export const outcomeMarketAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "covenant_",
        "type": "address",
        "internalType": "contract Covenant"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "covenant",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract Covenant"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "create",
    "inputs": [
      {
        "name": "engagementId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "firstEpoch",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "epochCount",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "outputs": [
      {
        "name": "marketId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "market",
    "inputs": [
      {
        "name": "marketId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct OutcomeMarket.Market",
        "components": [
          {
            "name": "engagementId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "firstEpoch",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "epochCount",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "collateral",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "kept",
            "type": "address",
            "internalType": "contract OutcomeToken"
          },
          {
            "name": "broken",
            "type": "address",
            "internalType": "contract OutcomeToken"
          },
          {
            "name": "outcome",
            "type": "uint8",
            "internalType": "enum OutcomeMarket.Outcome"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "marketCount",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "marketOf",
    "inputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "mintSet",
    "inputs": [
      {
        "name": "marketId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "amount",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "redeem",
    "inputs": [
      {
        "name": "marketId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "amount",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "redeemSet",
    "inputs": [
      {
        "name": "marketId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "amount",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "resolve",
    "inputs": [
      {
        "name": "marketId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "MarketCreated",
    "inputs": [
      {
        "name": "marketId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "engagementId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "firstEpoch",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      },
      {
        "name": "epochCount",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      },
      {
        "name": "kept",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      },
      {
        "name": "broken",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Redeemed",
    "inputs": [
      {
        "name": "marketId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "account",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Resolved",
    "inputs": [
      {
        "name": "marketId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "outcome",
        "type": "uint8",
        "indexed": false,
        "internalType": "enum OutcomeMarket.Outcome"
      },
      {
        "name": "credited",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "length",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SetMinted",
    "inputs": [
      {
        "name": "marketId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "account",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SetRedeemed",
    "inputs": [
      {
        "name": "marketId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "account",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "AlreadyExists",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidRange",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotOpen",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotResolved",
    "inputs": []
  },
  {
    "type": "error",
    "name": "PeriodNotOver",
    "inputs": []
  },
  {
    "type": "error",
    "name": "Reentrancy",
    "inputs": []
  }
] as const;
