import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildApp } from "../src/app.js";

async function main() {
  console.log("Gerando especificação OpenAPI oficial da BrasaFut API...");
  const app = buildApp();
  await app.ready();
  const spec = app.swagger();
  const outputPath = resolve(process.cwd(), "openapi.json");
  writeFileSync(outputPath, JSON.stringify(spec, null, 2), "utf-8");
  console.log(`✅ Especificação OpenAPI gerada com sucesso em: ${outputPath}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Erro ao gerar OpenAPI:", err);
  process.exit(1);
});
