import { buildApp } from "./app.js";

const app = buildApp();

async function start() {
  const port = Number(process.env.PORT) || 3333;
  const host = process.env.HOST || "0.0.0.0";

  try {
    await app.listen({ port, host });
    console.log(`\n🚀 BrasaFut API rodando em http://localhost:${port}`);
    console.log(`📖 Documentação Swagger em http://localhost:${port}/docs`);
    console.log(`⚡ WebSocket de Jogos Ao Vivo em ws://localhost:${port}/api/v1/live/ws\n`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

async function shutdown(signal: string) {
  app.log.info({ signal }, "Shutting down gracefully...");
  try {
    await app.close();
    process.exit(0);
  } catch (err) {
    app.log.error(err, "Error during shutdown");
    process.exit(1);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

start();
