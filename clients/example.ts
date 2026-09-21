/**
 * Exemplo de consumo dos endpoints de Atletas pelo aplicativo.
 * Rode com:  npx tsx clients/example.ts
 * Env:       BRASAFUT_BASE_URL + BRASAFUT_API_KEY
 */
import { createPlayersClient } from "./players.js";

const baseUrl = process.env.BRASAFUT_BASE_URL || "http://localhost:3333";
const apiKey = process.env.BRASAFUT_API_KEY || "";

if (!apiKey) {
  console.error("❌ Defina BRASAFUT_API_KEY via env.");
  process.exit(1);
}

const players = createPlayersClient({ baseUrl, apiKey });

const { data } = await players.list({ search: "Memphis", limit: 5 });
console.log(`Encontrados: ${data.length}`);
for (const p of data) {
  console.log(`- #${p.id} ${p.knownName || `${p.firstName} ${p.lastName}`} (${p.primaryPosition}, ${p.nationality})`);
}

if (data[0]) {
  const stats = await players.getStatistics<unknown>(data[0].id);
  console.log("\nEstatísticas:", JSON.stringify(stats).slice(0, 300), "...");
}
