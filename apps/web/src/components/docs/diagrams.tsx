/** Explanatory diagrams. Colours come from the theme tokens so both themes render correctly. */

const box = { fill: "var(--raised)", stroke: "var(--line-strong)" };
const label = "fill-ink text-[12px] font-medium";
const note = "fill-ink-3 text-[11px]";

function Arrow({ d, id = "arrow" }: { d: string; id?: string }) {
  return <path d={d} fill="none" stroke="var(--ink-3)" strokeWidth={1.25} markerEnd={`url(#${id})`} />;
}

function Defs({ id = "arrow" }: { id?: string }) {
  return (
    <defs>
      <marker
        id={id}
        viewBox="0 0 8 8"
        refX="7"
        refY="4"
        markerWidth="7"
        markerHeight="7"
        orient="auto-start-reverse"
      >
        <path d="M0 0 L8 4 L0 8 z" fill="var(--ink-3)" />
      </marker>
    </defs>
  );
}

/** Who holds what, and which way calls flow. */
export function SystemDiagram() {
  return (
    <svg
      viewBox="0 0 720 300"
      className="w-full"
      role="img"
      aria-label="Issuer and market maker fund the escrow, which alone trades a Kuru account"
    >
      <Defs id="sys" />
      <rect x="20" y="20" width="160" height="56" rx="4" {...box} />
      <text x="100" y="44" textAnchor="middle" className={label}>
        Issuer
      </text>
      <text x="100" y="62" textAnchor="middle" className={note}>
        loan, retainer
      </text>

      <rect x="20" y="224" width="160" height="56" rx="4" {...box} />
      <text x="100" y="248" textAnchor="middle" className={label}>
        Market maker
      </text>
      <text x="100" y="266" textAnchor="middle" className={note}>
        collateral, bond, quotes
      </text>

      <rect x="280" y="112" width="180" height="76" rx="4" fill="var(--accent-soft)" stroke="var(--accent)" />
      <text x="370" y="140" textAnchor="middle" className={label}>
        Covenant escrow
      </text>
      <text x="370" y="158" textAnchor="middle" className={note}>
        gate · ledger · settlement
      </text>
      <text x="370" y="174" textAnchor="middle" className={note}>
        post-fill hook
      </text>

      <rect x="560" y="112" width="140" height="76" rx="4" {...box} />
      <text x="630" y="140" textAnchor="middle" className={label}>
        Kuru order book
      </text>
      <text x="630" y="158" textAnchor="middle" className={note}>
        subaccount owned
      </text>
      <text x="630" y="174" textAnchor="middle" className={note}>
        by the escrow
      </text>

      <rect x="280" y="20" width="180" height="56" rx="4" {...box} />
      <text x="370" y="44" textAnchor="middle" className={label}>
        Watchtowers
      </text>
      <text x="370" y="62" textAnchor="middle" className={note}>
        anyone, paid from the bond
      </text>

      <rect x="280" y="224" width="180" height="56" rx="4" {...box} />
      <text x="370" y="248" textAnchor="middle" className={label}>
        Outcome market
      </text>
      <text x="370" y="266" textAnchor="middle" className={note}>
        KEPT / BROKEN, reads the ledger
      </text>

      <Arrow id="sys" d="M180 48 C 230 48, 240 120, 278 132" />
      <Arrow id="sys" d="M180 252 C 230 252, 240 180, 278 168" />
      <Arrow id="sys" d="M462 150 L 556 150" />
      <Arrow id="sys" d="M370 78 L 370 108" />
      <Arrow id="sys" d="M370 220 L 370 192" />
      <text x="509" y="142" textAnchor="middle" className={note}>
        post-only only
      </text>
      <text x="188" y="38" className={note}>
        escrows
      </text>
      <text x="188" y="274" className={note}>
        quotes
      </text>
    </svg>
  );
}

/** The ledger credits an interval only when both of its ends were observed compliant. */
export function LedgerDiagram() {
  const ticks = [60, 180, 300, 420, 540, 660];
  const ok = [true, true, false, true, true, true];
  return (
    <svg
      viewBox="0 0 720 170"
      className="w-full"
      role="img"
      aria-label="Intervals between two compliant observations are credited; any interval touching a breach is not"
    >
      <line x1="40" x2="690" y1="90" y2="90" stroke="var(--line-strong)" />
      {ticks.slice(0, -1).map((x, i) => {
        const credited = ok[i] && ok[i + 1];
        return (
          <g key={x}>
            <rect
              x={x + 4}
              y="78"
              width="112"
              height="24"
              rx="2"
              style={{
                fill: credited ? "color-mix(in oklab, var(--accent) 35%, var(--diverge-mid))" : "transparent",
              }}
              stroke={credited ? "none" : "var(--critical)"}
              strokeDasharray={credited ? undefined : "4 3"}
            />
            <text
              x={x + 60}
              y="94"
              textAnchor="middle"
              className={credited ? "fill-ink text-[11px]" : "fill-critical text-[11px]"}
            >
              {credited ? "credited" : "not credited"}
            </text>
          </g>
        );
      })}
      {ticks.map((x, i) => (
        <g key={x}>
          <circle
            cx={x}
            cy="90"
            r="6"
            fill={ok[i] ? "var(--good)" : "var(--critical)"}
            stroke="var(--panel)"
            strokeWidth="2"
          />
          <text x={x} y="62" textAnchor="middle" className="fill-ink-3 text-[11px]">
            {ok[i] ? "compliant" : "breach"}
          </text>
        </g>
      ))}
      <text x="40" y="136" className="fill-ink-3 text-[11px]">
        Observations happen on every quote, every hook call and every poke. A dip from a partial fill between
        two
      </text>
      <text x="40" y="152" className="fill-ink-3 text-[11px]">
        observations is seen at the next one, so the whole interval goes uncredited. Credit per interval is
        also capped.
      </text>
    </svg>
  );
}

/** From failed epochs to the loan returning to the book. */
export function ClawbackDiagram() {
  const steps = [
    ["Epoch fails", "uptime below target"],
    ["Streak hits limit", "e.g. 3 in a row"],
    ["Anyone claws back", "bounty from bond"],
    ["Settle with penalty", "slash part of the bond"],
    ["Loan back on Kuru", "as passive liquidity"],
  ];
  return (
    <svg
      viewBox="0 0 720 96"
      className="w-full"
      role="img"
      aria-label="Failed epochs lead to clawback, which returns the loan to the book as passive liquidity"
    >
      <Defs id="claw" />
      {steps.map(([title, sub], i) => {
        const x = 8 + i * 144;
        return (
          <g key={title}>
            <rect
              x={x}
              y="16"
              width="124"
              height="60"
              rx="4"
              {...box}
              stroke={i === 4 ? "var(--accent)" : box.stroke}
            />
            <text x={x + 62} y="42" textAnchor="middle" className="fill-ink text-[11.5px] font-medium">
              {title}
            </text>
            <text x={x + 62} y="60" textAnchor="middle" className={note}>
              {sub}
            </text>
            {i < steps.length - 1 ? <Arrow id="claw" d={`M${x + 126} 46 L ${x + 142} 46`} /> : null}
          </g>
        );
      })}
    </svg>
  );
}
