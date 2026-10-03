export const kuruOrderBookAbi = [
  {
    "type": "function",
    "name": "baseSizeMultiplier",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint96",
        "internalType": "uint96"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "baseToken",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "batch",
    "inputs": [
      {
        "name": "userId",
        "type": "uint40",
        "internalType": "uint40"
      },
      {
        "name": "orders",
        "type": "tuple[]",
        "internalType": "struct IKuruOrderBook.NativeOrder[]",
        "components": [
          {
            "name": "side",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "quantity",
            "type": "uint96",
            "internalType": "uint96"
          },
          {
            "name": "price",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "tif",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "executionInstruction",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "minSizeAfterBlock",
            "type": "uint32",
            "internalType": "uint32"
          }
        ]
      },
      {
        "name": "cancelSlotIdxs",
        "type": "uint8[]",
        "internalType": "uint8[]"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "batchMintPassiveLiquidity",
    "inputs": [
      {
        "name": "userId",
        "type": "uint40",
        "internalType": "uint40"
      },
      {
        "name": "mints",
        "type": "tuple[]",
        "internalType": "struct IKuruOrderBook.PassiveMintParams[]",
        "components": [
          {
            "name": "lowPrice",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "baseAmount",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "quoteAmount",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "minSharesOut",
            "type": "uint128",
            "internalType": "uint128"
          }
        ]
      },
      {
        "name": "deadline",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "outputs": [
      {
        "name": "results",
        "type": "tuple[]",
        "internalType": "struct IKuruOrderBook.PassiveMintResult[]",
        "components": [
          {
            "name": "positionId",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "sharesOut",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "baseUsed",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "quoteUsed",
            "type": "uint128",
            "internalType": "uint128"
          }
        ]
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "bestBidAsk",
    "inputs": [],
    "outputs": [
      {
        "name": "bid",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "ask",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "burnPassiveLiquidity",
    "inputs": [
      {
        "name": "userId",
        "type": "uint40",
        "internalType": "uint40"
      },
      {
        "name": "positionId",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "sharesToBurn",
        "type": "uint128",
        "internalType": "uint128"
      }
    ],
    "outputs": [
      {
        "name": "basePrincipalOut",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "quotePrincipalOut",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "baseFeeOut",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "quoteFeeOut",
        "type": "uint128",
        "internalType": "uint128"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "cancelAllOrders",
    "inputs": [
      {
        "name": "userId",
        "type": "uint40",
        "internalType": "uint40"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "estimateSwap",
    "inputs": [
      {
        "name": "isBuy",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "amountIn",
        "type": "uint128",
        "internalType": "uint128"
      }
    ],
    "outputs": [
      {
        "name": "result",
        "type": "tuple",
        "internalType": "struct IKuruOrderBook.SwapResult",
        "components": [
          {
            "name": "amountInUsed",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "amountOut",
            "type": "uint128",
            "internalType": "uint128"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getL2Book",
    "inputs": [
      {
        "name": "levels",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "bidPrices",
        "type": "uint32[]",
        "internalType": "uint32[]"
      },
      {
        "name": "bidSizes",
        "type": "uint96[]",
        "internalType": "uint96[]"
      },
      {
        "name": "askPrices",
        "type": "uint32[]",
        "internalType": "uint32[]"
      },
      {
        "name": "askSizes",
        "type": "uint96[]",
        "internalType": "uint96[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getOrderId",
    "inputs": [
      {
        "name": "userId",
        "type": "uint40",
        "internalType": "uint40"
      },
      {
        "name": "slotIdx",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "outputs": [
      {
        "name": "orderId",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getPassivePosition",
    "inputs": [
      {
        "name": "positionId",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "outputs": [
      {
        "name": "position",
        "type": "tuple",
        "internalType": "struct IKuruOrderBook.PassivePositionView",
        "components": [
          {
            "name": "ownerId",
            "type": "uint40",
            "internalType": "uint40"
          },
          {
            "name": "lowPrice",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "highPrice",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "shares",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "lastFeeGrowthBaseX128",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "lastFeeGrowthQuoteX128",
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
    "name": "getPostFillHook",
    "inputs": [
      {
        "name": "userId",
        "type": "uint40",
        "internalType": "uint40"
      }
    ],
    "outputs": [
      {
        "name": "hook",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "lastTradeObservation",
    "inputs": [],
    "outputs": [
      {
        "name": "priceX8",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "timestamp",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "makerFeePps",
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
    "name": "makerLockedReserves",
    "inputs": [
      {
        "name": "userId",
        "type": "uint40",
        "internalType": "uint40"
      }
    ],
    "outputs": [
      {
        "name": "baseReserved",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "quoteReserved",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "marketState",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "minQuoteNotional",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint96",
        "internalType": "uint96"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "mintPassiveLiquidity",
    "inputs": [
      {
        "name": "userId",
        "type": "uint40",
        "internalType": "uint40"
      },
      {
        "name": "lowPrice",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "baseAmount",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "quoteAmount",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "minSharesOut",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "deadline",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "outputs": [
      {
        "name": "positionId",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "sharesOut",
        "type": "uint128",
        "internalType": "uint128"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "passiveSpreadTicks",
    "inputs": [],
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
    "name": "pricePrecision",
    "inputs": [],
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
    "name": "quoteToken",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "quoteTokenDecimals",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "replaceBySlotPacked",
    "inputs": [
      {
        "name": "userId",
        "type": "uint40",
        "internalType": "uint40"
      },
      {
        "name": "packedOps",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setPostFillHook",
    "inputs": [
      {
        "name": "userId",
        "type": "uint40",
        "internalType": "uint40"
      },
      {
        "name": "hook",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "sizePrecision",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint96",
        "internalType": "uint96"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "swap",
    "inputs": [
      {
        "name": "userId",
        "type": "uint40",
        "internalType": "uint40"
      },
      {
        "name": "isBuy",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "amountIn",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "minAmountOut",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "deadline",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "outputs": [
      {
        "name": "amountInUsed",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "amountOut",
        "type": "uint128",
        "internalType": "uint128"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "tickSize",
    "inputs": [],
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
    "type": "event",
    "name": "BookUpdatesPacked",
    "inputs": [
      {
        "name": "accountId",
        "type": "uint40",
        "indexed": true,
        "internalType": "uint40"
      },
      {
        "name": "executor",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "clientOrderId",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      },
      {
        "name": "packedUpdates",
        "type": "bytes",
        "indexed": false,
        "internalType": "bytes"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "TradesPacked",
    "inputs": [
      {
        "name": "accountId",
        "type": "uint40",
        "indexed": true,
        "internalType": "uint40"
      },
      {
        "name": "executor",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "clientOrderId",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      },
      {
        "name": "effectiveTakerFeePps",
        "type": "uint24",
        "indexed": false,
        "internalType": "uint24"
      },
      {
        "name": "builder",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      },
      {
        "name": "builderFeePps",
        "type": "uint24",
        "indexed": false,
        "internalType": "uint24"
      },
      {
        "name": "packedTrades",
        "type": "bytes",
        "indexed": false,
        "internalType": "bytes"
      }
    ],
    "anonymous": false
  }
] as const;
