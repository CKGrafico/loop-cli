import { LoopManager } from "./managers/loop-manager.js";
import { TaskManager } from "./managers/task-manager.js";
import { ProjectManager } from "./managers/project-manager.js";
import { IpcServer } from "./server/index.js";
import { HttpApiServer } from "./http/server.js";
import { McpApiServer } from "./mcp/index.js";
import { FileWatcher } from "./watcher/index.js";
import { SettingsManager } from "./settings-manager.js";
import {
  writeDaemonPid,
  removeDaemonPid,
  writeDaemonSignature,
  removeDaemonSignature,
  computeCodeSignature,
  migrateTasksToJson,
  migrateLoopsToJson,
  setSelfWriteNotifier,
  readDaemonPid,
  isDaemonAlive,
} from "./state/index.js";
import { setProjectSelfWriteNotifier } from "./managers/project-manager.js";
import { t } from "../shared/i18n/index.js";
import { daemonLog } from "./daemon-log.js";
import { killAllActiveProcesses, getActivePids } from "../core/command/command-runner.js";
import { setActivePidsGetter } from "./diagnostics.js";
import { RecipeScanner } from "./recipe/scanner.js";
import { RecipeTaskStore } from "./recipe/task-store.js";
import { DeferredReloadManager } from "./recipe/deferred-reload.js";
import { setRecipeSelfWriteNotifier } from "./recipe/file-writer.js";
import { TelemetryManager } from "./telemetry/index.js";
import { AgentServeManager } from "./telemetry/agent-serve-manager.js";
import path from "node:path";

function cleanupStaleProcesses(): void {
  const oldPid = readDaemonPid();
  if (oldPid !== null && !isDaemonAlive(oldPid)) {
    daemonLog(`previous daemon pid=${oldPid} is not running; child processes may be orphaned`);
  }
}

async function main(): Promise<void> {
  const mcpEnabled = (process.env.LOOP_CLI_MCP_ENABLED ?? "true") !== "false";
  const mcpTransport = process.env.LOOP_CLI_MCP_TRANSPORT === "stdio" ? "stdio" : "sse";

  const taskManager = new TaskManager();
  setActivePidsGetter(getActivePids);
  migrateLoopsToJson();
  migrateTasksToJson();
  taskManager.init();
  const manager = new LoopManager(taskManager);
  const settingsManager = new SettingsManager();
  settingsManager.load();
  const telemetryManager = new TelemetryManager(settingsManager.get());
  manager.setTelemetryManager(telemetryManager);
  const agentServeManager = new AgentServeManager(settingsManager.get(), telemetryManager);
  const server = new IpcServer(manager, taskManager, settingsManager, telemetryManager);
  const projectManager = (manager as unknown as { projectManager: ProjectManager }).projectManager;
  const httpServer = new HttpApiServer(manager, taskManager, projectManager, settingsManager);
  const mcpServer = new McpApiServer(manager, taskManager, projectManager, mcpTransport);

  try {
    await server.listen();
  } catch (err) {
    daemonLog(`listen failed (another daemon already holds the socket): ${String(err)}`);
    process.exit(0);
  }

  const httpPort = parseInt(process.env.LOOP_CLI_HTTP_PORT ?? "", 10);
  const resolvedHttpPort = Number.isNaN(httpPort) ? undefined : httpPort;
  let currentHttpHost = settingsManager.get().httpApiHost;

  if (settingsManager.get().httpApiEnabled) {
    try {
      await httpServer.listen(resolvedHttpPort, currentHttpHost);
    } catch (err) {
      daemonLog(`HTTP API server failed to start: ${String(err)}`);
    }
  }

  mcpServer.setHost(currentHttpHost);
  if (mcpEnabled) {
    try {
      await mcpServer.start();
    } catch (err) {
      daemonLog(`MCP server failed to start: ${String(err)}`);
    }
  }

  settingsManager.onChange((settings) => {
    const newHost = settings.httpApiHost;
    const hostChanged = newHost !== currentHttpHost;

    // HTTP API (8845)
    if (settings.httpApiEnabled && !httpServer["isListening"]) {
      httpServer.listen(resolvedHttpPort, newHost).catch((err) => {
        daemonLog(`HTTP API server failed to restart: ${String(err)}`);
      });
    } else if (settings.httpApiEnabled && httpServer["isListening"] && hostChanged) {
      httpServer.restart(resolvedHttpPort, newHost).catch((err) => {
        daemonLog(`HTTP API server failed to rebind to ${newHost}: ${String(err)}`);
      });
    } else if (!settings.httpApiEnabled && httpServer["isListening"]) {
      httpServer.close().catch((err) => {
        daemonLog(`HTTP API server failed to stop: ${String(err)}`);
      });
    }

    // MCP SSE (8846) — shares the same bind host as the HTTP API.
    mcpServer.setHost(newHost);
    if (settings.mcpApiEnabled && !mcpServer.isListening) {
      mcpServer.start().catch((err) => {
        daemonLog(`MCP server failed to restart: ${String(err)}`);
      });
    } else if (settings.mcpApiEnabled && mcpServer.isListening && hostChanged) {
      mcpServer
        .close()
        .then(() => mcpServer.start())
        .catch((err) => {
          daemonLog(`MCP server failed to rebind to ${newHost}: ${String(err)}`);
        });
    } else if (!settings.mcpApiEnabled && mcpServer.isListening) {
      mcpServer.close().catch((err) => {
        daemonLog(`MCP server failed to stop: ${String(err)}`);
      });
    }

    // Telemetry runtime reconfiguration
    telemetryManager.onSettingsChanged(settings);

    currentHttpHost = newHost;
  });

  manager.init();

  // Recipe loop infrastructure
  const recipeTaskStore = new RecipeTaskStore();
  taskManager.setRecipeTaskStore(recipeTaskStore);
  const recipeScanner = new RecipeScanner(recipeTaskStore);
  const deferredReload = new DeferredReloadManager(recipeScanner);
  recipeScanner.setManagers(manager, manager["projectManager"]);
  manager.setRecipeScanner(recipeScanner);

  // Set up project directory change callback for recipe reloading
  manager["projectManager"].setOnDirectoryChange((projectId: string, _oldDirectory: string, newDirectory: string) => {
    recipeScanner.unloadRecipesForProject(projectId);
    if (newDirectory) {
      recipeScanner.scanDirectory(projectId, newDirectory);
      fileWatcher.watchRecipeDirectory(projectId, path.join(newDirectory, ".loops/recipes"));
    }
  });

  cleanupStaleProcesses();
  writeDaemonPid(process.pid);
  writeDaemonSignature(computeCodeSignature());
  daemonLog(`started pid=${process.pid}`);

  const fileWatcher = new FileWatcher();
  fileWatcher.setManagers(manager, taskManager, manager["projectManager"]);
  fileWatcher.start();
  daemonLog(`file watcher started for hot-reloading JSON configs`);

  setSelfWriteNotifier((filePath, content) => fileWatcher.registerSelfWrite(filePath, content));
  setProjectSelfWriteNotifier((filePath, content) => fileWatcher.registerSelfWrite(filePath, content));
  setRecipeSelfWriteNotifier((filePath, content) => fileWatcher.registerSelfWrite(filePath, content));

  // Scan all project directories for recipe files
  recipeScanner.scanAllProjects();
  fileWatcher.setRecipeScanner(recipeScanner, deferredReload);

  // Watch recipe directories for each project
  for (const project of manager.listProjects()) {
    if (project.directory) {
      const recipesDir = path.join(project.directory, ".loops/recipes");
      fileWatcher.watchRecipeDirectory(project.id, recipesDir);
    }
  }

  // Reconcile after watchers are attached so files created during startup cannot be missed.
  recipeScanner.scanAllProjects();

  daemonLog(`recipe scanner initialized`);

  // Start agent serve sidecars (e.g., opencode serve) after core services are up
  if (settingsManager.get().telemetryEnabled) {
    agentServeManager.ensureAllServe(process.cwd()).catch((err) => {
      daemonLog(`agent serve startup failed: ${String(err)}`);
    });
  }

  let shuttingDown = false;
  const cleanup = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    daemonLog(`shutting down pid=${process.pid}`);
    try {
      killAllActiveProcesses();
      await agentServeManager.shutdownAll();
      await telemetryManager.shutdown();
      fileWatcher.stop();
      removeDaemonPid();
      removeDaemonSignature();
      await manager.shutdown();
      await server.close();
      await httpServer.close();
      await mcpServer.close();
    } catch (err) {
      daemonLog(`error during shutdown: ${String(err)}`);
    } finally {
      process.exit(0);
    }
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
  process.on("uncaughtException", (err) => {
    daemonLog(`uncaught exception: ${String(err)}`);
    console.error(t("errors.daemonUncaught"), err);
    void cleanup();
  });
}

main().catch((err) => {
  daemonLog(`failed to start: ${String(err)}`);
  console.error(t("errors.daemonFailed"), err);
  process.exit(1);
});
