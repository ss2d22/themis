import type { Address } from "viem";

/** Kuru Spot V2 on Monad testnet, verified at block 66669731. */
export const kuruTestnet = {
  accountCore: "0xdbaaDe7B42c95399bb1E9614D51B5B9e2cf78038",
  spotRouter: "0xf75A7529b83941e001d7D9bc113A73C92112947E",
  tokens: {
    USDC: "0xA402B424f392EAA05DBc8779e4502A1F6A96fEF1",
    WETH: "0x63c84e18184021c6CcE5ea57d0c3Ec0E65f3b303",
    WBTC: "0x7cDC77B348a2E101C766aD290367f3c5F287af18",
    XAUT: "0x7553b18A8c8400a1b7746C1F5b4f453D57555838",
  },
  markets: {
    "WETH/USDC": "0x9d187971B64505Ac81f12c5FD2ac9c5247Ec62F3",
    "WBTC/USDC": "0x8661cB7c5f4f8ae3ee116B63Aa5a23c69110e357",
    "MON/USDC": "0x26cd68436B6A4AEB3ec52abC20A4d121f8B4BAc9",
    "XAUT/USDC": "0x0E2A5D9378fB61B8eC100Bd770c449F6fdD3e4d6",
  },
} as const satisfies {
  accountCore: Address;
  spotRouter: Address;
  tokens: Record<string, Address>;
  markets: Record<string, Address>;
};

/** Kuru reports an empty side with these sentinels. */
export const EMPTY_BID = 2n ** 32n - 1n;
export const EMPTY_ASK = 0n;
