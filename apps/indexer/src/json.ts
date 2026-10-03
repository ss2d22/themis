/** JSON-safe copy of a value containing bigints. */
export function plain<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value, (_, v) => (typeof v === "bigint" ? v.toString() : v)));
}
