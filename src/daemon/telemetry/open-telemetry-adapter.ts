import type { Telemetry, TelemetrySpan } from "./telemetry.js";
import type {
  TelemetryStatus,
  ExporterState,
  LoopTelemetryInput,
  TaskTelemetryInput,
  CommandTelemetryInput,
  RetryTelemetryInput,
  ChildTelemetryContext,
  PreparedChildProcessTelemetry,
  AgentUsage,
  CommandInvocation,
} from "./telemetry-types.js";
import type { DaemonSettings } from "../../types.js";
import { SPAN_NAMES, CORRELATION_KEYS, METRIC_NAMES } from "./telemetry-types.js";
import { detectAgentIntegration, getAgentIntegrations } from "./agent-integrations/index.js";

import { NodeSDK } from "@opentelemetry/sdk-node";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPTraceExporter as OTLPTraceExporterGrpc } from "@opentelemetry/exporter-trace-otlp-grpc";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPMetricExporter as OTLPMetricExporterGrpc } from "@opentelemetry/exporter-metrics-otlp-grpc";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { trace, context, propagation, metrics, SpanStatusCode, SpanKind, type Span, type Tracer } from "@opentelemetry/api";
import type { Context, Meter, Counter, Histogram } from "@opentelemetry/api";
import { logs, type Logger } from "@opentelemetry/api-logs";
import { LoggerProvider, type LogRecordExporter, SimpleLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPLogExporter as OTLPLogExporterGrpc } from "@opentelemetry/exporter-logs-otlp-grpc";

import { daemonLog } from "../daemon-log.js";

class OtelSpan implements TelemetrySpan {
  private ended = false;
  private startTime: number;
  private onEnd?: (durationMs: number, status: string) => void;

  constructor(
    private span: Span,
    private ctx: Context,
    onEnd?: (durationMs: number, status: string) => void,
  ) {
    this.onEnd = onEnd;
    this.startTime = Date.now();
  }

  setAttribute(key: string, value: string | number | boolean): void {
    this.span.setAttribute(key, value);
  }

  setAttributes(attrs: Record<string, string | number | boolean>): void {
    for (const [k, v] of Object.entries(attrs)) {
      this.span.setAttribute(k, v);
    }
  }

  recordError(error: unknown): void {
    if (error instanceof Error) {
      this.span.recordException(error);
    } else {
      this.span.recordException(String(error));
    }
    this.span.setStatus({ code: SpanStatusCode.ERROR, message: error instanceof Error ? error.message : String(error) });
  }

  ok(): void {
    this.span.setStatus({ code: SpanStatusCode.OK });
    this.span.end();
    this.emitMetric("ok");
  }

  end(status?: "ok" | "error" | "cancelled"): void {
    if (status === "error") {
      this.span.setStatus({ code: SpanStatusCode.ERROR });
    } else if (status === "cancelled") {
      this.span.setStatus({ code: SpanStatusCode.ERROR, message: "cancelled" });
    }
    this.span.end();
    this.emitMetric(status ?? "ok");
  }

  getTraceContext(): { traceParent?: string; traceState?: string } {
    const carrier: Record<string, string> = {};
    propagation.inject(this.ctx, carrier, {
      set: (c: Record<string, string>, k: string, v: string) => { c[k] = v; },
    });
    return {
      traceParent: carrier.traceparent,
      traceState: carrier.tracestate,
    };
  }

  private emitMetric(status: string): void {
    if (this.ended) return;
    this.ended = true;
    if (this.onEnd) {
      this.onEnd(Date.now() - this.startTime, status);
    }
  }
}

/**
 * OpenTelemetry SDK-backed adapter. Manages the full SDK lifecycle
 * including tracer, meter, and exporters.
 */
export class OpenTelemetryAdapter implements Telemetry {
  private sdk: NodeSDK | null = null;
  private tracerProvider: NodeTracerProvider | null = null;
  private loggerProvider: LoggerProvider | null = null;
  private tracer: Tracer;
  private meter: Meter;
  private logger: Logger;
  private settings: DaemonSettings;
  private status: TelemetryStatus;
  private lastExportError: string | undefined;
  private lastSuccessfulExport: string | undefined;

  // Metric instruments
  private runCounter: Counter;
  private runDurationHistogram: Histogram;
  private taskCounter: Counter;
  private taskDurationHistogram: Histogram;
  private taskRetriesCounter: Counter;
  private commandCounter: Counter;
  private commandDurationHistogram: Histogram;
  private agentExecCounter: Counter;
  private agentDurationHistogram: Histogram;
  private agentInputTokensCounter: Counter;
  private agentOutputTokensCounter: Counter;
  private agentCacheReadTokensCounter: Counter;
  private agentCacheWriteTokensCounter: Counter;
  private agentCostCounter: Counter;
  private failureCounter: Counter;

  constructor(settings: DaemonSettings) {
    this.settings = settings;
    this.tracer = trace.getTracer("loop-task");
    this.meter = metrics.getMeter("loop-task");
    this.logger = logs.getLogger("loop-task");

    this.status = {
      enabled: settings.telemetryEnabled,
      exporterConfigured: !!settings.telemetryEndpoint,
      endpoint: settings.telemetryEndpoint,
      protocol: settings.telemetryProtocol,
      serviceName: settings.telemetryServiceName,
      autoInstrumentAgents: settings.telemetryAutoInstrumentAgents,
      captureContent: settings.telemetryCaptureContent,
      captureCommandOutput: settings.telemetryCaptureCommandOutput,
      exporterState: this.resolveExporterState(settings),
    };

    if (settings.telemetryEnabled && settings.telemetryEndpoint) {
      this.initializeSdk(settings);
    }

    // Initialize metric instruments AFTER SDK startup so they bind to the
    // real MeterProvider, not the default no-op one. When the SDK is not
    // initialized, these still work — they bind to the API-level no-op meter.
    this.runCounter = this.meter.createCounter(METRIC_NAMES.RUNS);
    this.runDurationHistogram = this.meter.createHistogram(METRIC_NAMES.RUN_DURATION);
    this.taskCounter = this.meter.createCounter(METRIC_NAMES.TASKS);
    this.taskDurationHistogram = this.meter.createHistogram(METRIC_NAMES.TASK_DURATION);
    this.taskRetriesCounter = this.meter.createCounter(METRIC_NAMES.TASK_RETRIES);
    this.commandCounter = this.meter.createCounter(METRIC_NAMES.COMMANDS);
    this.commandDurationHistogram = this.meter.createHistogram(METRIC_NAMES.COMMAND_DURATION);
    this.agentExecCounter = this.meter.createCounter(METRIC_NAMES.AGENT_EXECUTIONS);
    this.agentDurationHistogram = this.meter.createHistogram(METRIC_NAMES.AGENT_DURATION);
    this.agentInputTokensCounter = this.meter.createCounter(METRIC_NAMES.AGENT_INPUT_TOKENS);
    this.agentOutputTokensCounter = this.meter.createCounter(METRIC_NAMES.AGENT_OUTPUT_TOKENS);
    this.agentCacheReadTokensCounter = this.meter.createCounter(METRIC_NAMES.AGENT_CACHE_READ_TOKENS);
    this.agentCacheWriteTokensCounter = this.meter.createCounter(METRIC_NAMES.AGENT_CACHE_WRITE_TOKENS);
    this.agentCostCounter = this.meter.createCounter(METRIC_NAMES.AGENT_COST);
    this.failureCounter = this.meter.createCounter(METRIC_NAMES.FAILURES);
  }

  private resolveExporterState(settings: DaemonSettings): ExporterState {
    if (!settings.telemetryEnabled) return "disabled";
    if (!settings.telemetryEndpoint) return "not-configured";
    return "configured";
  }

  private initializeSdk(settings: DaemonSettings): void {
    try {
      const resource = resourceFromAttributes({
        [ATTR_SERVICE_NAME]: settings.telemetryServiceName,
        [ATTR_SERVICE_VERSION]: "2.2.6",
      });

      const isGrpc = settings.telemetryProtocol === "grpc";
      const headers = this.resolveHeaders();

      const endpoint = settings.telemetryEndpoint ?? "";
      const tracesUrl = endpoint.endsWith("/v1/traces")
        ? endpoint
        : `${endpoint}/v1/traces`;
      const metricsUrl = endpoint.endsWith("/v1/metrics")
        ? endpoint
        : `${endpoint}/v1/metrics`;

      const traceExporter = isGrpc
        ? new OTLPTraceExporterGrpc({ url: settings.telemetryEndpoint })
        : new OTLPTraceExporter({ url: tracesUrl, headers });

      const spanProcessor = new BatchSpanProcessor(traceExporter, {
        maxQueueSize: 2048,
        scheduledDelayMillis: 5000,
        maxExportBatchSize: 512,
      });

      const tracerProvider = new NodeTracerProvider({
        resource,
        spanProcessors: [spanProcessor],
      });
      this.tracerProvider = tracerProvider;
      tracerProvider.register();

      const metricExporter = isGrpc
        ? new OTLPMetricExporterGrpc({ url: settings.telemetryEndpoint })
        : new OTLPMetricExporter({ url: metricsUrl, headers });

      const metricReader = new PeriodicExportingMetricReader({
        exporter: metricExporter,
        exportIntervalMillis: 30_000,
      });

      this.sdk = new NodeSDK({
        resource,
        metricReader,
        instrumentations: [],
      });

      this.sdk.start();
      // Re-obtain tracer and meter from the global API after SDK startup.
      // The API now resolves to the real providers registered by NodeSDK.
      this.tracer = trace.getTracer(settings.telemetryServiceName);
      this.meter = metrics.getMeter(settings.telemetryServiceName);

      // Initialize OTLP log exporter
      const logsUrl = endpoint.endsWith("/v1/logs")
        ? endpoint
        : `${endpoint}/v1/logs`;
      const logExporter: LogRecordExporter = isGrpc
        ? new OTLPLogExporterGrpc({ url: settings.telemetryEndpoint })
        : new OTLPLogExporter({ url: logsUrl, headers });
      const loggerProvider = new LoggerProvider({
        resource,
        processors: [new SimpleLogRecordProcessor({ exporter: logExporter })],
      });
      logs.setGlobalLoggerProvider(loggerProvider);
      this.loggerProvider = loggerProvider;
      this.logger = logs.getLogger(settings.telemetryServiceName);

      this.status.exporterState = "configured";
      daemonLog(`telemetry: SDK initialized, endpoint=${settings.telemetryEndpoint}`);
    } catch (err) {
      daemonLog(`telemetry: SDK initialization failed: ${String(err)}`);
      this.status.exporterState = "unavailable";
      this.lastExportError = err instanceof Error ? err.message : String(err);
    }
  }

  private resolveHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    const envHeaders = process.env.OTEL_EXPORTER_OTLP_HEADERS
      ?? process.env.OTEL_EXPORTER_OTLP_TRACES_HEADERS;
    if (envHeaders) {
      for (const pair of envHeaders.split(",")) {
        const [k, v] = pair.split("=", 2);
        if (k && v) headers[k.trim()] = v.trim();
      }
    }
    return headers;
  }

  resolveEndpoint(): string | undefined {
    return this.settings.telemetryEndpoint
      ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  }

  resolveProtocol(): "grpc" | "http/protobuf" {
    const envProtocol = process.env.OTEL_EXPORTER_OTLP_PROTOCOL;
    if (envProtocol === "grpc") return "grpc";
    if (envProtocol === "http/protobuf") return "http/protobuf";
    return this.settings.telemetryProtocol;
  }

  /**
   * Check if any agent serve sidecar is alive.
   * When serve is alive, static OTEL config lives in the serve process
   * and we skip per-task injection.
   */
  private checkServeAlive(): boolean {
    try {
      const integrations = getAgentIntegrations();
      for (const integration of integrations) {
        if (integration.isServeAlive?.()) return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  startLoop(input: LoopTelemetryInput): TelemetrySpan {
    const span = this.tracer.startSpan(SPAN_NAMES.LOOP_RUN, { kind: SpanKind.SERVER });
    span.setAttributes({
      [CORRELATION_KEYS.RUN_ID]: input.runId,
      [CORRELATION_KEYS.LOOP_ID]: input.loopId,
      [CORRELATION_KEYS.LOOP_NAME]: input.loopName,
      ...(input.projectId ? { [CORRELATION_KEYS.PROJECT_ID]: input.projectId } : {}),
      ...(input.projectName ? { [CORRELATION_KEYS.PROJECT_NAME]: input.projectName } : {}),
    });
    const ctx = trace.setSpan(context.active(), span);
    this.runCounter.add(1, { "loop_task.loop.id": input.loopId, "loop_task.loop.name": input.loopName });
    return new OtelSpan(span, ctx, (durationMs, status) => {
      this.runDurationHistogram.record(durationMs, { "loop_task.loop.id": input.loopId, status });
      if (status === "error") this.failureCounter.add(1, { "loop_task.span": "loop" });
    });
  }

  startTask(input: TaskTelemetryInput, parent?: TelemetrySpan): TelemetrySpan {
    const parentCtx = parent instanceof OtelSpan ? parent["ctx"] : context.active();
    const span = this.tracer.startSpan(SPAN_NAMES.TASK_EXECUTE, { kind: SpanKind.CONSUMER }, parentCtx);
    span.setAttributes({
      [CORRELATION_KEYS.RUN_ID]: input.runId,
      [CORRELATION_KEYS.LOOP_ID]: input.loopId,
      [CORRELATION_KEYS.LOOP_NAME]: input.loopName,
      [CORRELATION_KEYS.TASK_ID]: input.taskId,
      [CORRELATION_KEYS.TASK_NAME]: input.taskName,
      ...(input.projectId ? { [CORRELATION_KEYS.PROJECT_ID]: input.projectId } : {}),
      ...(input.projectName ? { [CORRELATION_KEYS.PROJECT_NAME]: input.projectName } : {}),
    });
    const ctx = trace.setSpan(parentCtx, span);
    this.taskCounter.add(1, { "loop_task.task.name": input.taskName });
    return new OtelSpan(span, ctx, (durationMs, status) => {
      this.taskDurationHistogram.record(durationMs, { "loop_task.task.name": input.taskName, status });
      if (status === "error") this.failureCounter.add(1, { "loop_task.span": "task" });
    });
  }

  startCommand(input: CommandTelemetryInput, parent?: TelemetrySpan): TelemetrySpan {
    const parentCtx = parent instanceof OtelSpan ? parent["ctx"] : context.active();
    const span = this.tracer.startSpan(SPAN_NAMES.COMMAND_EXECUTE, { kind: SpanKind.CLIENT }, parentCtx);
    span.setAttributes({
      "process.executable.name": input.command,
      "loop_task.command.argument_count": input.argumentCount,
      [CORRELATION_KEYS.RUN_ID]: input.runId,
      [CORRELATION_KEYS.LOOP_ID]: input.loopId,
      ...(input.taskId ? { [CORRELATION_KEYS.TASK_ID]: input.taskId } : {}),
      ...(input.taskName ? { [CORRELATION_KEYS.TASK_NAME]: input.taskName } : {}),
      ...(input.cwd ? { "loop_task.command.cwd": input.cwd } : {}),
      ...(input.integrationId ? { [CORRELATION_KEYS.AGENT_INTEGRATION]: input.integrationId } : {}),
    });
    if (this.settings.telemetryCaptureContent && input.commandLine) {
      span.setAttribute("loop_task.command.full", input.commandLine);
    }
    const ctx = trace.setSpan(parentCtx, span);
    this.commandCounter.add(1, { "process.executable.name": input.command });
    return new OtelSpan(span, ctx, (durationMs, status) => {
      this.commandDurationHistogram.record(durationMs, { "process.executable.name": input.command, status });
      if (status === "error") this.failureCounter.add(1, { "loop_task.span": "command" });
    });
  }

  recordRetry(input: RetryTelemetryInput): void {
    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      activeSpan.addEvent("retry", {
        "loop_task.retry.attempt": input.attempt,
        "loop_task.retry.max_attempts": input.maxAttempts,
        [CORRELATION_KEYS.RUN_ID]: input.runId,
        [CORRELATION_KEYS.LOOP_ID]: input.loopId,
        ...(input.taskId ? { [CORRELATION_KEYS.TASK_ID]: input.taskId } : {}),
      });
    }
    this.taskRetriesCounter.add(1, {
      ...(input.taskId ? { "loop_task.task.id": input.taskId } : {}),
    });
  }

  recordFailure(error: unknown, attributes?: Record<string, unknown>): void {
    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      if (error instanceof Error) {
        activeSpan.recordException(error);
      }
      activeSpan.setStatus({ code: SpanStatusCode.ERROR, message: error instanceof Error ? error.message : String(error) });
      if (attributes) {
        for (const [k, v] of Object.entries(attributes)) {
          activeSpan.setAttribute(k, v as string | number | boolean);
        }
      }
    }
  }

  recordAgentUsage(input: AgentUsage, parent?: TelemetrySpan): void {
    const activeSpan = parent instanceof OtelSpan ? parent["span"] : trace.getActiveSpan();
    if (!activeSpan) return;

    if (input.inputTokens !== undefined) {
      activeSpan.setAttribute("gen_ai.usage.input_tokens", input.inputTokens);
      this.agentInputTokensCounter.add(input.inputTokens, {
        ...(input.integration ? { "loop_task.agent.integration": input.integration } : {}),
        ...(input.model ? { "gen_ai.request.model": input.model } : {}),
      });
    }
    if (input.outputTokens !== undefined) {
      activeSpan.setAttribute("gen_ai.usage.output_tokens", input.outputTokens);
      this.agentOutputTokensCounter.add(input.outputTokens, {
        ...(input.integration ? { "loop_task.agent.integration": input.integration } : {}),
        ...(input.model ? { "gen_ai.request.model": input.model } : {}),
      });
    }
    if (input.cacheReadTokens !== undefined) {
      activeSpan.setAttribute("loop_task.agent.cache_read_tokens", input.cacheReadTokens);
      this.agentCacheReadTokensCounter.add(input.cacheReadTokens);
    }
    if (input.cacheWriteTokens !== undefined) {
      activeSpan.setAttribute("loop_task.agent.cache_write_tokens", input.cacheWriteTokens);
      this.agentCacheWriteTokensCounter.add(input.cacheWriteTokens);
    }
    if (input.costUsd !== undefined) {
      activeSpan.setAttribute("loop_task.agent.cost_usd", input.costUsd);
      this.agentCostCounter.add(input.costUsd);
    }
    if (input.provider) {
      activeSpan.setAttribute("gen_ai.provider.name", input.provider);
    }
    if (input.model) {
      activeSpan.setAttribute("gen_ai.request.model", input.model);
    }
  }

  logEvent(
    level: "trace" | "debug" | "info" | "warn" | "error" | "fatal",
    message: string,
    attributes?: Record<string, string | number | boolean>,
  ): void {
    try {
      const record = this.logger.emit({
        body: message,
        severityText: level,
        attributes: attributes ?? {},
      });
      // Ensure the log record is flushed in a timely manner
      void record;
    } catch (err) {
      daemonLog(`telemetry: log emit failed: ${String(err)}`);
    }
  }

  prepareChildProcess(
    invocation: CommandInvocation,
    childContext: ChildTelemetryContext,
    integrationOverride?: "auto" | "opencode" | "claude-code" | "generic" | "none",
  ): PreparedChildProcessTelemetry {
    const env: Record<string, string> = {};
    const endpoint = this.resolveEndpoint();
    const protocol = this.resolveProtocol();

    if (!this.settings.telemetryEnabled || !endpoint) {
      return { env };
    }

    if (childContext.traceParent) {
      env.TRACEPARENT = childContext.traceParent;
      if (childContext.traceState) {
        env.TRACESTATE = childContext.traceState;
      }
    }

    // Check if an agent serve sidecar is alive — if so, static OTEL config
    // lives in the serve process env and we skip per-task injection.
    const serveAlive = this.checkServeAlive();

    if (!serveAlive) {
      env.OTEL_EXPORTER_OTLP_ENDPOINT = endpoint;
      env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT = endpoint;
      env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT = endpoint;
      env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT = endpoint;
      env.OTEL_EXPORTER_OTLP_PROTOCOL = protocol;
      env.OTEL_TRACES_EXPORTER = "otlp";
      env.OTEL_METRICS_EXPORTER = "otlp";
      env.OTEL_LOGS_EXPORTER = "otlp";

      const authHeaders = process.env.OTEL_EXPORTER_OTLP_HEADERS
        ?? process.env.OTEL_EXPORTER_OTLP_TRACES_HEADERS;
      if (authHeaders) {
        env.OTEL_EXPORTER_OTLP_HEADERS = authHeaders;
      }

      const correlationAttrs: Record<string, string> = {
        [CORRELATION_KEYS.RUN_ID]: childContext.runId,
        [CORRELATION_KEYS.LOOP_ID]: childContext.loopId,
      };
      if (childContext.taskId) correlationAttrs[CORRELATION_KEYS.TASK_ID] = childContext.taskId;
      if (childContext.projectId) correlationAttrs[CORRELATION_KEYS.PROJECT_ID] = childContext.projectId;
      const mergedResourceAttrs = this.mergeResourceAttributes(
        process.env.OTEL_RESOURCE_ATTRIBUTES,
        correlationAttrs,
      );
      env.OTEL_RESOURCE_ATTRIBUTES = mergedResourceAttrs;
    }

    // Apply agent-specific integrations when auto-instrumentation is enabled
    let integrationId: string | undefined;
    if (this.settings.telemetryAutoInstrumentAgents || integrationOverride) {
      // Per-task override takes precedence
      if (integrationOverride === "none") {
        // Explicitly disable agent integration — no agent-specific env
        integrationId = undefined;
      } else if (integrationOverride && integrationOverride !== "auto") {
        // Force a specific integration: opencode, claude-code, or generic
        if (integrationOverride === "generic") {
          // Generic: no agent-specific activation, just the base OTLP env
          integrationId = undefined;
        } else {
          const allIntegrations = [
            ...getAgentIntegrations(),
          ];
          const target = allIntegrations.find((i) => i.id === integrationOverride);
          if (target) {
            integrationId = target.id;
            const prepared = target.prepare(
              { ...invocation, env: { ...invocation.env, ...env } },
              childContext,
            );
            Object.assign(env, prepared.env);
          }
        }
      } else {
        // Auto-detect
        const integration = detectAgentIntegration(invocation.command, invocation.args);
        if (integration) {
          integrationId = integration.id;
          const prepared = integration.prepare(
            { ...invocation, env: { ...invocation.env, ...env } },
            childContext,
          );
          Object.assign(env, prepared.env);
        }
      }
    }

    return { env, integrationId };
  }

  private mergeResourceAttributes(
    existing?: string,
    additions: Record<string, string> = {},
  ): string {
    const map = new Map<string, string>();
    if (existing) {
      for (const pair of existing.split(",")) {
        const [k, v] = pair.split("=", 2);
        if (k && v) map.set(k.trim(), v.trim());
      }
    }
    for (const [k, v] of Object.entries(additions)) {
      map.set(k, v);
    }
    return [...map.entries()].map(([k, v]) => `${k}=${v}`).join(",");
  }

  getStatus(): TelemetryStatus {
    return { ...this.status, lastSuccessfulExportAt: this.lastSuccessfulExport, lastExportError: this.lastExportError };
  }

  async flush(): Promise<void> {
    if (!this.sdk) return;
    try {
      const flushes: Promise<void>[] = [];

      if (this.tracerProvider) {
        flushes.push(this.tracerProvider.forceFlush());
      }

      if (this.loggerProvider) {
        flushes.push(this.loggerProvider.forceFlush());
      }

      const sdkInternals = this.sdk as unknown as {
        _tracerProvider?: { forceFlush?: () => Promise<void> };
        _meterProvider?: { forceFlush?: () => Promise<void> };
      };
      if (typeof sdkInternals._meterProvider?.forceFlush === "function") {
        flushes.push(sdkInternals._meterProvider.forceFlush());
      }

      if (flushes.length === 0) {
        throw new Error("OpenTelemetry SDK providers do not support forceFlush");
      }

      await Promise.all(flushes);
      daemonLog("telemetry: SDK flushed");
      this.lastSuccessfulExport = new Date().toISOString();
      if (this.status.exporterState !== "healthy") {
        this.status.exporterState = "healthy";
      }
    } catch (err) {
      daemonLog(`telemetry: flush failed: ${String(err)}`);
      this.lastExportError = err instanceof Error ? err.message : String(err);
      throw err;
    }
  }

  async shutdown(): Promise<void> {
    if (this.tracerProvider) {
      try {
        await this.tracerProvider.forceFlush();
        await this.tracerProvider.shutdown();
      } catch {
        // best effort
      }
      this.tracerProvider = null;
    }
    if (this.loggerProvider) {
      try {
        await this.loggerProvider.forceFlush();
        await this.loggerProvider.shutdown();
      } catch {
        // best effort
      }
      this.loggerProvider = null;
    }
    if (!this.sdk) return;
    try {
      await this.sdk.shutdown();
      daemonLog("telemetry: SDK shut down");
    } catch (err) {
      daemonLog(`telemetry: shutdown error: ${String(err)}`);
    }
    this.sdk = null;
  }
}
