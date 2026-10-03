#!/usr/bin/env bash
# Runs the whole system against a local fork of Monad testnet: the real Kuru Spot V2 contracts, freshly deployed
# escrow and outcome market, one covenant of every kind, the bots, the indexer and the web app.
#
#   scripts/rehearse.sh          start everything
#   scripts/rehearse.sh stop     stop everything
#
# Uses anvil's default accounts. Logs go to logs/rehearsal/.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOGS="$ROOT/logs/rehearsal"
RPC="http://127.0.0.1:8545"
FORK_RPC="${MONAD_TESTNET_RPC_URL:-https://testnet-rpc.monad.xyz}"

# anvil's well-known development keys
KEYS=(
  0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
  0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
  0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
  0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6
  0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a
  0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba
  0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e
  0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcbf0b5b8d5d1
  0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97
  0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6
)

stop() {
  pkill -f "anvil --fork-url" 2>/dev/null || true
  pkill -f "src/main.ts" 2>/dev/null || true
  pkill -f "ponder dev" 2>/dev/null || true
  pkill -f "next dev" 2>/dev/null || true
}

if [[ "${1:-}" == "stop" ]]; then
  stop
  echo "stopped"
  exit 0
fi

stop
rm -rf "$LOGS" "$ROOT/apps/indexer/.ponder"
mkdir -p "$LOGS"

echo "› forking Monad testnet"
nohup anvil --fork-url "$FORK_RPC" -n monad --port 8545 --block-time 1 --silent >"$LOGS/anvil.log" 2>&1 &
until cast block-number --rpc-url "$RPC" >/dev/null 2>&1; do sleep 1; done
START_BLOCK="$(cast block-number --rpc-url "$RPC")"

echo "› deploying escrow and outcome market"
(cd "$ROOT/contracts" && DEPLOYMENT_FILE=deployments/local.json forge script script/Deploy.s.sol \
  --rpc-url "$RPC" --broadcast --private-key "${KEYS[0]}" >"$LOGS/deploy.log" 2>&1)
DEPLOYMENT="$ROOT/contracts/deployments/local.json"
COVENANT="$(jq -r .covenant "$DEPLOYMENT")"
OUTCOMES="$(jq -r .outcomeMarket "$DEPLOYMENT")"

cat >"$ROOT/apps/bots/.env" <<ENV
RPC_URL=$RPC
COVENANT_ADDRESS=$COVENANT
OUTCOME_MARKET_ADDRESS=$OUTCOMES
ISSUER_KEY=${KEYS[1]}
MAKER_KEY=${KEYS[2]}
OPERATOR_KEY=${KEYS[3]}
ADVERSARY_MAKER_KEY=${KEYS[4]}
ADVERSARY_OPERATOR_KEY=${KEYS[5]}
TAKER_KEY=${KEYS[6]}
WATCHER_KEY=${KEYS[7]}
LOG_FILE=$LOGS/bots.ndjson
ENV

cat >"$ROOT/apps/indexer/.env.local" <<ENV
PONDER_RPC_URL_10143=$RPC
COVENANT_ADDRESS=$COVENANT
OUTCOME_MARKET_ADDRESS=$OUTCOMES
START_BLOCK=$START_BLOCK
ENV

cat >"$ROOT/apps/web/.env.local" <<ENV
NEXT_PUBLIC_INDEXER_URL=http://localhost:42069
NEXT_PUBLIC_RPC_URL=$RPC
NEXT_PUBLIC_COVENANT_ADDRESS=$COVENANT
NEXT_PUBLIC_OUTCOME_MARKET_ADDRESS=$OUTCOMES
ENV

bots() { (cd "$ROOT/apps/bots" && pnpm --silent start "$@"); }

echo "› funding every role"
bots setup fund-fork >"$LOGS/setup.log" 2>&1
bots setup taker --base 5 --quote 20000 >>"$LOGS/setup.log" 2>&1

echo "› opening covenants"
bots setup engagement --preset demo >>"$LOGS/setup.log" 2>&1                 # 1 honest market maker
bots setup engagement --preset demo --adversary >>"$LOGS/setup.log" 2>&1     # 2 adversary
OPERATOR_KEY=${KEYS[8]} bots setup engagement --preset buyback >>"$LOGS/setup.log" 2>&1       # 3 buyback
OPERATOR_KEY=${KEYS[9]} bots setup engagement --preset distribution >>"$LOGS/setup.log" 2>&1  # 4 distribution
bots setup engagement --preset launch --pending >>"$LOGS/setup.log" 2>&1     # 5 awaiting acceptance
bots setup hook --engagement 1 >>"$LOGS/setup.log" 2>&1
bots setup outcome --engagement 1 --first 1 --count 2 >>"$LOGS/setup.log" 2>&1

echo "› starting bots, indexer and web"
(cd "$ROOT/apps/bots" && nohup pnpm --silent start mm --engagement 1 >"$LOGS/mm.log" 2>&1 &)
(cd "$ROOT/apps/bots" && OPERATOR_KEY=${KEYS[8]} nohup pnpm --silent start mm --engagement 3 >"$LOGS/buyback.log" 2>&1 &)
(cd "$ROOT/apps/bots" && OPERATOR_KEY=${KEYS[9]} nohup pnpm --silent start mm --engagement 4 >"$LOGS/distribution.log" 2>&1 &)
(cd "$ROOT/apps/bots" && nohup pnpm --silent start adversary --engagement 2 >"$LOGS/adversary.log" 2>&1 &)
(cd "$ROOT/apps/bots" && nohup pnpm --silent start taker >"$LOGS/taker.log" 2>&1 &)
(cd "$ROOT/apps/bots" && nohup pnpm --silent start watchtower >"$LOGS/watchtower.log" 2>&1 &)
(cd "$ROOT/apps/indexer" && nohup npx ponder dev --port 42069 >"$LOGS/indexer.log" 2>&1 &)
(cd "$ROOT/apps/web" && nohup npx next dev --port 3000 >"$LOGS/web.log" 2>&1 &)

echo
echo "  web      http://localhost:3000"
echo "  indexer  http://localhost:42069"
echo "  logs     $LOGS"
echo "  stop     scripts/rehearse.sh stop"
