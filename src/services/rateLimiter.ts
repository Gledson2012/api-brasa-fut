interface RateLimitRecord {
  timestamps: number[];
}

export class RateLimiter {
  private windowMs: number;
  private records: Map<string, RateLimitRecord> = new Map();

  constructor(windowSeconds: number = 60) {
    this.windowMs = windowSeconds * 1000;

    // Limpeza periódica a cada 2 minutos para evitar acúmulo de memória
    setInterval(() => {
      const now = Date.now();
      for (const [key, record] of this.records.entries()) {
        record.timestamps = record.timestamps.filter((t) => now - t < this.windowMs);
        if (record.timestamps.length === 0) {
          this.records.delete(key);
        }
      }
    }, 120000).unref();
  }

  public check(key: string, limit: number): {
    allowed: boolean;
    limit: number;
    remaining: number;
    resetSeconds: number;
  } {
    const now = Date.now();
    let record = this.records.get(key);

    if (!record) {
      record = { timestamps: [] };
      this.records.set(key, record);
    }

    // Filtrar timestamps que saíram da janela de 60 segundos
    record.timestamps = record.timestamps.filter((t) => now - t < this.windowMs);

    const oldest = record.timestamps[0] || now;
    const resetSeconds = Math.max(1, Math.ceil((oldest + this.windowMs - now) / 1000));

    if (record.timestamps.length >= limit) {
      return {
        allowed: false,
        limit,
        remaining: 0,
        resetSeconds,
      };
    }

    // Registrar nova requisição
    record.timestamps.push(now);
    const remaining = limit - record.timestamps.length;

    return {
      allowed: true,
      limit,
      remaining,
      resetSeconds,
    };
  }
}

export const rateLimiter = new RateLimiter(60);
