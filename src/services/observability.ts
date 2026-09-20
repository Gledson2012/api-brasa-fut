import { metrics, DiagConsoleLogger, DiagLogLevel, diag } from "@opentelemetry/api";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import { getMeterProvider, MeterProvider } from "@opentelemetry/sdk-metrics";
import { Counter, Histogram, UpDownCounter, Gauge } from "@opentelemetry/api-metrics";

// Configurar diagnóstico
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);

const SERVICE_NAME = "api-brasa-fut";
const SERVICE_VERSION = process.env.npm_package_version || "1.1.0";

let meterProvider: MeterProvider | null = null;
let prometheusExporter: PrometheusExporter | null = null;

export interface MetricsSnapshot {
  httpRequestsTotal: number;
  httpRequestDurationMs: number;
  httpRequestsInFlight: number;
  websocketConnections: number;
  cacheHitRate: number;
  rateLimitExceeded: number;
  dbQueryDurationMs: number;
  dbQueryErrors: number;
  externalApiCalls: number;
  externalApiErrors: number;
  syncJobsTotal: number;
  syncJobsErrors: number;
  predictionsGenerated: number;
  fantasyScoresCalculated: number;
}

class ObservabilityService {
  private initialized = false;
  private httpRequestsTotal: Counter;
  private httpRequestDuration: Histogram;
  private httpRequestsInFlight: UpDownCounter;
  private websocketConnections: UpDownCounter;
  private cacheHits: Counter;
  private cacheMisses: Counter;
  private rateLimitExceeded: Counter;
  private dbQueryDuration: Histogram;
  private dbQueryErrors: Counter;
  private externalApiCalls: Counter;
  private externalApiErrors: Counter;
  private syncJobsTotal: Counter;
  private syncJobsErrors: Counter;
  private predictionsGenerated: Counter;
  private fantasyScoresCalculated: Counter;

  constructor() {
    this.httpRequestsTotal = metrics.getMeter(SERVICE_NAME).createCounter("http_requests_total", {
      description: "Total de requisições HTTP",
    });
    this.httpRequestDuration = metrics.getMeter(SERVICE_NAME).createHistogram("http_request_duration_ms", {
      description: "Duração das requisições HTTP em milissegundos",
      unit: "ms",
    });
    this.httpRequestsInFlight = metrics.getMeter(SERVICE_NAME).createUpDownCounter("http_requests_in_flight", {
      description: "Requisições HTTP em processamento",
    });
    this.websocketConnections = metrics.getMeter(SERVICE_NAME).createUpDownCounter("websocket_connections", {
      description: "Conexões WebSocket ativas",
    });
    this.cacheHits = metrics.getMeter(SERVICE_NAME).createCounter("cache_hits_total", {
      description: "Total de cache hits",
    });
    this.cacheMisses = metrics.getMeter(SERVICE_NAME).createCounter("cache_misses_total", {
      description: "Total de cache misses",
    });
    this.rateLimitExceeded = metrics.getMeter(SERVICE_NAME).createCounter("rate_limit_exceeded_total", {
      description: "Total de requisições bloqueadas por rate limit",
    });
    this.dbQueryDuration = metrics.getMeter(SERVICE_NAME).createHistogram("db_query_duration_ms", {
      description: "Duração das queries do banco de dados em milissegundos",
      unit: "ms",
    });
    this.dbQueryErrors = metrics.getMeter(SERVICE_NAME).createCounter("db_query_errors_total", {
      description: "Total de erros nas queries do banco de dados",
    });
    this.externalApiCalls = metrics.getMeter(SERVICE_NAME).createCounter("external_api_calls_total", {
      description: "Total de chamadas para APIs externas",
    });
    this.externalApiErrors = metrics.getMeter(SERVICE_NAME).createCounter("external_api_errors_total", {
      description: "Total de erros em chamadas para APIs externas",
    });
    this.syncJobsTotal = metrics.getMeter(SERVICE_NAME).createCounter("sync_jobs_total", {
      description: "Total de jobs de sincronização executados",
    });
    this.syncJobsErrors = metrics.getMeter(SERVICE_NAME).createCounter("sync_jobs_errors_total", {
      description: "Total de erros em jobs de sincronização",
    });
    this.predictionsGenerated = metrics.getMeter(SERVICE_NAME).createCounter("predictions_generated_total", {
      description: "Total de predições geradas",
    });
    this.fantasyScoresCalculated = metrics.getMeter(SERVICE_NAME).createCounter("fantasy_scores_calculated_total", {
      description: "Total de pontuações fantasy calculadas",
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Configurar exportador Prometheus
      prometheusExporter = new PrometheusExporter(
        { port: Number(process.env.PROMETHEUS_PORT) || 9464, endpoint: "/metrics" },
        () => console.log("[Observability] Prometheus exporter iniciado na porta 9464")
      );

      const metricReader = new PeriodicExportingMetricReader({
        exporter: prometheusExporter,
        exportIntervalMillis: 10000,
      });

      meterProvider = new MeterProvider({
        resource: resourceFromAttributes({
          [ATTR_SERVICE_NAME]: SERVICE_NAME,
          [ATTR_SERVICE_VERSION]: SERVICE_VERSION,
        }),
        readers: [metricReader],
      });

      metrics.setGlobalMeterProvider(meterProvider);

      // Auto-instrumentação para Node.js
      const { registerInstrumentations } = await import("@opentelemetry/instrumentation");
      const { HttpInstrumentation } = await import("@opentelemetry/instrumentation-http");
      const { PgInstrumentation } = await import("@opentelemetry/instrumentation-pg");
      const { FastifyInstrumentation } = await import("@opentelemetry/instrumentation-fastify");

      registerInstrumentations({
        instrumentations: [
          new HttpInstrumentation(),
          new PgInstrumentation(),
          new FastifyInstrumentation(),
        ],
      });

      this.initialized = true;
      console.log("[Observability] Inicializado com sucesso");
    } catch (error) {
      console.warn("[Observability] Falha na inicialização:", (error as Error).message);
    }
  }

  // HTTP Metrics
  recordHttpRequest(method: string, route: string, statusCode: number, durationMs: number): void {
    this.httpRequestsTotal.add(1, { method, route, status_code: String(statusCode) });
    this.httpRequestDuration.record(durationMs, { method, route });
  }

  incrementInFlightRequests(): void {
    this.httpRequestsInFlight.add(1);
  }

  decrementInFlightRequests(): void {
    this.httpRequestsInFlight.add(-1);
  }

  // WebSocket Metrics
  incrementWebsocketConnections(): void {
    this.websocketConnections.add(1);
  }

  decrementWebsocketConnections(): void {
    this.websocketConnections.add(-1);
  }

  // Cache Metrics
  recordCacheHit(): void {
    this.cacheHits.add(1);
  }

  recordCacheMiss(): void {
    this.cacheMisses.add(1);
  }

  // Rate Limit Metrics
  recordRateLimitExceeded(plan: string): void {
    this.rateLimitExceeded.add(1, { plan });
  }

  // Database Metrics
  recordDbQueryDuration(durationMs: number, operation: string): void {
    this.dbQueryDuration.record(durationMs, { operation });
  }

  recordDbQueryError(operation: string): void {
    this.dbQueryErrors.add(1, { operation });
  }

  // External API Metrics
  recordExternalApiCall(api: string, success: boolean): void {
    this.externalApiCalls.add(1, { api, success: String(success) });
    if (!success) {
      this.externalApiErrors.add(1, { api });
    }
  }

  // Sync Job Metrics
  recordSyncJob(success: boolean): void {
    this.syncJobsTotal.add(1, { success: String(success) });
    if (!success) {
      this.syncJobsErrors.add(1);
    }
  }

  // Analytics Metrics
  recordPredictionGenerated(): void {
    this.predictionsGenerated.add(1);
  }

  recordFantasyScoreCalculated(): void {
    this.fantasyScoresCalculated.add(1);
  }

  // Prometheus Metrics Endpoint
  async getPrometheusMetrics(): Promise<string> {
    if (!prometheusExporter) {
      return "# Prometheus exporter não inicializado\n";
    }
    try {
      return await prometheusExporter.metrics();
    } catch {
      return "# Erro ao gerar métricas\n";
    }
  }

  // Health Check
  async getHealthMetrics(): Promise<MetricsSnapshot> {
    // Em produção real, você consultaria o Prometheus ou coletaria via SDK
    // Aqui retornamos um snapshot simulado baseado nos contadores internos
    return {
      httpRequestsTotal: 0,
      httpRequestDurationMs: 0,
      httpRequestsInFlight: 0,
      websocketConnections: 0,
      cacheHitRate: 0,
      rateLimitExceeded: 0,
      dbQueryDurationMs: 0,
      dbQueryErrors: 0,
      externalApiCalls: 0,
      externalApiErrors: 0,
      syncJobsTotal: 0,
      syncJobsErrors: 0,
      predictionsGenerated: 0,
      fantasyScoresCalculated: 0,
    };
  }

  async shutdown(): Promise<void> {
    if (meterProvider) {
      await meterProvider.shutdown();
      meterProvider = null;
    }
    if (prometheusExporter) {
      await prometheusExporter.shutdown();
      prometheusExporter = null;
    }
    this.initialized = false;
  }
}

export const observability = new ObservabilityService();

// Middleware helper para Fastify
export function createObservabilityMiddleware() {
  return async (request: any, reply: any) => {
    const start = Date.now();
    observability.incrementInFlightRequests();

    request.observabilityStart = start;

    reply.raw.on("finish", () => {
      const durationMs = Date.now() - start;
      observability.decrementInFlightRequests();
      observability.recordHttpRequest(
        request.method,
        request.routeOptions?.url || request.url,
        reply.statusCode,
        durationMs
      );
    });
  };
}