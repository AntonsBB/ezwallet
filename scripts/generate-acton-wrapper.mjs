import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateTypeScriptFileForContract } from "@ton/tolk-abi-to-typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const abiPath = resolve(root, "chain/build/abi/EasyWalletEscrow.json");
const codePath = resolve(root, "chain/build/EasyWalletEscrow.json");
const outputPath = resolve(
  root,
  "chain/wrappers-ts/EasyWalletEscrow.gen.ts"
);

const [abi, code] = await Promise.all([
  readFile(abiPath, "utf8").then(JSON.parse),
  readFile(codePath, "utf8").then(JSON.parse),
]);

if (typeof code.code_boc64 !== "string" || !code.code_boc64) {
  throw new Error("Acton build output does not contain code_boc64.");
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  generateTypeScriptFileForContract(abi, code.code_boc64),
  "utf8"
);

console.log("Generated chain/wrappers-ts/EasyWalletEscrow.gen.ts");
