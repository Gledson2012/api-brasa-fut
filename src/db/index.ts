import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";
import * as dotenv from "dotenv";

dotenv.config();

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgrespassword@localhost:5432/brasa_fut";

// Disable prefetch as it is not supported for "Transaction" pool mode if using PgBouncer
export const client = postgres(connectionString);
export const db = drizzle(client, { schema });
