#!/usr/bin/env node

import { Command } from "commander";
import { createRequire } from "node:module";
import { Logger } from "./logger.js";
import { runLoop } from "./core/foreground/index.js";
import { buildLoopOptions } from "./loop-config.js";
import { parseDuration } from "./duration.js";
import { startLoop } from "./client/commands.js";
import {
  listProjectsCli,
  createProjectCli,
  renameProjectCli,
  setProjectColorCli,
  deleteProjectCli,
  resolveProjectId,
} from "./client/project-commands.js";
import { t } from "./shared/i18n/index.js";
import { HTTP_API_PORT, HTTP_API_HOST } from "./shared/config/constants.js";
import type { DaemonSettings } from "./types.js";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version: string };

const program = new Command();

program
  .name("loop-task")
  .description(t("cli.programDescription"))
  .version(packageJson.version, "-V, --version");

program
  .command("start")
  .description(t("cli.startDescription"))
  .action(async () => {
    const { ensureDaemon } = await import("./daemon/spawner/index.js");
    ensureDaemon();
    console.log(t("cli.daemonStarted"));
  });

program
  .command("stop")
  .description("Stop a running loop and interrupt its current execution")
  .argument("<id>", "Loop ID")
  .action(async (id: string) => {
    try {
      const { sendRequest } = await import("./client/ipc.js");
      const res = await sendRequest({ type: "stop-loop", payload: { id } });
      if (res.type === "ok" && res.data) {
        console.log(`Stopped loop ${id}`);
      } else if (res.type === "error") {
        console.error(res.message);
        process.exit(1);
      } else {
        console.error(`Loop ${id} not found`);
        process.exit(1);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(t("cli.error", { message }));
      process.exit(1);
    }
  });

program
  .command("restart")
  .description("Kill the daemon and all running loops, then restart fresh")
  .action(async () => {
    const { stopDaemon, ensureDaemon } = await import("./daemon/spawner/index.js");
    const { readDaemonPid, removeDaemonPid, removeDaemonSignature } = await import("./daemon/state/index.js");
    const pid = readDaemonPid();
    if (pid !== null) {
      console.log("Stopping daemon...");
      stopDaemon(pid);
      removeDaemonPid();
      removeDaemonSignature();
    } else {
      stopDaemon(0);
    }
    console.log("Starting fresh daemon...");
    ensureDaemon();
    console.log("Daemon restarted.");
  });

program
  .command("new")
  .description(t("cli.newDescription"))
  .argument("<interval>", t("cli.argInterval"))
  .argument("<command...>", t("cli.argCommand"))
  .option("--now", t("cli.optNow"), false)
  .option("--max-runs <n>", t("cli.optMaxRuns"), parseInt)
  .option("--verbose", t("cli.optVerbose"), false)
  .option("--cwd <dir>", t("cli.optCwd"))
  .option("--project <name>", t("cli.optProject"))
  .option("--offset <duration>", "Phase offset (e.g. 5m, 15m)")
  .option("--description <desc>", "Description of the loop")
  .option("-C, --context <json>", "Initial context JSON (e.g. {\"env\":\"staging\"})")
  .action(
    async (
      intervalStr: string,
      cmdArgs: string[],
      opts: { now: boolean; maxRuns?: number; verbose: boolean; cwd?: string; project?: string; offset?: string; description?: string; context?: string }
    ) => {
      try {
        const projectId = opts.project
          ? await resolveProjectId(opts.project)
          : undefined;
        const offsetMs = opts.offset ? parseDuration(opts.offset) : null;
        let context: Record<string, unknown> | undefined;
        if (opts.context) {
          const { validateContext } = await import("./core/context/validate-context.js");
          let parsed: unknown;
          try {
            parsed = JSON.parse(opts.context);
          } catch {
            console.error("Invalid JSON in --context flag");
            process.exit(1);
          }
          const result = validateContext(parsed);
          if (!result.valid) {
            console.error(`Invalid context: ${result.error}`);
            process.exit(1);
          }
          context = result.context;
        }
        const built = buildLoopOptions(intervalStr, {
          ...opts,
          command: cmdArgs[0],
          commandArgs: cmdArgs.slice(1),
          cwd: opts.cwd ?? process.cwd(),
          projectId,
          offset: offsetMs,
          description: opts.description ?? cmdArgs.join(" "),
          context,
        });
        await startLoop(built.options, built.intervalHuman);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(t("cli.error", { message }));
        process.exit(1);
      }
    }
  );

program
  .command("run")
  .description(t("cli.runDescription"))
  .argument("<interval>", t("cli.argInterval"))
  .argument("<command...>", t("cli.argCommand"))
  .option("--now", t("cli.optNow"))
  .option("--max-runs <n>", t("cli.optMaxRuns"))
  .option("--verbose", t("cli.optVerbose"))
  .option("--cwd <dir>", t("cli.optCwd"))
  .option("--description <desc>", "Description of the loop")
  .option("-C, --context <json>", "Initial context JSON (e.g. {\"env\":\"staging\"})")
  .action(
    async (
      intervalStr: string | undefined,
      cmdArgs: string[] | undefined,
      opts: { now?: boolean; maxRuns?: string; verbose?: boolean; cwd?: string; description?: string; context?: string }
    ) => {
      if (!intervalStr || !cmdArgs || cmdArgs.length === 0) {
        program.help();
        return;
      }

      const logger = new Logger(opts.verbose ?? false);
      let context: Record<string, unknown> | undefined;
      if (opts.context) {
        const { validateContext } = await import("./core/context/validate-context.js");
        let parsed: unknown;
        try {
          parsed = JSON.parse(opts.context);
        } catch {
          console.error("Invalid JSON in --context flag");
          process.exit(1);
        }
        const result = validateContext(parsed);
        if (!result.valid) {
          console.error(`Invalid context: ${result.error}`);
          process.exit(1);
        }
        context = result.context;
      }
      const built = buildLoopOptions(intervalStr, {
        ...opts,
        command: cmdArgs[0],
        commandArgs: cmdArgs.slice(1),
        cwd: opts.cwd ?? process.cwd(),
        description: opts.description ?? cmdArgs.join(" "),
        context,
      });

      if (built.options.interval === 0) {
        console.error("Manual loops are not supported in foreground mode. Use 'loop-task new manual -- <command>' instead.");
        process.exit(1);
      }

      const controller = new AbortController();
      process.on("SIGINT", () => controller.abort());
      process.on("SIGTERM", () => controller.abort());

      await runLoop(built.options, logger, controller.signal);
      process.exit(0);
    }
  );

const projectCmd = program.command("project").description(t("cli.projectDescription"));

projectCmd
  .command("list")
  .description(t("cli.projectListDescription"))
  .action(async () => {
    await listProjectsCli();
  });

projectCmd
  .command("new")
  .description(t("cli.projectNewDescription"))
  .argument("<name>", t("cli.projectArgName"))
  .option("--color <color>", t("cli.optProjectColor"))
  .option("--directory <path>", t("cli.optProjectDirectory"))
  .option("--github-source <owner/repo>", t("cli.optProjectGithubSource"))
  .action(async (name: string, opts: { color?: string; directory?: string; githubSource?: string }) => {
    await createProjectCli(name, opts.color, opts.directory, opts.githubSource);
  });

projectCmd
  .command("rename")
  .description(t("cli.projectRenameDescription"))
  .argument("<id-or-name>", t("cli.projectArgIdOrName"))
  .argument("<new-name>", t("cli.projectArgNewName"))
  .action(async (idOrName: string, newName: string) => {
    await renameProjectCli(idOrName, newName);
  });

projectCmd
  .command("color")
  .description(t("cli.projectColorDescription"))
  .argument("<id-or-name>", t("cli.projectArgIdOrName"))
  .argument("<color>", t("cli.projectArgColor"))
  .action(async (idOrName: string, color: string) => {
    await setProjectColorCli(idOrName, color);
  });

projectCmd
  .command("delete")
  .description(t("cli.projectDeleteDescription"))
  .argument("<id-or-name>", t("cli.projectArgIdOrName"))
  .action(async (idOrName: string) => {
    await deleteProjectCli(idOrName);
  });

program.action(async () => {
  const { launchBoard } = await import("./app/index.js");
  const port = process.env.LOOP_CLI_HTTP_PORT ?? String(HTTP_API_PORT);
  const baseUrl = `http://${HTTP_API_HOST}:${port}`;
  console.log(`HTTP API Server`);
  console.log(`  Base URL:   ${baseUrl}`);
  console.log(`  Swagger UI: ${baseUrl}/api/docs`);
  console.log(`  OpenAPI:    ${baseUrl}/api/openapi.json`);
  console.log(`  Events:     ${baseUrl}/api/events (SSE)`);
  await launchBoard();
});

program
  .command("status")
  .description("Show status of all loops")
  .option("--json", "Output as JSON")
  .option("--verbose", "Show extra details (skipped, silent-chain counts)")
  .action(async (opts) => {
    const { sendRequest } = await import("./client/ipc.js");
    const response = await sendRequest({ type: "list" });
    if (response.type !== "ok") {
      console.error("Failed to get status");
      process.exit(1);
    }
    const loops = response.data as import("./types.js").LoopMeta[];
    if (opts.json) {
      console.log(JSON.stringify(loops, null, 2));
    } else {
      for (const loop of loops) {
        const { describeLoop, statusLabel } = await import("./shared/ui/format.js");
        let line = `${loop.id}  ${statusLabel(loop.status)}  ${describeLoop(loop)}`;
        if (opts.verbose) {
          const extra: string[] = [];
          if (loop.skippedCount > 0) extra.push(`skipped=${loop.skippedCount}`);
          if ((loop.silentChainCount ?? 0) > 0) extra.push(`silent=${loop.silentChainCount}`);
          if (extra.length) line += `  [${extra.join(", ")}]`;
        }
        console.log(line);
      }
    }
  });

program
  .command("export")
  .description("Export all configs to a JSON file (or stdout)")
  .argument("[file]", "Output file (defaults to stdout)")
  .action(async (file) => {
    const { sendRequest } = await import("./client/ipc.js");
    const [loopsRes, tasksRes, projectsRes] = await Promise.all([
      sendRequest({ type: "list" }),
      sendRequest({ type: "task-list" }),
      sendRequest({ type: "project-list" }),
    ]);
    const loops = loopsRes.type === "ok" ? (loopsRes.data as import("./types.js").LoopMeta[]) : [];
    const exportData = {
      version: 2,
      exportedAt: new Date().toISOString(),
      loops: loops.map(({ runHistory: _ignored, ...rest }) => rest),
      tasks: tasksRes.type === "ok" ? tasksRes.data : [],
      projects: projectsRes.type === "ok" ? projectsRes.data : [],
    };
    const json = JSON.stringify(exportData, null, 2);
    if (file) {
      const { writeFile } = await import("node:fs/promises");
      await writeFile(file, json, "utf-8");
      console.log(`Exported to ${file}`);
    } else {
      console.log(json);
    }
  });

program
  .command("import")
  .description("Restore a previously exported state file (inverse of loop-task export)")
  .argument("<file>", "Input file")
  .action(async (file) => {
    const { readFile } = await import("node:fs/promises");
    let content: string;
    try {
      content = await readFile(file, "utf-8");
    } catch (err: unknown) {
      const e = err as Error;
      console.error(`Failed to read file: ${e.message}`);
      process.exit(1);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error("Invalid JSON in import file");
      process.exit(1);
    }
    const { validateExportFile } = await import("./cli/import-validator.js");
    const result = validateExportFile(parsed);
    if (!result.valid) {
      for (const error of result.errors) {
        console.error(error.message);
      }
      process.exit(1);
    }
    const { atomicImportWrite } = await import("./cli/import-writer.js");
    const writeResult = atomicImportWrite(result.data!.loops, result.data!.tasks, result.data!.projects);
    if (!writeResult.success) {
      console.error(`Failed to write store: ${writeResult.error}`);
      if (writeResult.writtenStores.length > 0) {
        console.error("Rolled back previously written stores.");
      }
      process.exit(1);
    }
    console.log(`Imported ${result.data!.loops.length} loops, ${result.data!.tasks.length} tasks, ${result.data!.projects.length} projects`);
    console.log("Daemon will hot-reload automatically.");
  });

program
  .command("diagram")
  .description("View the loop diagram from the recipe YAML file")
  .argument("<id>", "Loop ID")
  .action(async (id: string) => {
    try {
      const { sendRequest } = await import("./client/ipc.js");
      const loopRes = await sendRequest({ type: "status", payload: { id } });
      if (loopRes.type === "error") {
        console.error(loopRes.message);
        process.exit(1);
      }
      if (loopRes.type !== "ok" || !loopRes.data) {
        console.error(`Loop ${id} not found`);
        process.exit(1);
      }
      const loop = loopRes.data as import("./types.js").LoopMeta;
      if (!loop.taskId) {
        console.log(`Loop ${id} has no task chain`);
        process.exit(0);
      }

      // Recipe loops: read diagram from YAML
      if (loop.isRecipe && loop.recipeFilePath) {
        const { readRecipeDiagram } = await import("./daemon/recipe/diagram-reader.js");
        const { renderMermaidAsAscii } = await import("./features/chain-editor/mermaidToAscii.js");
        const diagram = readRecipeDiagram(loop.recipeFilePath);
        if (diagram) {
          console.log(renderMermaidAsAscii(diagram));
        } else {
          console.error(t("diagram.noDiagramInRecipe"));
          process.exit(1);
        }
      } else {
        console.error(t("diagram.notARecipe"));
        process.exit(1);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(t("cli.error", { message }));
      process.exit(1);
    }
  });



program
  .command("http-host")
  .description("Show or set the network interface the HTTP API + MCP server bind to (default 0.0.0.0)")
  .argument("[address]", "IP to bind — or 'local' (127.0.0.1) / 'all' (0.0.0.0)")
  .action(async (address?: string) => {
    const { ensureDaemon } = await import("./daemon/spawner/index.js");
    const { sendRequest } = await import("./client/ipc.js");
    const port = process.env.LOOP_CLI_HTTP_PORT ?? String(HTTP_API_PORT);

    try {
      ensureDaemon();

      if (!address) {
        const res = await sendRequest({ type: "settings-get" });
        const host = res.type === "ok" ? (res.data as DaemonSettings).httpApiHost : HTTP_API_HOST;
        const shown = host === "0.0.0.0" ? "<this-machine-ip>" : host;
        const mcpPort = process.env.LOOP_CLI_MCP_PORT ?? "8846";
        console.log(`API bind host: ${host}`);
        console.log(`  HTTP API: http://${shown}:${port}`);
        console.log(`  MCP SSE:  http://${shown}:${mcpPort}/sse`);
        return;
      }

      const normalized =
        address === "local" || address === "localhost"
          ? "127.0.0.1"
          : address === "all" || address === "any"
            ? "0.0.0.0"
            : address;

      const res = await sendRequest({ type: "settings-set", settings: { httpApiHost: normalized } });
      if (res.type !== "ok") {
        console.error(res.type === "error" ? res.message : "Failed to update setting");
        process.exit(1);
      }

      console.log(`HTTP API + MCP server now binding to ${normalized}`);
      if (normalized !== "127.0.0.1") {
        console.log("");
        console.log("Note: the API is unauthenticated — anything that can reach this");
        console.log("interface can create and trigger loops. Secure access at the network");
        console.log("layer (SSH/Tailscale/firewall). Use `loop-task http-host local` for");
        console.log("loopback-only.");
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(t("cli.error", { message }));
      process.exit(1);
    }
  });

program
  .command("mcp")
  .description("Show MCP server info and how to connect an MCP client")
  .action(() => {
    const transport = process.env.LOOP_CLI_MCP_TRANSPORT === "stdio" ? "stdio" : "sse";
    const port = process.env.LOOP_CLI_MCP_PORT ?? "8846";
    const sseUrl = `http://${HTTP_API_HOST}:${port}/sse`;
    console.log(`MCP Server`);
    console.log(`  Transport:  ${transport}`);
    console.log(`  SSE URL:    ${sseUrl}`);
    console.log("");
    console.log(`  Connect an MCP client to the SSE URL above.`);
    console.log("");
    if (transport === "stdio") {
      console.log(`  Currently using stdio transport. To switch to SSE (default),`);
      console.log(`  restart without LOOP_CLI_MCP_TRANSPORT=stdio.`);
      console.log("");
    }
    console.log(`  Example MCP client configs:`);
    console.log("");
    console.log(`  OpenCode (opencode.json):`);
    console.log(`    { "mcp": { "loop-task": { "type": "remote", "url": "${sseUrl}" } } }`);
    console.log("");
    console.log(`  Claude Code (.claude/mcp.json):`);
    console.log(`    { "mcpServers": { "loop-task": { "type": "sse", "url": "${sseUrl}" } } }`);
    console.log("");
    console.log(`  Cursor (.cursor/mcp.json):`);
    console.log(`    { "mcpServers": { "loop-task": { "type": "sse", "url": "${sseUrl}" } } }`);
  });

const telemetryCmd = program.command("telemetry").description("Manage OpenTelemetry configuration");

telemetryCmd
  .command("status")
  .description("Show OpenTelemetry status and configuration")
  .action(async () => {
    const { sendRequest } = await import("./client/ipc.js");
    const res = await sendRequest({ type: "settings-get" });
    if (res.type !== "ok") {
      console.error("Failed to get settings");
      process.exit(1);
    }
    const s = res.data as import("./types.js").DaemonSettings;
    const endpoint = s.telemetryEndpoint ?? "not configured";
    const hasHeaders = !!(process.env.OTEL_EXPORTER_OTLP_HEADERS || process.env.OTEL_EXPORTER_OTLP_TRACES_HEADERS);
    console.log("OpenTelemetry");
    console.log(`  Enabled:                ${s.telemetryEnabled ? "yes" : "no"}`);
    console.log(`  Endpoint:               ${endpoint}`);
    console.log(`  Protocol:               ${s.telemetryProtocol}`);
    console.log(`  Service:                ${s.telemetryServiceName}`);
    console.log(`  Auto-instrument agents: ${s.telemetryAutoInstrumentAgents ? "yes" : "no"}`);
    console.log(`  Capture content:        ${s.telemetryCaptureContent ? "yes" : "no"}`);
    console.log(`  Headers:                ${hasHeaders ? "configured" : "not configured"}`);
    console.log(`  Configuration source:   daemon settings`);
  });

telemetryCmd
  .command("on")
  .description("Enable OpenTelemetry")
  .action(async () => {
    const { sendRequest } = await import("./client/ipc.js");
    const res = await sendRequest({ type: "settings-set", settings: { telemetryEnabled: true } });
    if (res.type !== "ok") {
      console.error("Failed to enable telemetry");
      process.exit(1);
    }
    console.log("OpenTelemetry enabled");
  });

telemetryCmd
  .command("off")
  .description("Disable OpenTelemetry")
  .action(async () => {
    const { sendRequest } = await import("./client/ipc.js");
    const res = await sendRequest({ type: "settings-set", settings: { telemetryEnabled: false } });
    if (res.type !== "ok") {
      console.error("Failed to disable telemetry");
      process.exit(1);
    }
    console.log("OpenTelemetry disabled");
  });

telemetryCmd
  .command("endpoint")
  .description("Set the OTLP export endpoint")
  .argument("<url>", "OTLP endpoint URL (e.g. http://127.0.0.1:4318)")
  .action(async (url: string) => {
    const { sendRequest } = await import("./client/ipc.js");
    const res = await sendRequest({ type: "settings-set", settings: { telemetryEndpoint: url } });
    if (res.type !== "ok") {
      console.error("Failed to set telemetry endpoint");
      process.exit(1);
    }
    console.log(`Telemetry endpoint set to ${url}`);
  });

telemetryCmd
  .command("protocol")
  .description("Set the OTLP export protocol")
  .argument("<protocol>", "Protocol: grpc or http/protobuf")
  .action(async (protocol: string) => {
    if (protocol !== "grpc" && protocol !== "http/protobuf") {
      console.error("Protocol must be 'grpc' or 'http/protobuf'");
      process.exit(1);
    }
    const { sendRequest } = await import("./client/ipc.js");
    const res = await sendRequest({ type: "settings-set", settings: { telemetryProtocol: protocol } });
    if (res.type !== "ok") {
      console.error("Failed to set telemetry protocol");
      process.exit(1);
    }
    console.log(`Telemetry protocol set to ${protocol}`);
  });

telemetryCmd
  .command("test")
  .description("Test the OpenTelemetry connection")
  .action(async () => {
    const { sendRequest } = await import("./client/ipc.js");
    const res = await sendRequest({ type: "telemetry-test" });
    if (res.type !== "ok") {
      console.error("Telemetry test failed");
      process.exit(1);
    }
    const result = res.data as { success: boolean; message: string };
    if (result.success) {
      console.log(`OpenTelemetry test succeeded: ${result.message}`);
    } else {
      console.error(`OpenTelemetry test failed: ${result.message}`);
      process.exit(1);
    }
  });

// Default: show status
telemetryCmd.action(async () => {
  const { sendRequest } = await import("./client/ipc.js");
  const res = await sendRequest({ type: "settings-get" });
  if (res.type !== "ok") {
    console.error("Failed to get settings");
    process.exit(1);
  }
  const s = res.data as import("./types.js").DaemonSettings;
  const endpoint = s.telemetryEndpoint ?? "not configured";
  const hasHeaders = !!(process.env.OTEL_EXPORTER_OTLP_HEADERS || process.env.OTEL_EXPORTER_OTLP_TRACES_HEADERS);
  console.log("OpenTelemetry");
  console.log(`  Enabled:                ${s.telemetryEnabled ? "yes" : "no"}`);
  console.log(`  Endpoint:               ${endpoint}`);
  console.log(`  Protocol:               ${s.telemetryProtocol}`);
  console.log(`  Service:                ${s.telemetryServiceName}`);
  console.log(`  Auto-instrument agents: ${s.telemetryAutoInstrumentAgents ? "yes" : "no"}`);
  console.log(`  Capture content:        ${s.telemetryCaptureContent ? "yes" : "no"}`);
  console.log(`  Headers:                ${hasHeaders ? "configured" : "not configured"}`);
});

await program.parseAsync(process.argv);