import type { Context } from "ponder:registry";
import { stats } from "ponder:schema";

type Counters = Omit<typeof stats.$inferInsert, "id">;
type Db = Context["db"];

/** Adds `delta` to the global counters. */
export async function bump(db: Db, delta: Counters) {
  await db
    .insert(stats)
    .values({ id: "global", ...delta })
    .onConflictDoUpdate((row) => ({
      engagements: row.engagements + (delta.engagements ?? 0),
      quotes: row.quotes + (delta.quotes ?? 0),
      observations: row.observations + (delta.observations ?? 0),
      blocksCredited: row.blocksCredited + (delta.blocksCredited ?? 0n),
      breaches: row.breaches + (delta.breaches ?? 0),
      epochsClosed: row.epochsClosed + (delta.epochsClosed ?? 0),
      clawbacks: row.clawbacks + (delta.clawbacks ?? 0),
      settlements: row.settlements + (delta.settlements ?? 0),
      fills: row.fills + (delta.fills ?? 0),
      bountiesPaid: row.bountiesPaid + (delta.bountiesPaid ?? 0n),
    }));
}
