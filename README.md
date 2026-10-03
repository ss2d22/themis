# Covenant

Market-making agreements enforced by the order book.

Token launches hire market makers on a standard deal: the project lends
tokens, the market maker gets call options, and both sides agree on spread,
depth and uptime targets that nobody outside the deal can check. Covenant puts
that deal on [Kuru](https://kuru-testnet-docs.mintlify.site)'s order book, where the book is contract
state and every promise can be measured from the chain.

## How it works

1. **Propose.** The issuer escrows the token loan and an optional retainer, and
   sets the terms: spread, depth band, uptime target, option strike, sell
   limits and penalties.
2. **Accept.** The market maker posts quote collateral and a performance bond.
   The escrow opens a Kuru subaccount it alone controls and moves the loan and
   collateral into it.
3. **Quote.** The market maker's bot sends Kuru packed slot operations to
   `Covenant.quote`. The escrow checks every order and forwards it to Kuru.
4. **Measure.** Each quote, poke and fill observes the book. An interval is
   credited only if the book was compliant at both ends of it.
5. **Vest.** Options and retainer vest per credited block.
6. **Enforce.** Consecutive failed epochs make the agreement clawable. Anyone
   can trigger the clawback for a bounty. It settles with a penalty, slashes the
   bond and puts the issuer's inventory back on the book as Kuru passive
   liquidity.
7. **Settle.** At maturity the issuer gets the loan back in base. Anything the
   market maker sold and did not buy back is paid for at the strike (up to
   vested options) and above that at a penalty price.

### What the market maker cannot do

| Attempt | Why it fails |
| - | - |
| Market-sell the loan | Only post-only orders pass the gate. A crossing order is skipped by Kuru, never filled. |
| Withdraw or move the loan | The escrow is the only owner of the Kuru account. The market maker holds no Kuru permission at all. |
| Sell the loan cheaply to its own wallet | Quotes must sit inside a band around a rate-limited reference. Any shortfall at settlement is charged at max(strike, reference) plus a penalty. |
| Sell faster than agreed | Net base sold, plus every resting ask, is capped per window. Hook replenishment checks the same cap. |
| Show depth that disappears | Kuru's reduce-after-block is rejected, quotes have a minimum life, and depth is read from Kuru's reserved balances, not from what was placed. |
| Get paid for uptime it didn't provide | Credit needs a compliant observation at both ends of the interval, capped per observation. A dip between observations can only come from a partial fill, and the next observation sees it. |
| Hit volume targets with wash trades | There are no volume targets. Obligations are spread, depth and uptime only. |
| Pull quotes during a gas spike | The only force majeure is Kuru pausing the market, read from `marketState()`. |

### What the issuer cannot do

Options and retainer are escrowed up front and vest mechanically. The issuer
can end the agreement early only after the agreed notice period, and cannot
touch the loan while it is on the book.

### Outcome markets

`OutcomeMarket` mints fully collateralised `KEPT` / `BROKEN` pairs on whether
a market maker meets its uptime target over a range of epochs. Resolution reads
the escrow ledger, so there is no oracle. Listed on Kuru, the `KEPT` price is a
live, market-set estimate of whether the market maker will deliver.

## Repository

| Path | Contents |
| - | - |
| `contracts/src/Covenant.sol` | Escrow, quote gate, ledger, post-fill hook, clawback and settlement |
| `contracts/src/libraries/Settlement.sol` | Settlement waterfall |
| `contracts/src/libraries/MarketMath.sol` | Kuru price and size unit conversions |
| `contracts/src/libraries/KuruCodec.sol` | Packed slot operations and hook refresh words |
| `contracts/src/outcome/` | KEPT / BROKEN outcome market |
| `contracts/test/` | Unit and fuzz tests against a ledger-level Kuru mock |
| `contracts/test/fork/` | Tests against the live Kuru Spot V2 testnet deployment |

## Kuru integration

Built against Kuru Spot V2 on Monad testnet (chain 10143), using OrderBook
revision `cdac5ae1`.

- The escrow is a Kuru root account and opens one subaccount per agreement,
  so each agreement's reserves are isolated.
- Quotes go through `replaceBySlotPacked`, so the escrow chooses the slot for
  every order and mirrors all 62 slots without scanning.
- Depth comes from `makerLockedReserves`, which Kuru updates on every fill.
  Quotes outside the depth band are subtracted at their placed size, which can
  only undercount.
- Post-fill hooks need access granted by Kuru governance for each subaccount.
  Without that access the ledger still works, and the auto-replenish policy is
  simply off.
- Clawed-back inventory is minted into a passive band with
  `batchMintPassiveLiquidity`, which clips legs that would cross the book.

## Development

Requires [Foundry](https://getfoundry.sh) 1.8 or later.

```sh
git clone --recurse-submodules <repo>
cd contracts
forge test --no-match-path "test/fork/*"
```

Fork tests run against live testnet state:

```sh
export MONAD_TESTNET_RPC_URL=https://testnet-rpc.monad.xyz
forge test --match-path "test/fork/*"
```

Deploy:

```sh
forge script script/Deploy.s.sol --rpc-url monad_testnet --broadcast --private-key $PRIVATE_KEY
```

Addresses are written to `contracts/deployments/<chainId>.json`.

## License

MIT
