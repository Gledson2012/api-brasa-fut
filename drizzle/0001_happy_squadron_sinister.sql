-- As chaves de API deixam de ser persistidas em texto puro:
-- passamos a guardar apenas o SHA-256 (key_hash) e um prefixo de exibição.
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "key_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "key_prefix" varchar(24);--> statement-breakpoint
UPDATE "api_keys"
   SET "key_hash" = encode(sha256("key"::bytea), 'hex'),
       "key_prefix" = left("key", 12)
 WHERE "key_hash" IS NULL;--> statement-breakpoint
ALTER TABLE "api_keys" ALTER COLUMN "key_hash" SET NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_api_keys_key_hash" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash");--> statement-breakpoint
DROP INDEX IF EXISTS "idx_api_keys_key";
