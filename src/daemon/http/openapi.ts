import { HTTP_API_HOST, HTTP_API_PORT } from "../../shared/config/constants.js";

export function buildOpenApiSpec(): Record<string, unknown> {
  return {
    openapi: "3.0.3",
    info: {
      title: "loop-task HTTP API",
      version: "1.0.0",
      description: "REST + SSE API for managing loops, tasks, projects, and logs. Binds to all interfaces (0.0.0.0) by default so it is reachable remotely; the bind host is configurable via `loop-task http-host`. The API is unauthenticated, secure access at the network layer (SSH/Tailscale/firewall), or restrict the bind to 127.0.0.1.",
    },
    servers: [
      { url: `http://${HTTP_API_HOST}:${HTTP_API_PORT}`, description: "Local daemon" },
    ],
    tags: [
      { name: "Loops", description: "Loop management" },
      { name: "Tasks", description: "Task management" },
      { name: "Task Chains", description: "Create chained tasks" },
      { name: "Projects", description: "Project management" },
      { name: "Logs", description: "Log retrieval" },
      { name: "Events", description: "Server-sent events" },
      { name: "Settings", description: "Daemon settings" },
      { name: "MCP", description: "Model Context Protocol server" },
      { name: "Docs", description: "API documentation" },
    ],
    paths: {
      "/api/loops": {
        get: { summary: "List all loops", tags: ["Loops"], responses: { "200": { description: "Array of loops", content: { "application/json": { schema: { type: "array" } } } } } },
        post: { summary: "Create a new loop", tags: ["Loops"], requestBody: { content: { "application/json": { schema: { type: "object", properties: { command: { type: "string" }, commandArgs: { type: "array", items: { type: "string" } }, intervalHuman: { type: "string", example: "5m", description: "Interval like 30s, 5m, 1h, or 'manual' for trigger-only loops" }, cwd: { type: "string" }, description: { type: "string" }, taskId: { type: "string" }, now: { type: "boolean" }, maxRuns: { type: "integer" }, verbose: { type: "boolean" }, projectId: { type: "string" }, offset: { type: "integer" }, context: { type: "object", additionalProperties: true, description: "Initial context for chain interpolation" } } } } } }, responses: { "201": { description: "Loop created", content: { "application/json": { schema: { type: "object", properties: { id: { type: "string" } } } } } }, "400": { description: "Validation error" } } },
      },
      "/api/loops/{id}": {
        get: { summary: "Get loop status", tags: ["Loops"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Loop details" }, "404": { description: "Not found" } } },
        patch: { summary: "Update a loop", tags: ["Loops"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: { content: { "application/json": { schema: { type: "object" } } } }, responses: { "200": { description: "Updated" }, "400": { description: "Validation error" }, "404": { description: "Not found" } } },
        delete: { summary: "Delete a loop", tags: ["Loops"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Deleted" }, "404": { description: "Not found" } } },
      },
      "/api/loops/{id}/pause": { post: { summary: "Pause a loop", tags: ["Loops"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Paused" }, "404": { description: "Not found" } } } },
      "/api/loops/{id}/resume": { post: { summary: "Resume a loop", tags: ["Loops"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Resumed" }, "404": { description: "Not found" } } } },
      "/api/loops/{id}/play": { post: { summary: "Play (start) a loop", tags: ["Loops"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Playing", content: { "application/json": { schema: { type: "object" } } } }, "404": { description: "Not found" }, "409": { description: "Already running or max runs blocked" } } } },
      "/api/loops/{id}/trigger": { post: { summary: "Trigger a loop now", tags: ["Loops"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Triggered" }, "404": { description: "Not found" }, "400": { description: "Max runs reached" }, "409": { description: "Already running" } } } },
      "/api/loops/{id}/stop": { post: { summary: "Stop a loop", tags: ["Loops"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Stopped" }, "404": { description: "Not found" } } } },
      "/api/loops/stop-all": { post: { summary: "Stop all loops", tags: ["Loops"], responses: { "200": { description: "All stopped", content: { "application/json": { schema: { type: "object", properties: { count: { type: "integer" } } } } } } } } },
      "/api/loops/{id}/runs": { get: { summary: "List run history", tags: ["Loops"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }, { name: "from", in: "query", schema: { type: "string", description: "ISO 8601 date" } }, { name: "to", in: "query", schema: { type: "string", description: "ISO 8601 date" } }], responses: { "200": { description: "Run records", content: { "application/json": { schema: { type: "array" } } } }, "404": { description: "Not found" } } } },
      "/api/loops/{id}/logs/date": { get: { summary: "Date-filtered logs", tags: ["Logs"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }, { name: "from", in: "query", required: true, schema: { type: "string", description: "ISO 8601 start date" } }, { name: "to", in: "query", required: true, schema: { type: "string", description: "ISO 8601 end date" } }], responses: { "200": { description: "Filtered log content" }, "404": { description: "Not found" }, "400": { description: "Missing or invalid date params" } } } },
      "/api/loops/{id}/logs": { get: { summary: "Fetch loop logs", tags: ["Logs"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }, { name: "tail", in: "query", schema: { type: "integer", default: 50 } }], responses: { "200": { description: "Log content" }, "404": { description: "Not found" } } } },
      "/api/loops/{id}/logs/stream": { get: { summary: "Stream logs via SSE", tags: ["Logs"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }, { name: "tail", in: "query", schema: { type: "integer" } }], responses: { "200": { description: "SSE stream" }, "404": { description: "Not found" } } } },
      "/api/loops/{id}/runs/{num}": { get: { summary: "Get run-specific log", tags: ["Logs"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }, { name: "num", in: "path", required: true, schema: { type: "integer" } }], responses: { "200": { description: "Run log content" } } } },
      "/api/tasks": {
        get: { summary: "List all tasks", tags: ["Tasks"], responses: { "200": { description: "Array of tasks" } } },
        post: { summary: "Create a task", tags: ["Tasks"], requestBody: { content: { "application/json": { schema: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, command: { type: "string" }, commandArgs: { type: "array", items: { type: "string" } }, onSuccessTaskId: { type: "string" }, onFailureTaskId: { type: "string" }, maxRuns: { type: "integer" }, context: { type: "object", additionalProperties: true, description: "Initial context for chain interpolation" } } } } } }, responses: { "201": { description: "Task created" }, "400": { description: "Validation error" } } },
      },
      "/api/tasks/{id}": {
        get: { summary: "Get a task", tags: ["Tasks"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Task details" }, "404": { description: "Not found" } } },
        patch: { summary: "Update a task", tags: ["Tasks"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: { content: { "application/json": { schema: { type: "object" } } } }, responses: { "200": { description: "Updated" }, "404": { description: "Not found" } } },
        delete: { summary: "Delete a task", tags: ["Tasks"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Deleted" }, "404": { description: "Not found" } } },
      },
      "/api/task-chains": { post: { summary: "Create a chain of tasks", tags: ["Task Chains"], requestBody: { content: { "application/json": { schema: { type: "object", required: ["tasks"], properties: { tasks: { type: "array", items: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, command: { type: "string" }, commandArgs: { type: "array", items: { type: "string" } }, onSuccessTaskId: { type: "string" }, onFailureTaskId: { type: "string" }, maxRuns: { type: "integer" } } } }, chain: { type: "string", enum: ["sequential-success", "sequential-failure", "none"], description: "How to wire tasks together" } } } } } }, responses: { "201": { description: "Chain created", content: { "application/json": { schema: { type: "object", properties: { taskIds: { type: "array", items: { type: "string" } } } } } } }, "400": { description: "Validation error or rollback" } } } },
      "/api/projects": {
        get: { summary: "List all projects", tags: ["Projects"], responses: { "200": { description: "Array of projects" } } },
        post: { summary: "Create a project", tags: ["Projects"], requestBody: { content: { "application/json": { schema: { type: "object", properties: { name: { type: "string" }, color: { type: "string" }, directory: { type: "string", description: "Optional local working directory for loops" }, githubSource: { type: "string", description: "Optional GitHub repository in owner/repo format (e.g. PlainConceptsPlatform/loop-task)" } } } } } }, responses: { "201": { description: "Project created" }, "400": { description: "Validation error" } } },
      },
      "/api/projects/{id}": {
        patch: { summary: "Update a project", tags: ["Projects"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: { content: { "application/json": { schema: { type: "object", properties: { name: { type: "string" }, color: { type: "string" }, directory: { type: "string", description: "Optional local working directory for loops" }, githubSource: { type: "string", description: "Optional GitHub repository in owner/repo format (e.g. PlainConceptsPlatform/loop-task)" } } } } } }, responses: { "200": { description: "Updated" }, "404": { description: "Not found" }, "400": { description: "Validation error" } } },
        delete: { summary: "Delete a project", tags: ["Projects"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Deleted" }, "400": { description: "Cannot delete system project" } } },
      },
      "/api/settings": { get: { summary: "Get daemon settings", tags: ["Settings"], responses: { "200": { description: "Current settings", content: { "application/json": { schema: { type: "object", properties: { httpApiEnabled: { type: "boolean" }, mcpApiEnabled: { type: "boolean" } } } } } } } }, patch: { summary: "Update daemon settings", tags: ["Settings"], requestBody: { content: { "application/json": { schema: { type: "object", properties: { httpApiEnabled: { type: "boolean" }, mcpApiEnabled: { type: "boolean" } } } } } }, responses: { "200": { description: "Updated settings", content: { "application/json": { schema: { type: "object", properties: { httpApiEnabled: { type: "boolean" }, mcpApiEnabled: { type: "boolean" } } } } } }, "400": { description: "Validation error" } } } },
      "/api/events": { get: { summary: "Subscribe to daemon events via SSE", tags: ["Events"], responses: { "200": { description: "SSE event stream" } } } },
      "/api/openapi.json": { get: { summary: "OpenAPI 3.0 spec", tags: ["Docs"], responses: { "200": { description: "OpenAPI JSON spec" } } } },
      "/api/docs": { get: { summary: "Swagger UI", tags: ["Docs"], responses: { "200": { description: "HTML page" } } } },
    },
    components: {
      schemas: {
        DaemonSettings: {
          type: "object",
          properties: {
            httpApiEnabled: { type: "boolean", description: "Whether the HTTP API server is enabled" },
            mcpApiEnabled: { type: "boolean", description: "Whether the MCP server is enabled" },
          },
        },
      },
    },
  };
}

export function buildSwaggerHtml(): string {
  const specUrl = "/api/openapi.json";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>loop-task API</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
  <style>
    body { margin: 0; }
    .swagger-ui { max-width: 1200px; margin: 0 auto; }
    .header { background: #0d1117; color: #58a6ff; padding: 12px 24px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 14px; }
    .header a { color: #58a6ff; text-decoration: none; }
    .header a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="header">
    <strong>loop-task HTTP API</strong> &mdash;
    <a href="/api/openapi.json">OpenAPI JSON</a> &mdash;
    <a href="/api/docs">Swagger UI</a>
  </div>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      window.ui = SwaggerUIBundle({
        url: "${specUrl}",
        dom_id: "#swagger-ui",
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis],
        layout: "BaseLayout",
      });
    };
  </script>
</body>
</html>`;
}
