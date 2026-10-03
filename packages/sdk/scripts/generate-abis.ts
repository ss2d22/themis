import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const out = join(import.meta.dirname, "../../../contracts/out");
const target = join(import.meta.dirname, "../src/abi");

const contracts = [
  ["Covenant.sol", "Covenant", "covenantAbi"],
  ["OutcomeMarket.sol", "OutcomeMarket", "outcomeMarketAbi"],
  ["OutcomeToken.sol", "OutcomeToken", "outcomeTokenAbi"],
  ["IKuruOrderBook.sol", "IKuruOrderBook", "kuruOrderBookAbi"],
  ["IKuruAccountCore.sol", "IKuruAccountCore", "kuruAccountCoreAbi"],
] as const;

const index: string[] = [];
for (const [file, name, exportName] of contracts) {
  const artifact = JSON.parse(readFileSync(join(out, file, `${name}.json`), "utf8"));
  const body = `export const ${exportName} = ${JSON.stringify(artifact.abi, null, 2)} as const;\n`;
  writeFileSync(join(target, `${exportName}.ts`), body);
  index.push(`export { ${exportName} } from "./${exportName}";`);
}
writeFileSync(join(target, "index.ts"), `${index.join("\n")}\n`);
console.log(`wrote ${contracts.length} ABIs`);
