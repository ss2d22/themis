/** Letter grade from verified uptime, mirroring the scale market-maker ratings already use. */
const scale = [
  ["AAA", 9_900],
  ["AA", 9_700],
  ["A", 9_500],
  ["BBB", 9_000],
  ["BB", 8_000],
  ["B", 7_000],
] as const;

export function grade(uptimeBps: number, clawbacks: number, defaults: number): string {
  if (defaults > 0) return "D";
  const index = scale.findIndex(([, min]) => uptimeBps >= min);
  const notch = (index === -1 ? scale.length : index) + clawbacks;
  return scale[notch]?.[0] ?? "CCC";
}
