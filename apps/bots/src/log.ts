import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import pino from "pino";

export function createLogger(file: string, name: string) {
  mkdirSync(dirname(file), { recursive: true });
  return pino(
    { name, base: { bot: name }, timestamp: pino.stdTimeFunctions.isoTime },
    pino.multistream([
      { stream: process.stdout },
      { stream: pino.destination({ dest: file, append: true }) },
    ]),
  );
}

export type Logger = ReturnType<typeof createLogger>;
