export const covenantAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "accountCore_",
        "type": "address",
        "internalType": "contract IKuruAccountCore"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "accept",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "operator",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "accountCore",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IKuruAccountCore"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "cancel",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "claim",
    "inputs": [
      {
        "name": "token",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "claimRetainer",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "clawback",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "closeEpoch",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "enableHook",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "engagement",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct Covenant.Engagement",
        "components": [
          {
            "name": "terms",
            "type": "tuple",
            "internalType": "struct Covenant.Terms",
            "components": [
              {
                "name": "market",
                "type": "address",
                "internalType": "contract IKuruOrderBook"
              },
              {
                "name": "maker",
                "type": "address",
                "internalType": "address"
              },
              {
                "name": "loan",
                "type": "uint128",
                "internalType": "uint128"
              },
              {
                "name": "makerCollateral",
                "type": "uint128",
                "internalType": "uint128"
              },
              {
                "name": "bond",
                "type": "uint128",
                "internalType": "uint128"
              },
              {
                "name": "options",
                "type": "uint128",
                "internalType": "uint128"
              },
              {
                "name": "retainer",
                "type": "uint128",
                "internalType": "uint128"
              },
              {
                "name": "strike",
                "type": "uint32",
                "internalType": "uint32"
              },
              {
                "name": "initialPrice",
                "type": "uint32",
                "internalType": "uint32"
              },
              {
                "name": "termBlocks",
                "type": "uint32",
                "internalType": "uint32"
              },
              {
                "name": "noticeBlocks",
                "type": "uint32",
                "internalType": "uint32"
              },
              {
                "name": "exerciseWindowBlocks",
                "type": "uint32",
                "internalType": "uint32"
              },
              {
                "name": "ob",
                "type": "tuple",
                "internalType": "struct Covenant.Obligations",
                "components": [
                  {
                    "name": "maxSpreadBps",
                    "type": "uint16",
                    "internalType": "uint16"
                  },
                  {
                    "name": "depthBandBps",
                    "type": "uint16",
                    "internalType": "uint16"
                  },
                  {
                    "name": "uptimeTargetBps",
                    "type": "uint16",
                    "internalType": "uint16"
                  },
                  {
                    "name": "sustainedBreachEpochs",
                    "type": "uint16",
                    "internalType": "uint16"
                  },
                  {
                    "name": "volatileSpreadBps",
                    "type": "uint16",
                    "internalType": "uint16"
                  },
                  {
                    "name": "volatilityTriggerBps",
                    "type": "uint16",
                    "internalType": "uint16"
                  },
                  {
                    "name": "epochBlocks",
                    "type": "uint32",
                    "internalType": "uint32"
                  },
                  {
                    "name": "maxCreditBlocks",
                    "type": "uint32",
                    "internalType": "uint32"
                  },
                  {
                    "name": "minQuoteLifeBlocks",
                    "type": "uint32",
                    "internalType": "uint32"
                  },
                  {
                    "name": "graceBlocks",
                    "type": "uint32",
                    "internalType": "uint32"
                  },
                  {
                    "name": "minBidDepth",
                    "type": "uint128",
                    "internalType": "uint128"
                  },
                  {
                    "name": "minAskDepth",
                    "type": "uint128",
                    "internalType": "uint128"
                  }
                ]
              },
              {
                "name": "risk",
                "type": "tuple",
                "internalType": "struct Covenant.Risk",
                "components": [
                  {
                    "name": "priceBandBps",
                    "type": "uint16",
                    "internalType": "uint16"
                  },
                  {
                    "name": "maxRefStepBps",
                    "type": "uint16",
                    "internalType": "uint16"
                  },
                  {
                    "name": "penaltyBps",
                    "type": "uint16",
                    "internalType": "uint16"
                  },
                  {
                    "name": "breachSlashBps",
                    "type": "uint16",
                    "internalType": "uint16"
                  },
                  {
                    "name": "sellWindowBlocks",
                    "type": "uint32",
                    "internalType": "uint32"
                  },
                  {
                    "name": "backstopLockBlocks",
                    "type": "uint32",
                    "internalType": "uint32"
                  },
                  {
                    "name": "maxNetSell",
                    "type": "uint128",
                    "internalType": "uint128"
                  },
                  {
                    "name": "watchBounty",
                    "type": "uint128",
                    "internalType": "uint128"
                  },
                  {
                    "name": "clawbackBounty",
                    "type": "uint128",
                    "internalType": "uint128"
                  },
                  {
                    "name": "priceSource",
                    "type": "address",
                    "internalType": "contract IPriceSource"
                  },
                  {
                    "name": "maxPriceAge",
                    "type": "uint32",
                    "internalType": "uint32"
                  }
                ]
              },
              {
                "name": "termsHash",
                "type": "bytes32",
                "internalType": "bytes32"
              }
            ]
          },
          {
            "name": "issuer",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "operator",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "status",
            "type": "uint8",
            "internalType": "enum Covenant.Status"
          },
          {
            "name": "account",
            "type": "uint40",
            "internalType": "uint40"
          },
          {
            "name": "startBlock",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "endBlock",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "units",
            "type": "tuple",
            "internalType": "struct MarketMath.Units",
            "components": [
              {
                "name": "sizePrecision",
                "type": "uint96",
                "internalType": "uint96"
              },
              {
                "name": "baseSizeMultiplier",
                "type": "uint96",
                "internalType": "uint96"
              },
              {
                "name": "pricePrecision",
                "type": "uint32",
                "internalType": "uint32"
              },
              {
                "name": "tickSize",
                "type": "uint32",
                "internalType": "uint32"
              },
              {
                "name": "quoteUnit",
                "type": "uint64",
                "internalType": "uint64"
              }
            ]
          },
          {
            "name": "base",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "quote",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "lastObsBlock",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "lastCompliant",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "creditedBlocks",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "nonCompliantSince",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "breachReported",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "nextEpoch",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "failingStreak",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "refPrice",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "refBlock",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "volatile",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "sellWindowStart",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "windowHoldings",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "liveMask",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "refreshEnabled",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "refreshOffsetTicks",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "bondLeft",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "retainerPaid",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "backstopPosition",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "backstopUnlock",
            "type": "uint64",
            "internalType": "uint64"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "engagementCount",
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
    "name": "engagementOfAccount",
    "inputs": [
      {
        "name": "",
        "type": "uint40",
        "internalType": "uint40"
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
    "name": "epochBounds",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "epoch",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "outputs": [
      {
        "name": "from",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "to",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "epochCredit",
    "inputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "kuruOwed",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "",
        "type": "address",
        "internalType": "address"
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
    "name": "makerStats",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "engagements",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "clawbacks",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "defaults",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "failedEpochs",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "creditedBlocks",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "termBlocks",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "metrics",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct Covenant.Metrics",
        "components": [
          {
            "name": "compliant",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "suspended",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "refPrice",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "bestBid",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "bestAsk",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "spreadBps",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "allowedSpreadBps",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "bidDepth",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "askDepth",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "netSold",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
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
    "name": "owed",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "",
        "type": "address",
        "internalType": "address"
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
    "name": "poke",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "compliant",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "postFill",
    "inputs": [
      {
        "name": "ctx",
        "type": "tuple",
        "internalType": "struct IPostFillHook.PostFillContext",
        "components": [
          {
            "name": "userId",
            "type": "uint40",
            "internalType": "uint40"
          },
          {
            "name": "filledSlotIdx",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "filledOrderId",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "takerId",
            "type": "uint40",
            "internalType": "uint40"
          },
          {
            "name": "fillPrice",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "filledSize",
            "type": "uint96",
            "internalType": "uint96"
          },
          {
            "name": "remainingBaseSize",
            "type": "uint96",
            "internalType": "uint96"
          },
          {
            "name": "bestBid",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "bestAsk",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "filledOrderIsBuy",
            "type": "bool",
            "internalType": "bool"
          }
        ]
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "propose",
    "inputs": [
      {
        "name": "t",
        "type": "tuple",
        "internalType": "struct Covenant.Terms",
        "components": [
          {
            "name": "market",
            "type": "address",
            "internalType": "contract IKuruOrderBook"
          },
          {
            "name": "maker",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "loan",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "makerCollateral",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "bond",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "options",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "retainer",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "strike",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "initialPrice",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "termBlocks",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "noticeBlocks",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "exerciseWindowBlocks",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "ob",
            "type": "tuple",
            "internalType": "struct Covenant.Obligations",
            "components": [
              {
                "name": "maxSpreadBps",
                "type": "uint16",
                "internalType": "uint16"
              },
              {
                "name": "depthBandBps",
                "type": "uint16",
                "internalType": "uint16"
              },
              {
                "name": "uptimeTargetBps",
                "type": "uint16",
                "internalType": "uint16"
              },
              {
                "name": "sustainedBreachEpochs",
                "type": "uint16",
                "internalType": "uint16"
              },
              {
                "name": "volatileSpreadBps",
                "type": "uint16",
                "internalType": "uint16"
              },
              {
                "name": "volatilityTriggerBps",
                "type": "uint16",
                "internalType": "uint16"
              },
              {
                "name": "epochBlocks",
                "type": "uint32",
                "internalType": "uint32"
              },
              {
                "name": "maxCreditBlocks",
                "type": "uint32",
                "internalType": "uint32"
              },
              {
                "name": "minQuoteLifeBlocks",
                "type": "uint32",
                "internalType": "uint32"
              },
              {
                "name": "graceBlocks",
                "type": "uint32",
                "internalType": "uint32"
              },
              {
                "name": "minBidDepth",
                "type": "uint128",
                "internalType": "uint128"
              },
              {
                "name": "minAskDepth",
                "type": "uint128",
                "internalType": "uint128"
              }
            ]
          },
          {
            "name": "risk",
            "type": "tuple",
            "internalType": "struct Covenant.Risk",
            "components": [
              {
                "name": "priceBandBps",
                "type": "uint16",
                "internalType": "uint16"
              },
              {
                "name": "maxRefStepBps",
                "type": "uint16",
                "internalType": "uint16"
              },
              {
                "name": "penaltyBps",
                "type": "uint16",
                "internalType": "uint16"
              },
              {
                "name": "breachSlashBps",
                "type": "uint16",
                "internalType": "uint16"
              },
              {
                "name": "sellWindowBlocks",
                "type": "uint32",
                "internalType": "uint32"
              },
              {
                "name": "backstopLockBlocks",
                "type": "uint32",
                "internalType": "uint32"
              },
              {
                "name": "maxNetSell",
                "type": "uint128",
                "internalType": "uint128"
              },
              {
                "name": "watchBounty",
                "type": "uint128",
                "internalType": "uint128"
              },
              {
                "name": "clawbackBounty",
                "type": "uint128",
                "internalType": "uint128"
              },
              {
                "name": "priceSource",
                "type": "address",
                "internalType": "contract IPriceSource"
              },
              {
                "name": "maxPriceAge",
                "type": "uint32",
                "internalType": "uint32"
              }
            ]
          },
          {
            "name": "termsHash",
            "type": "bytes32",
            "internalType": "bytes32"
          }
        ]
      }
    ],
    "outputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "quote",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "ops",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "releaseBackstop",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "retainerEarned",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
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
    "name": "rootAccount",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint40",
        "internalType": "uint40"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "setOperator",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "operator",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setRefreshPolicy",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "enabled",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "offsetTicks",
        "type": "uint16",
        "internalType": "uint16"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "settle",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "extraExercise",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "slot",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "index",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct Covenant.Slot",
        "components": [
          {
            "name": "price",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "size",
            "type": "uint96",
            "internalType": "uint96"
          },
          {
            "name": "orderId",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "placedBlock",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "isBuy",
            "type": "bool",
            "internalType": "bool"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "terminate",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "vested",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
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
    "type": "event",
    "name": "Accepted",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "account",
        "type": "uint40",
        "indexed": false,
        "internalType": "uint40"
      },
      {
        "name": "operator",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      },
      {
        "name": "startBlock",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      },
      {
        "name": "endBlock",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "BackstopReleased",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "base",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "quote",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "BountyPaid",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "to",
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
    "name": "Cancelled",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Claimed",
    "inputs": [
      {
        "name": "account",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "token",
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
    "name": "ClawbackEligible",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ClawedBack",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "caller",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "result",
        "type": "tuple",
        "indexed": false,
        "internalType": "struct Settlement.Output",
        "components": [
          {
            "name": "issuerBase",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "issuerQuote",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "makerBase",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "makerQuote",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "bondToIssuer",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "bondToMaker",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "shortfall",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "exercised",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "deficit",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      },
      {
        "name": "backstopPosition",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ComplianceChanged",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "compliant",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "EpochClosed",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "epoch",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      },
      {
        "name": "credited",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      },
      {
        "name": "length",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      },
      {
        "name": "passed",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      },
      {
        "name": "streak",
        "type": "uint16",
        "indexed": false,
        "internalType": "uint16"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Filled",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "slot",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      },
      {
        "name": "price",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      },
      {
        "name": "size",
        "type": "uint96",
        "indexed": false,
        "internalType": "uint96"
      },
      {
        "name": "isBuy",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      },
      {
        "name": "replenished",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "HookEnabled",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Observed",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "compliant",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      },
      {
        "name": "credited",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      },
      {
        "name": "refPrice",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      },
      {
        "name": "bestBid",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      },
      {
        "name": "bestAsk",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      },
      {
        "name": "bidDepth",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "askDepth",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OperatorSet",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "operator",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Proposed",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "issuer",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "maker",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "market",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      },
      {
        "name": "termsHash",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "QuoteSkipped",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "slot",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Quoted",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "ops",
        "type": "bytes",
        "indexed": false,
        "internalType": "bytes"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RefreshPolicySet",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "enabled",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      },
      {
        "name": "offsetTicks",
        "type": "uint16",
        "indexed": false,
        "internalType": "uint16"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RetainerClaimed",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
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
    "name": "Settled",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "result",
        "type": "tuple",
        "indexed": false,
        "internalType": "struct Settlement.Output",
        "components": [
          {
            "name": "issuerBase",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "issuerQuote",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "makerBase",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "makerQuote",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "bondToIssuer",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "bondToMaker",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "shortfall",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "exercised",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "deficit",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Terminated",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "endBlock",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "BackstopLocked",
    "inputs": []
  },
  {
    "type": "error",
    "name": "BadOps",
    "inputs": []
  },
  {
    "type": "error",
    "name": "EpochNotOver",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidStatus",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidTerms",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotPostOnly",
    "inputs": [
      {
        "name": "slot",
        "type": "uint8",
        "internalType": "uint8"
      }
    ]
  },
  {
    "type": "error",
    "name": "NothingToClaim",
    "inputs": []
  },
  {
    "type": "error",
    "name": "OutsidePriceBand",
    "inputs": [
      {
        "name": "slot",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "price",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "refPrice",
        "type": "uint32",
        "internalType": "uint32"
      }
    ]
  },
  {
    "type": "error",
    "name": "QuoteTooYoung",
    "inputs": [
      {
        "name": "slot",
        "type": "uint8",
        "internalType": "uint8"
      }
    ]
  },
  {
    "type": "error",
    "name": "ReduceAfterBlockNotAllowed",
    "inputs": [
      {
        "name": "slot",
        "type": "uint8",
        "internalType": "uint8"
      }
    ]
  },
  {
    "type": "error",
    "name": "Reentrancy",
    "inputs": []
  },
  {
    "type": "error",
    "name": "SellLimitExceeded",
    "inputs": [
      {
        "name": "exposure",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "limit",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "SlotOutOfRange",
    "inputs": [
      {
        "name": "slot",
        "type": "uint8",
        "internalType": "uint8"
      }
    ]
  },
  {
    "type": "error",
    "name": "TermEnded",
    "inputs": []
  },
  {
    "type": "error",
    "name": "TermNotEnded",
    "inputs": []
  },
  {
    "type": "error",
    "name": "Unauthorized",
    "inputs": []
  }
] as const;
