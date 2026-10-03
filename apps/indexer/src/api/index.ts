import { db } from "ponder:api";
import schema, {
  bounty,
  complianceChange,
  engagement,
  epoch,
  fill,
  observation,
  outcomeMarket,
  quote,
  stats,
  watcher,
} from "ponder:schema";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { and, asc, client, desc, eq, graphql, gte, sql } from "ponder";
import { grade } from "../grade";

const app = new Hono();

app.use("*", cors());
app.use("/sql/*", client({ db, schema }));
app.use("/graphql", graphql({ db, schema }));

function json(data: unknown) {
  return new Response(
    JSON.stringify(data, (_, v) => (typeof v === "bigint" ? v.toString() : v)),
    {
      headers: { "content-type": "application/json" },
    },
  );
}

function uptimeBps(row: typeof engagement.$inferSelect, head: bigint) {
  if (!row.startBlock || !row.endBlock) return 0;
  const until = head < row.endBlock ? head : row.endBlock;
  const elapsed = until - row.startBlock;
  return elapsed > 0n ? Number((row.creditedBlocks * 10_000n) / elapsed) : 0;
}

async function headBlock() {
  const [latest] = await db
    .select({ block: observation.block })
    .from(observation)
    .orderBy(desc(observation.block))
    .limit(1);
  return latest?.block ?? 0n;
}

app.get("/stats", async () => {
  const [row] = await db.select().from(stats).where(eq(stats.id, "global"));
  const watchers = await db.$count(watcher);
  return json({ ...row, watchers });
});

app.get("/engagements", async () => {
  const head = await headBlock();
  const rows = await db.select().from(engagement).orderBy(desc(engagement.id));
  return json(rows.map((row) => ({ ...row, uptimeBps: uptimeBps(row, head) })));
});

app.get("/engagements/:id", async (c) => {
  const id = BigInt(c.req.param("id"));
  const [row] = await db.select().from(engagement).where(eq(engagement.id, id));
  if (!row) return c.notFound();

  const head = await headBlock();
  const since = head > 54_000n ? head - 54_000n : 0n;
  const [observations, changes, epochs, fills, bounties, quotes, outcomes] = await Promise.all([
    db
      .select()
      .from(observation)
      .where(and(eq(observation.engagementId, id), gte(observation.block, since)))
      .orderBy(asc(observation.block)),
    db
      .select()
      .from(complianceChange)
      .where(eq(complianceChange.engagementId, id))
      .orderBy(desc(complianceChange.block))
      .limit(100),
    db.select().from(epoch).where(eq(epoch.engagementId, id)).orderBy(asc(epoch.epoch)),
    db.select().from(fill).where(eq(fill.engagementId, id)).orderBy(desc(fill.block)).limit(200),
    db.select().from(bounty).where(eq(bounty.engagementId, id)).orderBy(desc(bounty.block)).limit(100),
    db.select().from(quote).where(eq(quote.engagementId, id)).orderBy(desc(quote.block)).limit(50),
    db.select().from(outcomeMarket).where(eq(outcomeMarket.engagementId, id)),
  ]);
  return json({
    engagement: { ...row, uptimeBps: uptimeBps(row, head) },
    head,
    observations,
    changes,
    epochs,
    fills,
    bounties,
    quotes,
    outcomes,
  });
});

app.get("/makers", async () => {
  const head = await headBlock();
  const rows = await db.select().from(engagement);
  const makers = new Map<
    string,
    {
      engagements: number;
      credited: bigint;
      elapsed: bigint;
      clawbacks: number;
      defaults: number;
      failedEpochs: number;
    }
  >();
  for (const row of rows) {
    if (!row.startBlock || !row.endBlock) continue;
    const m = makers.get(row.maker) ?? {
      engagements: 0,
      credited: 0n,
      elapsed: 0n,
      clawbacks: 0,
      defaults: 0,
      failedEpochs: 0,
    };
    const until = head < row.endBlock ? head : row.endBlock;
    m.engagements += 1;
    m.credited += row.creditedBlocks;
    m.elapsed += until > row.startBlock ? until - row.startBlock : 0n;
    m.failedEpochs += row.epochsFailed;
    if (row.status === 5) m.clawbacks += 1;
    const settlement = row.settlement as { deficit?: string } | null;
    if (settlement?.deficit && settlement.deficit !== "0") m.defaults += 1;
    makers.set(row.maker, m);
  }
  const leaderboard = [...makers.entries()].map(([maker, m]) => {
    const uptime = m.elapsed > 0n ? Number((m.credited * 10_000n) / m.elapsed) : 0;
    return { maker, ...m, uptimeBps: uptime, grade: grade(uptime, m.clawbacks, m.defaults), source: "chain" };
  });
  leaderboard.sort((a, b) => b.uptimeBps - a.uptimeBps);
  return json(leaderboard);
});

/** Activity per time bucket, for traction charts. `bucket` is in seconds. */
app.get("/timeseries", async (c) => {
  const requested = Math.trunc(Number(c.req.query("bucket") ?? 3_600));
  const bucket = Number.isFinite(requested) ? Math.min(86_400, Math.max(60, requested)) : 3_600;
  // Inlined so the select and group by are the same expression; it is a clamped integer, never user text.
  const size = sql.raw(String(bucket));
  const series = async (
    table: typeof fill | typeof quote | typeof observation | typeof complianceChange,
    value = sql<string>`count(*)`,
    where?: ReturnType<typeof eq>,
  ) => {
    const t = sql<string>`floor(${table.timestamp} / ${size}) * ${size}`;
    const rows = await db.select({ t, v: value }).from(table).where(where).groupBy(t).orderBy(t);
    return rows.map((r) => ({ time: Number(r.t), value: Number(r.v) }));
  };
  const [fills, quotes, observations, credited, breaches] = await Promise.all([
    series(fill),
    series(quote),
    series(observation),
    series(observation, sql<string>`sum(${observation.credited})`),
    series(complianceChange, sql<string>`count(*)`, eq(complianceChange.compliant, false)),
  ]);
  return json({ bucket, fills, quotes, observations, credited, breaches });
});

app.get("/watchers", async () =>
  json(await db.select().from(watcher).orderBy(desc(watcher.earned)).limit(50)),
);

app.get("/outcomes", async () => json(await db.select().from(outcomeMarket).orderBy(desc(outcomeMarket.id))));

export default app;
