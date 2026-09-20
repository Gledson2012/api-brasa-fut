ALTER TABLE "api_keys" DROP CONSTRAINT IF EXISTS "api_keys_key_unique";--> statement-breakpoint
ALTER TABLE "api_keys" DROP COLUMN IF EXISTS "key";