import { EspnSyncService } from "../src/services/espnSync.js";
import { client } from "../src/db/index.js";

async function main() {
  console.log("Iniciando sincronização com ESPN...");
  const res = await EspnSyncService.syncAll();
  console.log("Resultado ESPN Sync:", res);
  await client.end();
}

main();
