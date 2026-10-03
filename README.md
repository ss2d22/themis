# Covenant

Market-making agreements enforced by the order book.

A token issuer lends inventory to a market maker. On Kuru, that loan sits in
an escrow that owns the orders. The market maker quotes through the escrow,
post-only and inside a price band. Spread, depth and uptime are measured from
contract state, options vest only while every target is met, and a sustained
breach returns the loan to the issuer as passive liquidity on the same book.

Built on Kuru Spot V2, Monad testnet.

## Layout

| Path | Contents |
| - | - |
| `contracts/` | Foundry project: escrow, obligation ledger, settlement |

## License

MIT
