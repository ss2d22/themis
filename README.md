# Covenant

Market-making agreements enforced by the order book.

Token launches hire market makers on a standard deal: the project lends
tokens, the market maker gets call options, and both sides agree on spread,
depth and uptime targets that nobody outside the deal can check. Covenant puts
that deal on [Kuru](https://kuru-testnet-docs.mintlify.site)'s order book, where
the book is contract state and every promise can be measured from the chain.

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

The issuer is bound too: options and retainer are escrowed up front and vest
mechanically, and the agreement can only end early after the agreed notice.

### Three market structures, one escrow

| Template | The operator must | Settles |
| - | - | - |
| Market making | Keep a two-sided book within a max spread, with bid and ask depth in band | Loan back in base; any shortfall paid at strike, then at a penalty price |
| Buyback | Rest bids from the issuer's quote budget, at a capped buy pace | Every token bought and all unspent budget to the issuer |
| Distribution | Sell the issuer's tokens through asks only, at a capped sell pace | All proceeds and unsold tokens to the issuer |

### Outcome markets

`OutcomeMarket` mints fully collateralised `KEPT` / `BROKEN` pairs on whether a
market maker meets its uptime target over a range of epochs. Resolution reads
the escrow ledger, so there is no oracle. Listed on Kuru, the `KEPT` price is a
live, market-set estimate of whether the market maker will deliver.

## Repository

| Path | Contents |
| - | - |
| `contracts/` | Foundry project: escrow, settlement, outcome market, Chainlink price source |
| `packages/sdk` | Typed ABIs, Kuru packed-op codec, unit conversions, trade and error decoding, agreement presets |
| `apps/bots` | Honest and adversarial market makers, retail taker, watchtower, setup commands |
| `apps/indexer` | Ponder indexer for the escrow, outcome markets and Kuru fills, with a REST and GraphQL API |
| `apps/web` | Next.js app: covenant explorer, live terminal, composer, maker ratings, watchtowers, outcomes, stats |
| `scripts/rehearse.sh` | Runs the whole system against a local fork of Monad testnet |

## Kuru integration

Built against Kuru Spot V2 on Monad testnet (chain 10143), OrderBook revision
`cdac5ae1`.

- The escrow is a Kuru root account and opens one subaccount per agreement, so
  each agreement's reserves are isolated.
- Quotes go through `replaceBySlotPacked`, so the escrow chooses the slot for
  every order and mirrors all 62 slots without scanning.
- Depth comes from `makerLockedReserves`, which Kuru updates on every fill.
  Quotes outside the depth band are subtracted at their placed size, which can
  only undercount.
- The escrow is the post-fill hook. Kuru governance grants hook access per
  subaccount; without it the ledger still works and auto-replenishment is off.
- Clawed-back inventory is minted into a passive band with
  `batchMintPassiveLiquidity`, which clips legs that would cross the book.
- Kuru's withdrawal limiter can hold back a payout. Claims then pay what is
  held locally and keep the rest owed, claimable later in full or in pieces.
- The indexer follows every market an agreement is proposed on and decodes
  `TradesPacked`, so partial fills against covenant quotes are recorded too.

## Running it

Requires [Foundry](https://getfoundry.sh) 1.8+, Node 22+, pnpm 10 and `jq`.

```sh
git clone --recurse-submodules <repo>
cd monad-hack
pnpm install
```

### Everything, locally

```sh
scripts/rehearse.sh          # fork testnet, deploy, open covenants, start bots, indexer and web
scripts/rehearse.sh stop
```

The rehearsal forks the live Kuru deployment, deploys fresh escrow and outcome
contracts, funds every role by minting test tokens as Kuru governance on the
fork, and opens one covenant of each kind: an honest market maker, an
adversary that tries every attack and is clawed back, a buyback, a
distribution and a proposal awaiting acceptance. The app is at
`http://localhost:3000` and the indexer at `http://localhost:42069`.

### Pieces on their own

```sh
# contracts
cd contracts
forge test --no-match-path "test/fork/*"          # unit, fuzz and invariant tests
MONAD_TESTNET_RPC_URL=https://testnet-rpc.monad.xyz forge test --match-path "test/fork/*"

# typescript
pnpm -r test && pnpm -r typecheck && pnpm lint

# bots, against any deployment (see apps/bots/.env.example)
cd apps/bots && pnpm start
```

Deploy to testnet:

```sh
cd contracts
forge script script/Deploy.s.sol --rpc-url monad_testnet --broadcast --private-key $PRIVATE_KEY
```

Addresses are written to `contracts/deployments/<chainId>.json`.

## Testing and security

- 81 unit, fuzz and invariant tests against a ledger-level Kuru mock, and 9
  tests against the live Kuru testnet deployment on a fork.
- Fuzzed settlement: base, quote and bond are conserved, and the issuer is
  never paid below the strike.
- Stateful invariants under random quoting, partial and full fills, hook
  replenishment, time jumps and enforcement calls: credit never exceeds elapsed
  blocks and matches the per-epoch ledger, vesting stays within the grant, only
  post-only orders without reduce-after-block reach the book, and sold plus
  resting base never exceeds the sell limit.
- Slither reports no high-severity findings. Medium findings were reviewed:
  rounding to ticks and windows is intentional, external calls go only to Kuru
  contracts from `nonReentrant` entry points, and ignored return values are
  unused tuple fields.

## License

MIT
