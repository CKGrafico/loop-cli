import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProjectManager } from "../src/daemon/managers/project-manager.js";

let tmpDir: string;
let origHome: string | undefined;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "loop-projects-daemon-test-"));
  origHome = process.env.LOOP_CLI_HOME;
  process.env.LOOP_CLI_HOME = tmpDir;
});

afterEach(() => {
  if (origHome === undefined) delete process.env.LOOP_CLI_HOME;
  else process.env.LOOP_CLI_HOME = origHome;
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("ProjectManager", () => {
  let manager: ProjectManager;

  beforeEach(() => {
    manager = new ProjectManager();
  });



  describe("init()", () => {
    it("creates Default project when empty", () => {
      manager.init();
      const projects = manager.getAll();
      expect(projects).toHaveLength(1);
      const def = projects[0];
      expect(def).toBeDefined();
      expect(def!.id).toBe("default");
      expect(def!.name).toBe("Default");
      expect(def!.isDefault).toBe(true);
      expect(def!.isSystem).toBe(true);
      expect(def!.color).toBe("#ffffff");
      expect(def!.githubSource).toBeUndefined();
    });

    it("does not duplicate Default when called twice", () => {
      manager.init();
      manager.init();
      const defaults = manager.getAll().filter((p) => p.id === "default");
      expect(defaults).toHaveLength(1);
    });
  });



  describe("create()", () => {
    it("returns a project with correct fields", () => {
      manager.init();
      const project = manager.create("Work", "#06b6d4");

      expect(project.name).toBe("Work");
      expect(project.color).toBe("#06b6d4");
      expect(project.id).toBeTruthy();
      expect(project.id).not.toBe("default");
      expect(project.isDefault).toBe(false);
      expect(project.isSystem).toBe(false);
      expect(project.createdAt).toBeTruthy();
    });

    it("persists to disk and is loadable by a fresh manager", () => {
      manager.init();
      const project = manager.create("SideProject", "#4ade80");

      const fresh = new ProjectManager();
      fresh.init();
      const found = fresh.get(project.id);
      expect(found).toBeDefined();
      expect(found!.name).toBe("SideProject");
      expect(found!.color).toBe("#4ade80");
    });

    it("creates multiple projects with unique ids", () => {
      manager.init();
      const p1 = manager.create("Alpha", "#ff0000");
      const p2 = manager.create("Beta", "#00ff00");
      expect(p1.id).not.toBe(p2.id);
      expect(manager.getAll()).toHaveLength(3); // default + alpha + beta
    });

    it("creates project with directory and githubSource", () => {
      manager.init();
      const project = manager.create("Work", "#06b6d4", "/home/user/project", "PlainConceptsPlatform/loop-task");
      expect(project.directory).toBe("/home/user/project");
      expect(project.githubSource).toBe("PlainConceptsPlatform/loop-task");
    });

    it("creates project without githubSource when not provided", () => {
      manager.init();
      const project = manager.create("Work", "#06b6d4");
      expect(project.githubSource).toBeUndefined();
    });

    it("throws on invalid githubSource format", () => {
      manager.init();
      expect(() => manager.create("Bad", "#fff", undefined, "no-slash")).toThrow(/Invalid githubSource/i);
      expect(() => manager.create("Bad2", "#fff", undefined, "has spaces/repo")).toThrow(/Invalid githubSource/i);
      expect(() => manager.create("Bad3", "#fff", undefined, "a/b/c")).toThrow(/Invalid githubSource/i);
    });

    it("accepts valid githubSource formats", () => {
      manager.init();
      expect(() => manager.create("Ok1", "#fff", undefined, "owner/repo")).not.toThrow();
      expect(() => manager.create("Ok2", "#fff", undefined, "PlainConceptsPlatform/loop-task")).not.toThrow();
      expect(() => manager.create("Ok3", "#fff", undefined, "my-org.my-team/my.repo")).not.toThrow();
    });

    it("persists githubSource to disk", () => {
      manager.init();
      const project = manager.create("Work", "#06b6d4", "/dir", "owner/repo");

      const fresh = new ProjectManager();
      fresh.init();
      const found = fresh.get(project.id);
      expect(found!.githubSource).toBe("owner/repo");
    });
  });



  describe("get()", () => {
    it("returns project by id", () => {
      manager.init();
      const project = manager.create("Target", "#ff5722");
      expect(manager.get(project.id)).toBeDefined();
      expect(manager.get(project.id)!.name).toBe("Target");
    });

    it("returns undefined for unknown id", () => {
      manager.init();
      expect(manager.get("nonexistent")).toBeUndefined();
    });
  });



  describe("getAll()", () => {
    it("returns all projects including default", () => {
      manager.init();
      manager.create("A", "#1");
      manager.create("B", "#2");
      expect(manager.getAll()).toHaveLength(3);
    });
  });



  describe("update()", () => {
    it("renames a project", () => {
      manager.init();
      const project = manager.create("OldName", "#ff5722");
      manager.update(project.id, "NewName");

      const updated = manager.get(project.id);
      expect(updated!.name).toBe("NewName");
    });

    it("updates color when provided", () => {
      manager.init();
      const project = manager.create("ColorTest", "#111111");
      manager.update(project.id, "ColorTest", "#222222");

      const updated = manager.get(project.id);
      expect(updated!.color).toBe("#222222");
    });

    it("does not change color when not provided", () => {
      manager.init();
      const project = manager.create("KeepColor", "#abcdef");
      manager.update(project.id, "NewNameOnly");

      const updated = manager.get(project.id);
      expect(updated!.color).toBe("#abcdef");
    });

    it("throws for system project", () => {
      manager.init();
      expect(() => manager.update("default", "Renamed")).toThrow(/cannot rename system project/i);
    });

    it("throws for non-existent project", () => {
      manager.init();
      expect(() => manager.update("nonexistent", "Name")).toThrow(/not found/i);
    });

    it("persists rename to disk", () => {
      manager.init();
      const project = manager.create("OldName", "#ff5722");
      manager.update(project.id, "NewName");

      const fresh = new ProjectManager();
      fresh.init();
      const loaded = fresh.get(project.id);
      expect(loaded!.name).toBe("NewName");
    });

    it("sets githubSource on existing project", () => {
      manager.init();
      const project = manager.create("Test", "#111");
      manager.update(project.id, "Test", undefined, undefined, "owner/repo");

      const updated = manager.get(project.id);
      expect(updated!.githubSource).toBe("owner/repo");
    });

    it("clears githubSource when empty string passed", () => {
      manager.init();
      const project = manager.create("Test", "#111", undefined, "owner/repo");
      manager.update(project.id, "Test", undefined, undefined, "");

      const updated = manager.get(project.id);
      expect(updated!.githubSource).toBeUndefined();
    });

    it("does not change githubSource when undefined passed", () => {
      manager.init();
      const project = manager.create("Test", "#111", undefined, "owner/repo");
      manager.update(project.id, "Test");

      const updated = manager.get(project.id);
      expect(updated!.githubSource).toBe("owner/repo");
    });

    it("throws on invalid githubSource in update", () => {
      manager.init();
      const project = manager.create("Test", "#111");
      expect(() => manager.update(project.id, "Test", undefined, undefined, "no-slash")).toThrow(/Invalid githubSource/i);
    });

    it("persists githubSource update to disk", () => {
      manager.init();
      const project = manager.create("Test", "#111");
      manager.update(project.id, "Test", undefined, undefined, "owner/repo");

      const fresh = new ProjectManager();
      fresh.init();
      const found = fresh.get(project.id);
      expect(found!.githubSource).toBe("owner/repo");
    });
  });



  describe("delete()", () => {
    it("removes a project", () => {
      manager.init();
      const project = manager.create("ToDelete", "#4caf50");
      manager.delete(project.id);
      expect(manager.get(project.id)).toBeUndefined();
    });

    it("throws for system project", () => {
      manager.init();
      expect(() => manager.delete("default")).toThrow(/cannot delete system project/i);
    });

    it("throws for non-existent project", () => {
      manager.init();
      expect(() => manager.delete("nonexistent")).toThrow(/not found/i);
    });

    it("persists deletion to disk", () => {
      manager.init();
      const project = manager.create("Temp", "#4caf50");
      manager.delete(project.id);

      const fresh = new ProjectManager();
      fresh.init();
      expect(fresh.get(project.id)).toBeUndefined();
    });
  });



  describe("reload()", () => {
    it("replaces all projects and ensures default exists", () => {
      manager.init();
      manager.create("Old", "#111");

      manager.reload([
        {
          id: "custom1",
          name: "Custom",
          color: "#abc",
          createdAt: new Date().toISOString(),
          isSystem: false,
          isDefault: false,
        },
      ]);

      const all = manager.getAll();
      // Should have default + custom1
      expect(all.length).toBeGreaterThanOrEqual(2);
      expect(manager.get("default")).toBeDefined();
      expect(manager.get("custom1")).toBeDefined();
      expect(manager.get("Old")).toBeUndefined();
    });

    it("adds default when reloaded set does not include one", () => {
      manager.init();

      manager.reload([
        {
          id: "x1",
          name: "X",
          color: "#000",
          createdAt: new Date().toISOString(),
          isSystem: false,
          isDefault: false,
        },
      ]);

      expect(manager.get("default")).toBeDefined();
      expect(manager.get("x1")).toBeDefined();
    });

    it("does not add extra default when one already exists in reloaded set", () => {
      manager.init();

      manager.reload([
        {
          id: "default",
          name: "Default",
          color: "#ffffff",
          createdAt: new Date().toISOString(),
          isSystem: true,
          isDefault: true,
        },
      ]);

      const defaults = manager.getAll().filter((p) => p.id === "default");
      expect(defaults).toHaveLength(1);
    });
  });



  describe("migration from old dir format", () => {
    it("migrates individual project JSON files to projects.json", () => {
      const dataDir = join(tmpDir, ".loop-cli");
      const oldDir = join(dataDir, "projects");
      mkdirSync(oldDir, { recursive: true });

      const project1 = {
        id: "proj1",
        name: "OldProject1",
        color: "#111111",
        createdAt: "2024-01-01T00:00:00.000Z",
        isSystem: false,
        isDefault: false,
      };
      writeFileSync(join(oldDir, "proj1.json"), JSON.stringify(project1));

      const mgr = new ProjectManager();
      mgr.init();

      const found = mgr.get("proj1");
      expect(found).toBeDefined();
      expect(found!.name).toBe("OldProject1");
    });

    it("handles corrupted migration files gracefully", () => {
      const dataDir = join(tmpDir, ".loop-cli");
      const oldDir = join(dataDir, "projects");
      mkdirSync(oldDir, { recursive: true });

      writeFileSync(join(oldDir, "good.json"), JSON.stringify({
        id: "good",
        name: "Good",
        color: "#000",
        createdAt: new Date().toISOString(),
        isSystem: false,
        isDefault: false,
      }));
      writeFileSync(join(oldDir, "bad.json"), "not json {{{");

      const mgr = new ProjectManager();
      mgr.init();

      expect(mgr.get("good")).toBeDefined();
      // Should still create default
      expect(mgr.get("default")).toBeDefined();
    });
  });
});
