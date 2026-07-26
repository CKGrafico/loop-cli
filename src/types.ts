export interface Project {
  id: string;
  name: string;
  color: string;
  directory?: string;
  githubSource?: string;
  createdAt: string;
  isSystem: boolean;
  isDefault: boolean;
}

export interface TaskCommand {
  command: string;
  commandArgs: string[];
  commandRaw?: string;
}

export interface TaskStep {
  commands: TaskCommand[];
}

export const DEFAULT_TASK_MAX_RUNS = 5;

export interface TaskDefinition {
  id: string;
  name: string;
  command: string;
  commandArgs: string[];
  commandRaw?: string;
  steps?: TaskStep[];
  onSuccessTaskId: string | null;
  onFailureTaskId: string | null;
  silentChain?: boolean;
  maxRuns: number;
  context?: Record<string, unknown>;
  createdAt: string;
  telemetry?: TaskTelemetryConfig;
  isRecipeTask?: boolean;
  projectId?: string;
}

export interface TaskTelemetryConfig {
  enabled?: boolean;
  integration?: "auto" | "opencode" | "claude-code" | "generic" | "none";
}

export interface LoopOptions {
  interval: number;
  taskId: string | null;
  command: string;
  commandArgs: string[];
  commandRaw?: string;
  cwd: string;
  immediate: boolean;
  maxRuns: number | null;
  verbose: boolean;
  description: string;
  projectId: string;
  offset: number | null;
  context?: Record<string, unknown>;
}

export interface ExecutionResult {
  exitCode: number;
  duration: number;
  startedAt: Date;
  endedAt: Date;
  stdout?: string;
}

export interface LoopState {
  running: boolean;
  runCount: number;
  shuttingDown: boolean;
}

export type LoopStatus = "running" | "paused" | "idle" | "waiting" | "stopped";

export type RunStatus = "running" | "completed";

export interface RunRecord {
  runNumber: number;
  startedAt: string;
  exitCode: number;
  duration: number;
  logSize: number;
  status: RunStatus;
  logOffset: number;
  chainGroupId?: string;
  chainName?: string;
}

export interface LoopMeta {
  id: string;
  taskId: string | null;
  command: string;
  commandArgs: string[];
  commandRaw?: string;
  interval: number;
  intervalHuman: string;
  immediate: boolean;
  maxRuns: number | null;
  verbose: boolean;
  cwd: string;
  description: string;
  status: LoopStatus;
  createdAt: string;
  sessionStartedAt: string | null;
  runCount: number;
  lastRunAt: string | null;
  lastExitCode: number | null;
  lastDuration: number | null;
  nextRunAt: string | null;
  remainingDelayMs: number | null;
  pid: number;
  maxRunsReached: boolean;
  runHistory: RunRecord[];
  skippedCount: number;
  silentChainCount?: number;
  projectId: string;
  offset: number | null;
  context?: Record<string, unknown>;
  totalRunCount?: number;
  isRecipe?: boolean;
  recipeFile?: string;
  recipeFilePath?: string;
}

export interface TelemetrySettings {
  enabled: boolean;
  endpoint?: string;
  protocol: "grpc" | "http/protobuf";
  autoInstrumentAgents: boolean;
  captureContent: boolean;
  captureCommandOutput: boolean;
  serviceName: string;
}

export interface DaemonSettings {
  httpApiEnabled: boolean;
  mcpApiEnabled: boolean;
  /**
   * Network interface the HTTP API binds to. Defaults to "0.0.0.0" (all
   * interfaces) so the daemon is reachable remotely (SSH/Tailscale/LAN).
   * The API is unauthenticated, securing access is the operator's job at
   * the network layer. Set to "127.0.0.1" (or `loop-task http-host local`)
   * for loopback-only, or a specific IP to bind a single interface.
   */
  httpApiHost: string;
  telemetryEnabled: boolean;
  telemetryEndpoint?: string;
  telemetryProtocol: "grpc" | "http/protobuf";
  telemetryAutoInstrumentAgents: boolean;
  telemetryCaptureContent: boolean;
  telemetryCaptureCommandOutput: boolean;
  telemetryServiceName: string;
}

export type IpcRequest =
  | { type: "start"; payload: LoopOptions & { intervalHuman: string } }
  | { type: "update"; payload: { id: string } & LoopOptions & { intervalHuman: string } }
  | { type: "list" }
  | { type: "status"; payload: { id: string } }
  | { type: "pause"; payload: { id: string } }
  | { type: "resume"; payload: { id: string } }
  | { type: "stop-loop"; payload: { id: string } }
  | { type: "stop-all" }
  | { type: "play-loop"; payload: { id: string } }
  | { type: "trigger"; payload: { id: string } }
  | { type: "delete"; payload: { id: string } }
  | { type: "attach"; payload: { id: string } }
  | { type: "logs"; payload: { id: string; follow: boolean; tail?: number } }
  | { type: "run-log"; payload: { id: string; runNumber: number } }
  | { type: "run-log-stream"; payload: { id: string; runNumber: number } }
  | { type: "task-create"; payload: Omit<TaskDefinition, "createdAt"> }
  | { type: "task-update"; payload: { id: string } & Omit<TaskDefinition, "id" | "createdAt"> }
  | { type: "task-list" }
  | { type: "task-get"; payload: { id: string } }
  | { type: "task-delete"; payload: { id: string } }
  | { type: "project-list" }
  | { type: "project-create"; payload: { name: string; color: string; directory?: string; githubSource?: string } }
  | { type: "project-update"; payload: { id: string; name: string; color?: string; directory?: string; githubSource?: string } }
  | { type: "project-delete"; payload: { id: string } }
  | { type: "settings-get" }
  | { type: "settings-set"; settings: Partial<DaemonSettings> }
  | { type: "telemetry-test" }
  | { type: "diagnostics" }
  | { type: "subscribe" }
  | { type: "shutdown" };

export type IpcResponse =
  | { type: "ok"; data?: unknown }
  | { type: "error"; message: string }
  | { type: "data"; line: string }
  | { type: "end" }
  | { type: "event"; event: string; data?: unknown };
