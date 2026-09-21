import type { CachedApiKey } from "../services/apiKeyCache.js";

declare module "fastify" {
  interface FastifyRequest {
    apiUser: CachedApiKey | undefined;
  }
}
