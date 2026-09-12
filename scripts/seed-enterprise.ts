import { db, client } from "../src/db/index.js";
import { apiKeys } from "../src/db/schema.js";
import { hashPassword } from "../src/utils/password.js";
import { eq } from "drizzle-orm";

async function main() {
  const email = "enterprise@brasafut.com.br";
  const passHash = hashPassword("BrasaFut@Enterprise2026");
  const key = "bf_live_enterprise_9f83a21c45e87b60d4e92a11bf738e45";

  const [existing] = await db.select().from(apiKeys).where(eq(apiKeys.email, email));
  if (existing) {
    await db.update(apiKeys).set({
      userName: "enterprise_admin",
      passwordHash: passHash,
      key,
      plan: "ENTERPRISE",
      rateLimitPerMinute: 1000,
      isActive: true,
      updatedAt: new Date(),
    }).where(eq(apiKeys.id, existing.id));
    console.log("Updated local enterprise account!");
  } else {
    await db.insert(apiKeys).values({
      userName: "enterprise_admin",
      email,
      passwordHash: passHash,
      key,
      plan: "ENTERPRISE",
      rateLimitPerMinute: 1000,
      isActive: true,
    });
    console.log("Inserted local enterprise account!");
  }

  // Also update demo & free accounts with passwords if they lack them
  await db.update(apiKeys).set({
    passwordHash: hashPassword("DevPro@2026"),
  }).where(eq(apiKeys.email, "dev@brasafut.com.br"));

  await db.update(apiKeys).set({
    passwordHash: hashPassword("FreeUser@2026"),
  }).where(eq(apiKeys.email, "free@brasafut.com.br"));

  console.log("Passwords set for all demo accounts!");
  await client.end();
}

main().catch(console.error);
