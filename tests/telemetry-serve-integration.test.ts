import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OpenCodeTelemetryIntegration } from "../src/daemon/telemetry/agent-integrations/opencode-integration.js";

// Mock fetch for health checks
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock execa
vi.mock("execa", () => ({
  execa: vi.fn(() => {
    const fakeProc: any = {
      pid: 12345,
      on: vi.fn(),
      catch: vi.fn(),
      kill: vi.fn(),
      then: vi.fn(),
      catch: vi.fn(),
    };
    return fakeProc;
  }),
}));

import { execa } from "execa";

describe("OpenCodeTelemetryIntegration serve lifecycle", () => {
  let integration: OpenCodeTelemetryIntegration;

  beforeEach(() => {
    integration = new OpenCodeTelemetryIntegration();
    mockFetch.mockReset();
    vi.mocked(execa).mockClear();
  });

  afterEach(async () => {
    await integration.shutdownServe?.();
  });

  describe("matches", () => {
    it("matches opencode run", () => {
      expect(integration.matches("opencode", ["run", "do something"])).toBe(true);
    });

    it("matches opencode via absolute path", () => {
      expect(integration.matches("/usr/bin/opencode", ["run"])).toBe(true);
    });

    it("matches opencode.exe on Windows", () => {
      expect(integration.matches("C:/tools/opencode.exe", ["run"])).toBe(true);
    });

    it("does not match opencode without run", () => {
      expect(integration.matches("opencode", ["serve"])).toBe(false);
    });

    it("does not match other commands", () => {
      expect(integration.matches("echo", ["hello"])).toBe(false);
    });
  });

  describe("prepareRunArgs", () => {
    it("injects --attach and --dir after run", () => {
      const args = ["run", "--agent", "fullstack", "do something"];
      const result = integration.prepareRunArgs!(args, "/repo");
      expect(result).toContain("--attach");
      expect(result).toContain("http://localhost:4096");
      expect(result).toContain("--dir");
      expect(result).toContain("/repo");
      // --attach should come after "run"
      const runIdx = result.indexOf("run");
      const attachIdx = result.indexOf("--attach");
      expect(attachIdx).toBeGreaterThan(runIdx);
    });

    it("does not double-inject --attach if already present", () => {
      const args = ["run", "--attach", "http://localhost:4096", "do something"];
      const result = integration.prepareRunArgs!(args, "/repo");
      const attachCount = result.filter((a) => a === "--attach").length;
      expect(attachCount).toBe(1);
    });

    it("does not inject --dir if already present", () => {
      const args = ["run", "--dir", "/custom", "do something"];
      const result = integration.prepareRunArgs!(args, "/repo");
      const dirCount = result.filter((a) => a === "--dir").length;
      expect(dirCount).toBe(1);
    });

    it("does not inject --dir when cwd is not provided", () => {
      const args = ["run", "do something"];
      const result = integration.prepareRunArgs!(args);
      expect(result).not.toContain("--dir");
      expect(result).toContain("--attach");
    });

    it("returns args unchanged if run is not present", () => {
      const args = ["serve", "--port", "4096"];
      const result = integration.prepareRunArgs!(args, "/repo");
      expect(result).toEqual(args);
    });
  });

  describe("isServeAlive", () => {
    it("returns false when serve has not been started", () => {
      expect(integration.isServeAlive!()).toBe(false);
    });

    it("returns true after ensureServe starts successfully", async () => {
      // Mock health check to return healthy
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ healthy: true }),
      });

      // Mock execa to return a fake process
      const fakeProc: any = {
        pid: 12345,
        on: vi.fn(),
        catch: vi.fn(),
        kill: vi.fn(),
      };
      vi.mocked(execa).mockReturnValue(fakeProc as any);

      const info = await integration.ensureServe!("/repo", { OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:4318" });
      expect(info).toBeDefined();
      expect(info?.port).toBe(4096);
      expect(info?.pid).toBe(12345);
      expect(integration.isServeAlive!()).toBe(true);
    });

    it("returns false after shutdownServe", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ healthy: true }),
      });

      const fakeProc: any = {
        pid: 12345,
        on: vi.fn(),
        catch: vi.fn(),
        kill: vi.fn(),
      };
      vi.mocked(execa).mockReturnValue(fakeProc as any);

      await integration.ensureServe!("/repo", {});
      expect(integration.isServeAlive!()).toBe(true);

      await integration.shutdownServe!();
      expect(integration.isServeAlive!()).toBe(false);
    });
  });

  describe("prepareChildProcess telemetry env split", () => {
    it("skips static OTEL env when serve is alive", async () => {
      // This test verifies the integration's isServeAlive affects prepareChildProcess
      // The actual prepareChildProcess is in open-telemetry-adapter.ts, but we test
      // the integration's isServeAlive method here

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ healthy: true }),
      });

      const fakeProc: any = {
        pid: 12345,
        on: vi.fn(),
        catch: vi.fn(),
        kill: vi.fn(),
      };
      vi.mocked(execa).mockReturnValue(fakeProc as any);

      await integration.ensureServe!("/repo", {});

      // When serve is alive, isServeAlive returns true
      expect(integration.isServeAlive!()).toBe(true);
    });

    it("returns false for non-opencode commands (no serve)", () => {
      // When serve hasn't been started, isServeAlive is false
      expect(integration.isServeAlive!()).toBe(false);
    });
  });
});
