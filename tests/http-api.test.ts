import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import http from "node:http";
import { HttpApiServer } from "../src/daemon/http/server.js";
import type { LoopMeta, Project } from "../src/types.js";
import type { TaskDefinition } from "../src/types.js";



function makeMockMeta(id: string): LoopMeta {
  return {
    id,
    taskId: null,
    command: "echo",
    commandArgs: [],
    interval: 60000,
    intervalHuman: "1m",
    immediate: false,
    maxRuns: null,
    verbose: false,
    cwd: "",
    description: "test loop",
    status: "running",
    createdAt: new Date().toISOString(),
    sessionStartedAt: null,
    runCount: 0,
    lastRunAt: null,
    lastExitCode: null,
    lastDuration: null,
    nextRunAt: null,
    remainingDelayMs: null,
    pid: 123,
    maxRunsReached: false,
    runHistory: [],
    skippedCount: 0,
    projectId: "default",
    offset: null,
  };
}

function createMocks() {
  const mockManager = {
    list: vi.fn(() => []),
    status: vi.fn((_id: string) => null),
    start: vi.fn((_options: unknown, _intervalHuman: string) => "test-id"),
    update: vi.fn(async (_id: string) => true),
    delete: vi.fn(async (_id: string) => true),
    pause: vi.fn((_id: string) => true),
    resume: vi.fn((_id: string) => true),
    stopLoop: vi.fn((_id: string) => true),
    stopAllLoops: vi.fn(() => 3),
    trigger: vi.fn((_id: string) => true),
    playLoop: vi.fn((_id: string) => true),
    isMaxRunsBlocked: vi.fn(() => false),
    isRunning: vi.fn(() => false),
    isRecipeLoop: vi.fn(() => false),
    getLogPath: vi.fn((_id: string) => null),
  };
  const mockTaskManager = {
    list: vi.fn(() => []),
    get: vi.fn((_id: string) => null),
    create: vi.fn((input: Omit<TaskDefinition, "createdAt">) => ({ ...input, createdAt: new Date().toISOString() })),
    update: vi.fn((_id: string, input: Omit<TaskDefinition, "id" | "createdAt">) => ({ id: _id, ...input, createdAt: new Date().toISOString() })),
    delete: vi.fn((_id: string) => true),
  };
  const mockProjectManager = {
    getAll: vi.fn(() => []),
    create: vi.fn((name: string, color: string, directory?: string, githubSource?: string) => ({
      id: "p1",
      name,
      color,
      directory: directory ?? "",
      githubSource,
      createdAt: new Date().toISOString(),
      isSystem: false,
      isDefault: false,
    })),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const mockSettingsManager = {
    get: vi.fn(() => ({ httpApiEnabled: true })),
    set: vi.fn((partial: Partial<{ httpApiEnabled: boolean }>) => ({ httpApiEnabled: true, ...partial })),
    load: vi.fn(),
    save: vi.fn(),
    onChange: vi.fn(),
  };
  return { mockManager, mockTaskManager, mockProjectManager, mockSettingsManager };
}



interface HttpResponse {
  status: number;
  json: unknown;
  headers: http.IncomingHttpHeaders;
  raw: string;
}

async function request(
  port: number,
  method: string,
  path: string,
  body?: unknown
): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const bodyStr = body !== undefined ? JSON.stringify(body) : undefined;

    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        method,
        path,
        headers: bodyStr
          ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(bodyStr) }
          : {},
      },
      (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on("end", () => {
          let json: unknown = undefined;
          try {
            json = data ? JSON.parse(data) : undefined;
          } catch {
            json = undefined;
          }
          resolve({
            status: res.statusCode ?? 0,
            json,
            headers: res.headers,
            raw: data,
          });
        });
      }
    );

    req.on("error", reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}



async function requestRaw(
  port: number,
  method: string,
  path: string,
  rawBody: string
): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        method,
        path,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(rawBody),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on("end", () => {
          let json: unknown = undefined;
          try {
            json = data ? JSON.parse(data) : undefined;
          } catch {
            json = undefined;
          }
          resolve({
            status: res.statusCode ?? 0,
            json,
            headers: res.headers,
            raw: data,
          });
        });
      }
    );

    req.on("error", reject);
    req.write(rawBody);
    req.end();
  });
}



async function sseRequest(
  port: number,
  path: string
): Promise<{ status: number; contentType: string | undefined; firstChunk: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        method: "GET",
        path,
      },
      (res) => {
        let firstChunk = "";
        const timeout = setTimeout(() => {
          req.destroy();
          resolve({
            status: res.statusCode ?? 0,
            contentType: res.headers["content-type"],
            firstChunk,
          });
        }, 200);

        res.on("data", (chunk: Buffer) => {
          firstChunk += chunk.toString();
          // We got the initial SSE comment, close and resolve
          if (firstChunk.includes(": connected") || firstChunk.length > 0) {
            clearTimeout(timeout);
            req.destroy();
            resolve({
              status: res.statusCode ?? 0,
              contentType: res.headers["content-type"],
              firstChunk,
            });
          }
        });

        res.on("end", () => {
          clearTimeout(timeout);
          resolve({
            status: res.statusCode ?? 0,
            contentType: res.headers["content-type"],
            firstChunk,
          });
        });
      }
    );

    req.on("error", (err) => {
      // Ignore ECONNRESET which happens when we destroy the connection
      if ((err as NodeJS.ErrnoException).code !== "ECONNRESET") {
        reject(err);
      }
    });
    req.end();
  });
}



describe("HttpApiServer integration", () => {
  let server: HttpApiServer;
  let port: number;
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mocks = createMocks();
    server = new HttpApiServer(
      mocks.mockManager as unknown as import("../src/daemon/managers/loop-manager.js").LoopManager,
      mocks.mockTaskManager as unknown as import("../src/daemon/managers/task-manager.js").TaskManager,
      mocks.mockProjectManager as unknown as import("../src/daemon/managers/project-manager.js").ProjectManager,
      mocks.mockSettingsManager as unknown as import("../src/daemon/settings-manager.js").SettingsManager
    );
    await server.listen(0, "127.0.0.1");
    // Retrieve the actual assigned port
    const addr = (server as unknown as { server: { address: () => { port: number } } }).server.address();
    port = addr.port;
  });

  afterEach(async () => {
    await server.close();
  });



  describe("Loops", () => {
    it("POST /api/loops with valid body returns 201 and id", async () => {
      const res = await request(port, "POST", "/api/loops", {
        command: "echo",
        commandArgs: ["hello"],
        intervalHuman: "5m",
        description: "test loop",
      });

      expect(res.status).toBe(201);
      expect(res.json.ok).toBe(true);
      expect(res.json.data.id).toBe("test-id");
      expect(mocks.mockManager.start).toHaveBeenCalledOnce();
    });

    it("POST /api/loops missing required command returns 400", async () => {
      const res = await request(port, "POST", "/api/loops", {
        intervalHuman: "5m",
        description: "missing command",
      });

      expect(res.status).toBe(400);
      expect(res.json.ok).toBe(false);
      expect(res.json.error.message).toBeTruthy();
      expect(mocks.mockManager.start).not.toHaveBeenCalled();
    });

    it("POST /api/loops missing description returns 400", async () => {
      const res = await request(port, "POST", "/api/loops", {
        command: "echo",
        intervalHuman: "5m",
      });

      expect(res.status).toBe(400);
      expect(res.json.ok).toBe(false);
    });

    it("GET /api/loops returns 200 and array", async () => {
      mocks.mockManager.list.mockReturnValueOnce([makeMockMeta("abc")]);
      const res = await request(port, "GET", "/api/loops");

      expect(res.status).toBe(200);
      expect(res.json.ok).toBe(true);
      expect(Array.isArray(res.json.data)).toBe(true);
      expect(res.json.data).toHaveLength(1);
    });

    it("GET /api/loops with empty list returns 200 and empty array", async () => {
      const res = await request(port, "GET", "/api/loops");

      expect(res.status).toBe(200);
      expect(res.json.ok).toBe(true);
      expect(res.json.data).toEqual([]);
    });

    it("GET /api/loops/:id returns 200 when found", async () => {
      mocks.mockManager.status.mockReturnValueOnce(makeMockMeta("abc"));
      const res = await request(port, "GET", "/api/loops/abc");

      expect(res.status).toBe(200);
      expect(res.json.ok).toBe(true);
      expect(res.json.data.id).toBe("abc");
    });

    it("GET /api/loops/:id returns 404 when not found", async () => {
      const res = await request(port, "GET", "/api/loops/nonexistent");

      expect(res.status).toBe(404);
      expect(res.json.ok).toBe(false);
    });

    it("PATCH /api/loops/:id returns 200 when found", async () => {
      mocks.mockManager.update.mockResolvedValueOnce(true);
      const res = await request(port, "PATCH", "/api/loops/abc", {
        command: "echo",
        intervalHuman: "10m",
        description: "updated",
      });

      expect(res.status).toBe(200);
      expect(res.json.ok).toBe(true);
      expect(res.json.data.id).toBe("abc");
    });

    it("PATCH /api/loops/:id returns 404 when not found", async () => {
      mocks.mockManager.update.mockResolvedValueOnce(false);
      const res = await request(port, "PATCH", "/api/loops/nonexistent", {
        command: "echo",
        intervalHuman: "10m",
        description: "updated",
      });

      expect(res.status).toBe(404);
      expect(res.json.ok).toBe(false);
    });

    it("DELETE /api/loops/:id returns 200 when found", async () => {
      mocks.mockManager.delete.mockResolvedValueOnce(true);
      const res = await request(port, "DELETE", "/api/loops/abc");

      expect(res.status).toBe(200);
      expect(res.json.ok).toBe(true);
    });

    it("DELETE /api/loops/:id returns 404 when not found", async () => {
      mocks.mockManager.delete.mockResolvedValueOnce(false);
      const res = await request(port, "DELETE", "/api/loops/nonexistent");

      expect(res.status).toBe(404);
      expect(res.json.ok).toBe(false);
    });

    it("POST /api/loops/:id/pause returns 200 when found", async () => {
      mocks.mockManager.pause.mockReturnValueOnce(true);
      const res = await request(port, "POST", "/api/loops/abc/pause");

      expect(res.status).toBe(200);
      expect(res.json.ok).toBe(true);
      expect(mocks.mockManager.pause).toHaveBeenCalledWith("abc");
    });

    it("POST /api/loops/:id/pause returns 404 when not found", async () => {
      mocks.mockManager.pause.mockReturnValueOnce(false);
      const res = await request(port, "POST", "/api/loops/nonexistent/pause");

      expect(res.status).toBe(404);
      expect(res.json.ok).toBe(false);
    });

    it("POST /api/loops/:id/resume returns 200 when found", async () => {
      mocks.mockManager.resume.mockReturnValueOnce(true);
      const res = await request(port, "POST", "/api/loops/abc/resume");

      expect(res.status).toBe(200);
      expect(res.json.ok).toBe(true);
      expect(mocks.mockManager.resume).toHaveBeenCalledWith("abc");
    });

    it("POST /api/loops/:id/resume returns 404 when not found", async () => {
      mocks.mockManager.resume.mockReturnValueOnce(false);
      const res = await request(port, "POST", "/api/loops/nonexistent/resume");

      expect(res.status).toBe(404);
      expect(res.json.ok).toBe(false);
    });

    it("POST /api/loops/:id/trigger returns 200 when not blocked", async () => {
      mocks.mockManager.isMaxRunsBlocked.mockReturnValueOnce(false);
      mocks.mockManager.isRunning.mockReturnValueOnce(false);
      mocks.mockManager.trigger.mockReturnValueOnce(true);
      const res = await request(port, "POST", "/api/loops/abc/trigger");

      expect(res.status).toBe(200);
      expect(res.json.ok).toBe(true);
      expect(mocks.mockManager.trigger).toHaveBeenCalledWith("abc");
    });

    it("POST /api/loops/:id/trigger returns 400 when maxRuns reached", async () => {
      mocks.mockManager.isMaxRunsBlocked.mockReturnValueOnce(true);
      const res = await request(port, "POST", "/api/loops/abc/trigger");

      expect(res.status).toBe(400);
      expect(res.json.ok).toBe(false);
      expect(res.json.error.message).toContain("Max runs");
    });

    it("POST /api/loops/:id/trigger returns 409 when already running", async () => {
      mocks.mockManager.isMaxRunsBlocked.mockReturnValueOnce(false);
      mocks.mockManager.isRunning.mockReturnValueOnce(true);
      const res = await request(port, "POST", "/api/loops/abc/trigger");

      expect(res.status).toBe(409);
      expect(res.json.ok).toBe(false);
      expect(res.json.error.message).toContain("already running");
    });

    it("POST /api/loops/:id/trigger returns 404 when loop not found", async () => {
      mocks.mockManager.isMaxRunsBlocked.mockReturnValueOnce(false);
      mocks.mockManager.isRunning.mockReturnValueOnce(false);
      mocks.mockManager.trigger.mockReturnValueOnce(false);
      const res = await request(port, "POST", "/api/loops/nonexistent/trigger");

      expect(res.status).toBe(404);
      expect(res.json.ok).toBe(false);
    });

    it("POST /api/loops/:id/stop returns 200 when found", async () => {
      mocks.mockManager.stopLoop.mockReturnValueOnce(true);
      const res = await request(port, "POST", "/api/loops/abc/stop");

      expect(res.status).toBe(200);
      expect(res.json.ok).toBe(true);
      expect(mocks.mockManager.stopLoop).toHaveBeenCalledWith("abc");
    });

    it("POST /api/loops/:id/stop returns 404 when not found", async () => {
      mocks.mockManager.stopLoop.mockReturnValueOnce(false);
      const res = await request(port, "POST", "/api/loops/nonexistent/stop");

      expect(res.status).toBe(404);
      expect(res.json.ok).toBe(false);
    });

    it("POST /api/loops/stop-all returns 200 with count", async () => {
      mocks.mockManager.stopAllLoops.mockReturnValueOnce(5);
      const res = await request(port, "POST", "/api/loops/stop-all");

      expect(res.status).toBe(200);
      expect(res.json.ok).toBe(true);
      expect(res.json.data.count).toBe(5);
    });

    it("POST /api/loops/stop-all with zero loops returns count 0", async () => {
      mocks.mockManager.stopAllLoops.mockReturnValueOnce(0);
      const res = await request(port, "POST", "/api/loops/stop-all");

      expect(res.status).toBe(200);
      expect(res.json.ok).toBe(true);
      expect(res.json.data.count).toBe(0);
    });
  });



  describe("Tasks", () => {
    it("GET /api/tasks returns 200 and array", async () => {
      mocks.mockTaskManager.list.mockReturnValueOnce([
        { id: "t1", name: "Task1", command: "echo", commandArgs: [], createdAt: new Date().toISOString() },
      ]);
      const res = await request(port, "GET", "/api/tasks");

      expect(res.status).toBe(200);
      expect(res.json.ok).toBe(true);
      expect(Array.isArray(res.json.data)).toBe(true);
      expect(res.json.data).toHaveLength(1);
    });

    it("GET /api/tasks with empty list returns 200 and empty array", async () => {
      const res = await request(port, "GET", "/api/tasks");

      expect(res.status).toBe(200);
      expect(res.json.ok).toBe(true);
      expect(res.json.data).toEqual([]);
    });

    it("POST /api/tasks with valid body returns 201", async () => {
      const res = await request(port, "POST", "/api/tasks", {
        id: "t1",
        name: "MyTask",
        command: "echo",
        commandArgs: ["hi"],
        onSuccessTaskId: null,
        onFailureTaskId: null,
        maxRuns: 5,
      });

      expect(res.status).toBe(201);
      expect(res.json.ok).toBe(true);
      expect(res.json.data.name).toBe("MyTask");
      expect(mocks.mockTaskManager.create).toHaveBeenCalledOnce();
    });

    it("POST /api/tasks missing name returns 400", async () => {
      const res = await request(port, "POST", "/api/tasks", {
        id: "t1",
        command: "echo",
        commandArgs: [],
        onSuccessTaskId: null,
        onFailureTaskId: null,
        maxRuns: 5,
      });

      expect(res.status).toBe(400);
      expect(res.json.ok).toBe(false);
      expect(res.json.error.message).toContain("name");
      expect(mocks.mockTaskManager.create).not.toHaveBeenCalled();
    });

    it("POST /api/tasks missing command returns 400", async () => {
      const res = await request(port, "POST", "/api/tasks", {
        id: "t1",
        name: "Task",
        commandArgs: [],
        onSuccessTaskId: null,
        onFailureTaskId: null,
        maxRuns: 5,
      });

      expect(res.status).toBe(400);
      expect(res.json.ok).toBe(false);
      expect(res.json.error.message).toContain("command");
    });

    it("POST /api/tasks with empty name returns 400", async () => {
      const res = await request(port, "POST", "/api/tasks", {
        id: "t1",
        name: "  ",
        command: "echo",
        commandArgs: [],
        onSuccessTaskId: null,
        onFailureTaskId: null,
        maxRuns: 5,
      });

      expect(res.status).toBe(400);
      expect(res.json.ok).toBe(false);
    });

    it("GET /api/tasks/:id returns 200 when found", async () => {
      mocks.mockTaskManager.get.mockReturnValueOnce({
        id: "t1",
        name: "Task1",
        command: "echo",
        commandArgs: [],
        createdAt: new Date().toISOString(),
      });
      const res = await request(port, "GET", "/api/tasks/t1");

      expect(res.status).toBe(200);
      expect(res.json.ok).toBe(true);
      expect(res.json.data.id).toBe("t1");
    });

    it("GET /api/tasks/:id returns 404 when not found", async () => {
      const res = await request(port, "GET", "/api/tasks/nonexistent");

      expect(res.status).toBe(404);
      expect(res.json.ok).toBe(false);
    });

    it("PATCH /api/tasks/:id returns 200 when found", async () => {
      mocks.mockTaskManager.update.mockReturnValueOnce({
        id: "t1",
        name: "Updated",
        command: "echo",
        commandArgs: [],
        createdAt: new Date().toISOString(),
      });
      const res = await request(port, "PATCH", "/api/tasks/t1", {
        name: "Updated",
        command: "echo",
        commandArgs: [],
      });

      expect(res.status).toBe(200);
      expect(res.json.ok).toBe(true);
      expect(res.json.data.name).toBe("Updated");
    });

    it("PATCH /api/tasks/:id returns 404 when not found", async () => {
      mocks.mockTaskManager.update.mockReturnValueOnce(null);
      const res = await request(port, "PATCH", "/api/tasks/nonexistent", {
        name: "Updated",
        command: "echo",
        commandArgs: [],
      });

      expect(res.status).toBe(404);
      expect(res.json.ok).toBe(false);
    });

    it("DELETE /api/tasks/:id returns 200 when found", async () => {
      mocks.mockTaskManager.delete.mockReturnValueOnce(true);
      const res = await request(port, "DELETE", "/api/tasks/t1");

      expect(res.status).toBe(200);
      expect(res.json.ok).toBe(true);
    });

    it("DELETE /api/tasks/:id returns 404 when not found", async () => {
      mocks.mockTaskManager.delete.mockReturnValueOnce(false);
      const res = await request(port, "DELETE", "/api/tasks/nonexistent");

      expect(res.status).toBe(404);
      expect(res.json.ok).toBe(false);
    });
  });



  describe("Projects", () => {
    it("GET /api/projects returns 200 and array", async () => {
      const projects: Project[] = [
        { id: "default", name: "Default", color: "#ffffff", createdAt: new Date().toISOString(), isSystem: true, isDefault: true },
        { id: "p1", name: "Work", color: "#06b6d4", createdAt: new Date().toISOString(), isSystem: false, isDefault: false },
      ];
      mocks.mockProjectManager.getAll.mockReturnValueOnce(projects);
      const res = await request(port, "GET", "/api/projects");

      expect(res.status).toBe(200);
      expect(res.json.ok).toBe(true);
      expect(Array.isArray(res.json.data)).toBe(true);
      expect(res.json.data).toHaveLength(2);
    });

    it("GET /api/projects with empty list returns 200 and empty array", async () => {
      const res = await request(port, "GET", "/api/projects");

      expect(res.status).toBe(200);
      expect(res.json.ok).toBe(true);
      expect(res.json.data).toEqual([]);
    });

    it("POST /api/projects with valid body returns 201", async () => {
      const res = await request(port, "POST", "/api/projects", {
        name: "MyProj",
        color: "#123456",
      });

      expect(res.status).toBe(201);
      expect(res.json.ok).toBe(true);
      expect(res.json.data.name).toBe("MyProj");
      expect(res.json.data.color).toBe("#123456");
      expect(mocks.mockProjectManager.create).toHaveBeenCalledWith("MyProj", "#123456", undefined, undefined);
    });

    it("POST /api/projects with directory and githubSource returns 201", async () => {
      const res = await request(port, "POST", "/api/projects", {
        name: "MyProj",
        color: "#123456",
        directory: "/home/user/project",
        githubSource: "PlainConceptsPlatform/loop-task",
      });

      expect(res.status).toBe(201);
      expect(res.json.ok).toBe(true);
      expect(res.json.data.name).toBe("MyProj");
      expect(res.json.data.directory).toBe("/home/user/project");
      expect(res.json.data.githubSource).toBe("PlainConceptsPlatform/loop-task");
      expect(mocks.mockProjectManager.create).toHaveBeenCalledWith("MyProj", "#123456", "/home/user/project", "PlainConceptsPlatform/loop-task");
    });

    it("POST /api/projects with invalid githubSource returns 400", async () => {
      mocks.mockProjectManager.create.mockImplementationOnce(() => {
        throw new Error('Invalid githubSource format: "invalid". Expected owner/repo (e.g. PlainConceptsPlatform/loop-task)');
      });
      const res = await request(port, "POST", "/api/projects", {
        name: "MyProj",
        color: "#123456",
        githubSource: "invalid",
      });

      expect(res.status).toBe(400);
      expect(res.json.ok).toBe(false);
      expect(res.json.error.message).toContain("githubSource");
    });

    it("PATCH /api/projects/:id with directory and githubSource forwards them", async () => {
      const res = await request(port, "PATCH", "/api/projects/p1", {
        name: "Updated",
        color: "#abcdef",
        directory: "/new/dir",
        githubSource: "owner/repo",
      });

      expect(res.status).toBe(200);
      expect(res.json.ok).toBe(true);
      expect(mocks.mockProjectManager.update).toHaveBeenCalledWith("p1", "Updated", "#abcdef", "/new/dir", "owner/repo");
    });

    it("POST /api/projects with empty name returns 400", async () => {
      const res = await request(port, "POST", "/api/projects", {
        name: "",
        color: "#fff",
      });

      expect(res.status).toBe(400);
      expect(res.json.ok).toBe(false);
      expect(res.json.error.message).toContain("name");
      expect(mocks.mockProjectManager.create).not.toHaveBeenCalled();
    });

    it("POST /api/projects with whitespace-only name returns 400", async () => {
      const res = await request(port, "POST", "/api/projects", {
        name: "   ",
        color: "#fff",
      });

      expect(res.status).toBe(400);
      expect(res.json.ok).toBe(false);
    });

    it("POST /api/projects without color defaults to #ffffff", async () => {
      const res = await request(port, "POST", "/api/projects", {
        name: "NoColor",
      });

      expect(res.status).toBe(201);
      expect(mocks.mockProjectManager.create).toHaveBeenCalledWith("NoColor", "#ffffff", undefined, undefined);
    });

    it("DELETE /api/projects/:id returns 200 when project can be deleted", async () => {
      const res = await request(port, "DELETE", "/api/projects/p1");

      expect(res.status).toBe(200);
      expect(res.json.ok).toBe(true);
    });

    it("DELETE /api/projects/:id for system project returns 400", async () => {
      mocks.mockProjectManager.delete.mockImplementationOnce(() => {
        throw new Error("Cannot delete system project");
      });
      const res = await request(port, "DELETE", "/api/projects/default");

      expect(res.status).toBe(400);
      expect(res.json.ok).toBe(false);
      expect(res.json.error.message).toContain("system");
    });

    it("DELETE /api/projects/:id for non-existent project returns 400", async () => {
      mocks.mockProjectManager.delete.mockImplementationOnce(() => {
        throw new Error("Project nonexistent not found");
      });
      const res = await request(port, "DELETE", "/api/projects/nonexistent");

      expect(res.status).toBe(400);
      expect(res.json.ok).toBe(false);
    });
  });



  describe("Swagger / OpenAPI", () => {
    it("GET /api/openapi.json returns 200 with OpenAPI 3.0.3 spec", async () => {
      const res = await request(port, "GET", "/api/openapi.json");

      expect(res.status).toBe(200);
      expect(res.json.openapi).toBe("3.0.3");
      expect(res.json.paths).toBeDefined();
      expect(typeof res.json.paths).toBe("object");
    });

    it("GET /api/openapi.json includes loops paths", async () => {
      const res = await request(port, "GET", "/api/openapi.json");

      expect(res.json.paths["/api/loops"]).toBeDefined();
      expect(res.json.paths["/api/loops/{id}"]).toBeDefined();
    });

    it("GET /api/docs returns 200 with text/html content type", async () => {
      const res = await request(port, "GET", "/api/docs");

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/html");
      expect(res.raw).toContain("swagger-ui");
    });

    it("GET / returns 200 with text/html content type", async () => {
      const res = await request(port, "GET", "/");

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/html");
      expect(res.raw).toContain("swagger-ui");
    });
  });



  describe("SSE", () => {
    it("GET /api/events returns text/event-stream", async () => {
      const result = await sseRequest(port, "/api/events");

      expect(result.status).toBe(200);
      expect(result.contentType).toBe("text/event-stream");
      expect(result.firstChunk).toContain(": connected");
    });

    it("GET /api/events keeps connection open (SSE)", async () => {
      // The fact that sseRequest resolved means we got a chunk.
      // If the server had closed the connection immediately, we'd still get a response,
      // but the content-type would not be text/event-stream.
      const result = await sseRequest(port, "/api/events");

      expect(result.contentType).toBe("text/event-stream");
    });

    it("broadcastEvent sends data to SSE client", async () => {
      // Open SSE connection
      const ssePromise = sseRequest(port, "/api/events");
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Broadcast an event
      server.broadcastEvent("loop:started", { id: "abc" });

      const result = await ssePromise;
      expect(result.contentType).toBe("text/event-stream");
    });
  });



  describe("Error handling", () => {
    it("unknown route returns 404", async () => {
      const res = await request(port, "GET", "/api/unknown-endpoint");

      expect(res.status).toBe(404);
      expect(res.json.ok).toBe(false);
      expect(res.json.error.message).toContain("Not found");
    });

    it("unknown route includes method and path in error", async () => {
      const res = await request(port, "PUT", "/api/does-not-exist");

      expect(res.status).toBe(404);
      expect(res.json.error.message).toContain("/api/does-not-exist");
    });

    it("malformed JSON body on POST returns 400", async () => {
      const res = await requestRaw(port, "POST", "/api/loops", "{ this is not valid json }");

      expect(res.status).toBe(400);
      expect(res.json.ok).toBe(false);
    });

    it("malformed JSON body on POST /api/tasks returns 400", async () => {
      const res = await requestRaw(port, "POST", "/api/tasks", "{ broken");

      expect(res.status).toBe(400);
      expect(res.json.ok).toBe(false);
    });

    it("POST with empty body resolves to empty object (not error)", async () => {
      // Empty body should resolve to {} in readBody, then validation catches missing fields
      const res = await requestRaw(port, "POST", "/api/tasks", "");

      expect(res.status).toBe(400);
      expect(res.json.ok).toBe(false);
      expect(res.json.error.message).toContain("name");
    });
  });



  describe("Response envelope", () => {
    it("success responses use { ok: true, data: ... }", async () => {
      const res = await request(port, "GET", "/api/loops");

      expect(res.json.ok).toBe(true);
      expect(res.json).toHaveProperty("data");
    });

    it("error responses use { ok: false, error: { message } }", async () => {
      const res = await request(port, "GET", "/api/loops/nonexistent");

      expect(res.json.ok).toBe(false);
      expect(res.json).toHaveProperty("error");
      expect(res.json.error).toHaveProperty("message");
    });

    it("success response with null data still has ok: true", async () => {
      // DELETE with mock returning true → sendOk(res) → data: null
      mocks.mockManager.delete.mockResolvedValueOnce(true);
      const res = await request(port, "DELETE", "/api/loops/abc");

      expect(res.json.ok).toBe(true);
      expect(res.json.data).toBeNull();
    });

    it("Content-Type is application/json for JSON responses", async () => {
      const res = await request(port, "GET", "/api/loops");

      expect(res.headers["content-type"]).toBe("application/json");
    });
  });

  describe("POST /api/loops/:id/play", () => {
    it("returns 200 with loop meta when found and not blocked", async () => {
      const meta = makeMockMeta("abc");
      mocks.mockManager.isMaxRunsBlocked.mockReturnValueOnce(false);
      mocks.mockManager.isRunning.mockReturnValueOnce(false);
      mocks.mockManager.playLoop.mockReturnValueOnce(true);
      mocks.mockManager.status.mockReturnValueOnce(meta);
      const res = await request(port, "POST", "/api/loops/abc/play");

      expect(res.status).toBe(200);
      expect(res.json.ok).toBe(true);
      expect(res.json.data.id).toBe("abc");
      expect(mocks.mockManager.playLoop).toHaveBeenCalledWith("abc");
    });

    it("returns 409 when max runs blocked", async () => {
      mocks.mockManager.isMaxRunsBlocked.mockReturnValueOnce(true);
      const res = await request(port, "POST", "/api/loops/abc/play");

      expect(res.status).toBe(409);
      expect(res.json.ok).toBe(false);
      expect(res.json.error.message).toContain("Max runs");
    });

    it("returns 409 when loop is already running", async () => {
      mocks.mockManager.isMaxRunsBlocked.mockReturnValueOnce(false);
      mocks.mockManager.isRunning.mockReturnValueOnce(true);
      const res = await request(port, "POST", "/api/loops/abc/play");

      expect(res.status).toBe(409);
      expect(res.json.ok).toBe(false);
      expect(res.json.error.message).toContain("already running");
    });

    it("returns 404 when loop not found", async () => {
      mocks.mockManager.isMaxRunsBlocked.mockReturnValueOnce(false);
      mocks.mockManager.isRunning.mockReturnValueOnce(false);
      mocks.mockManager.playLoop.mockReturnValueOnce(false);
      const res = await request(port, "POST", "/api/loops/nonexistent/play");

      expect(res.status).toBe(404);
      expect(res.json.ok).toBe(false);
    });
  });

  describe("POST /api/task-chains", () => {
    it("returns 201 with taskIds for sequential-success chain", async () => {
      mocks.mockTaskManager.create
        .mockReturnValueOnce({ id: "t1", name: "A", command: "echo", commandArgs: [], onSuccessTaskId: null, onFailureTaskId: null, maxRuns: 5, createdAt: new Date().toISOString() })
        .mockReturnValueOnce({ id: "t2", name: "B", command: "echo", commandArgs: [], onSuccessTaskId: null, onFailureTaskId: null, maxRuns: 5, createdAt: new Date().toISOString() })
        .mockReturnValueOnce({ id: "t3", name: "C", command: "echo", commandArgs: [], onSuccessTaskId: null, onFailureTaskId: null, maxRuns: 5, createdAt: new Date().toISOString() });
      mocks.mockTaskManager.update
        .mockReturnValueOnce({ id: "t1", name: "A", command: "echo", commandArgs: [], onSuccessTaskId: "t2", onFailureTaskId: null, maxRuns: 5, createdAt: new Date().toISOString() })
        .mockReturnValueOnce({ id: "t2", name: "B", command: "echo", commandArgs: [], onSuccessTaskId: "t3", onFailureTaskId: null, maxRuns: 5, createdAt: new Date().toISOString() });

      const res = await request(port, "POST", "/api/task-chains", {
        tasks: [
          { id: "t1", name: "A", command: "echo", commandArgs: [], onSuccessTaskId: null, onFailureTaskId: null, maxRuns: 5 },
          { id: "t2", name: "B", command: "echo", commandArgs: [], onSuccessTaskId: null, onFailureTaskId: null, maxRuns: 5 },
          { id: "t3", name: "C", command: "echo", commandArgs: [], onSuccessTaskId: null, onFailureTaskId: null, maxRuns: 5 },
        ],
        chain: "sequential-success",
      });

      expect(res.status).toBe(201);
      expect(res.json.ok).toBe(true);
      expect(res.json.data.taskIds).toEqual(["t1", "t2", "t3"]);
    });

    it("returns 400 when tasks array is empty", async () => {
      const res = await request(port, "POST", "/api/task-chains", {
        tasks: [],
        chain: "none",
      });

      expect(res.status).toBe(400);
      expect(res.json.ok).toBe(false);
    });

    it("returns 400 for invalid chain mode", async () => {
      const res = await request(port, "POST", "/api/task-chains", {
        tasks: [{ id: "t1", name: "A", command: "echo", commandArgs: [], onSuccessTaskId: null, onFailureTaskId: null, maxRuns: 5 }],
        chain: "invalid",
      });

      expect(res.status).toBe(400);
      expect(res.json.ok).toBe(false);
    });

    it("returns 400 when task name is missing", async () => {
      const res = await request(port, "POST", "/api/task-chains", {
        tasks: [{ id: "t1", name: "", command: "echo", commandArgs: [], onSuccessTaskId: null, onFailureTaskId: null, maxRuns: 5 }],
        chain: "none",
      });

      expect(res.status).toBe(400);
      expect(res.json.ok).toBe(false);
    });
  });

  describe("GET /api/loops/:id/runs", () => {
    it("returns 200 with run history when loop found", async () => {
      const meta = makeMockMeta("abc");
      meta.runHistory = [
        { runNumber: 1, startedAt: "2025-01-01T00:00:00Z", exitCode: 0, duration: 100, logSize: 50, status: "completed" as const, logOffset: 0 },
        { runNumber: 2, startedAt: "2025-01-02T00:00:00Z", exitCode: 1, duration: 200, logSize: 50, status: "completed" as const, logOffset: 50 },
      ];
      mocks.mockManager.status.mockReturnValueOnce(meta);
      const res = await request(port, "GET", "/api/loops/abc/runs");

      expect(res.status).toBe(200);
      expect(res.json.ok).toBe(true);
      expect(res.json.data).toHaveLength(2);
    });

    it("filters by from date", async () => {
      const meta = makeMockMeta("abc");
      meta.runHistory = [
        { runNumber: 1, startedAt: "2025-01-01T00:00:00Z", exitCode: 0, duration: 100, logSize: 50, status: "completed" as const, logOffset: 0 },
        { runNumber: 2, startedAt: "2025-01-02T00:00:00Z", exitCode: 1, duration: 200, logSize: 50, status: "completed" as const, logOffset: 50 },
      ];
      mocks.mockManager.status.mockReturnValueOnce(meta);
      const res = await request(port, "GET", "/api/loops/abc/runs?from=2025-01-02T00:00:00Z");

      expect(res.status).toBe(200);
      expect(res.json.ok).toBe(true);
      expect(res.json.data).toHaveLength(1);
      expect(res.json.data[0].runNumber).toBe(2);
    });

    it("returns 404 when loop not found", async () => {
      const res = await request(port, "GET", "/api/loops/nonexistent/runs");

      expect(res.status).toBe(404);
      expect(res.json.ok).toBe(false);
    });
  });

  describe("GET /api/loops/:id/logs/date", () => {
    it("returns 400 when from is missing", async () => {
      const meta = makeMockMeta("abc");
      mocks.mockManager.status.mockReturnValueOnce(meta);
      const res = await request(port, "GET", "/api/loops/abc/logs/date?to=2025-01-02T00:00:00Z");

      expect(res.status).toBe(400);
      expect(res.json.ok).toBe(false);
    });

    it("returns 400 when to is missing", async () => {
      const meta = makeMockMeta("abc");
      mocks.mockManager.status.mockReturnValueOnce(meta);
      const res = await request(port, "GET", "/api/loops/abc/logs/date?from=2025-01-01T00:00:00Z");

      expect(res.status).toBe(400);
      expect(res.json.ok).toBe(false);
    });

    it("returns 404 when loop not found", async () => {
      const res = await request(port, "GET", "/api/loops/nonexistent/logs/date?from=2025-01-01T00:00:00Z&to=2025-01-02T00:00:00Z");

      expect(res.status).toBe(404);
      expect(res.json.ok).toBe(false);
    });
  });

  describe("GET/PATCH /api/settings", () => {
    it("GET /api/settings returns 200 with settings", async () => {
      mocks.mockSettingsManager.get.mockReturnValueOnce({ httpApiEnabled: true });
      const res = await request(port, "GET", "/api/settings");

      expect(res.status).toBe(200);
      expect(res.json.ok).toBe(true);
      expect(res.json.data.httpApiEnabled).toBe(true);
    });

    it("PATCH /api/settings returns 200 with updated settings", async () => {
      mocks.mockSettingsManager.set.mockReturnValueOnce({ httpApiEnabled: false });
      const res = await request(port, "PATCH", "/api/settings", { httpApiEnabled: false });

      expect(res.status).toBe(200);
      expect(res.json.ok).toBe(true);
      expect(res.json.data.httpApiEnabled).toBe(false);
      expect(mocks.mockSettingsManager.set).toHaveBeenCalledWith({ httpApiEnabled: false });
    });
  });
});
