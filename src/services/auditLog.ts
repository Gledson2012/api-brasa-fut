import type { FastifyBaseLogger } from "fastify";

export type AuditAction =
  | "key.rotate"
  | "webhook.create"
  | "webhook.delete"
  | "webhook.test"
  | "match.event.create"
  | "match.score.update"
  | "standings.simulate"
  | "auth.enterprise.register";

export interface AuditEntry {
  action: AuditAction;
  userId?: number;
  userEmail?: string;
  userPlan?: string;
  resourceType?: string;
  resourceId?: string | number;
  ip: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

let _logger: FastifyBaseLogger | null = null;

export function setAuditLogger(logger: FastifyBaseLogger) {
  _logger = logger;
}

export function auditLog(entry: AuditEntry) {
  const record = {
    audit: true,
    ts: new Date().toISOString(),
    ...entry,
  };

  if (_logger) {
    _logger.info(record, `audit:${entry.action}`);
  } else {
    console.log(JSON.stringify(record));
  }
}
