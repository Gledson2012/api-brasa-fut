import { buildApp } from "../src/app.js";

const app = buildApp();

export default async function handler(req: any, res: any) {
  await app.ready();
  await new Promise<void>((resolve, reject) => {
    res.on("finish", resolve);
    res.on("close", resolve);
    res.on("error", reject);
    app.server.emit("request", req, res);
  });
}
