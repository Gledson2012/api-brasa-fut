import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";
import * as dotenv from "dotenv";

dotenv.config();

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  "postgresql://postgres:postgrespassword@localhost:5432/brasa_fut";

export const client = postgres(connectionString, {
  max: process.env.VERCEL ? 1 : 10,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl:
    process.env.DATABASE_URL?.includes("sslmode=require") || process.env.VERCEL
      ? "prefer"
      : undefined,
});

export const db = drizzle(client, { schema });
