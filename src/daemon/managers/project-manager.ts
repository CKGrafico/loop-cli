import type { Project } from "../../types.js";
import fs from "node:fs";
import { writeFileAtomic } from "../../shared/fs-utils.js";
import { daemonLog } from "../daemon-log.js";
import crypto from "node:crypto";
import { getDataDir, projectsJson } from "../../shared/config/paths.js";
import path from "node:path";

type SelfWriteNotifier = (filePath: string, content: string) => void;
let selfWriteNotifier: SelfWriteNotifier | null = null;

export function setProjectSelfWriteNotifier(notifier: SelfWriteNotifier | null): void {
  selfWriteNotifier = notifier;
}

type DirectoryChangeCallback = (projectId: string, oldDirectory: string, newDirectory: string) => void;

const GITHUB_SOURCE_REGEX = /^[a-zA-Z0-9_.\-]+\/[a-zA-Z0-9_.\-]+$/;

function validateGithubSource(githubSource: string): void {
  if (!GITHUB_SOURCE_REGEX.test(githubSource)) {
    throw new Error(`Invalid githubSource format: "${githubSource}". Expected owner/repo (e.g. PlainConceptsPlatform/loop-task)`);
  }
}

export class ProjectManager {
  private projects: Map<string, Project> = new Map();
  private onDirectoryChange: DirectoryChangeCallback | null = null;

  setOnDirectoryChange(callback: DirectoryChangeCallback): void {
    this.onDirectoryChange = callback;
  }

  init(): void {
    const dataDir = getDataDir();
    fs.mkdirSync(dataDir, { recursive: true });
    this.migrateProjectsToJson();
    this.loadProjects();
    if (!this.projects.has("default")) {
      this.createDefaultProject();
    }
  }

  private migrateProjectsToJson(): void {
    const jsonFile = projectsJson();
    if (fs.existsSync(jsonFile)) return;
    const oldDir = path.join(getDataDir(), "projects");
    if (!fs.existsSync(oldDir)) return;
    try {
      const files = fs.readdirSync(oldDir).filter((f) => f.endsWith(".json"));
      if (files.length === 0) return;
      const projects: Project[] = [];
      for (const file of files) {
        try {
          const raw = fs.readFileSync(path.join(oldDir, file), "utf-8");
          const content = JSON.parse(raw) as Project;
          if (content.id) projects.push(content);
        } catch {
          // skip corrupted files
        }
      }
      writeFileAtomic(jsonFile, JSON.stringify(projects, null, 2));
      daemonLog(`migrated ${projects.length} project(s) to projects.json`);
    } catch (err) {
      daemonLog(`Failed to migrate projects: ${err}`);
    }
  }

  private loadProjects(): void {
    this.projects.clear();
    const jsonFile = projectsJson();
    if (!fs.existsSync(jsonFile)) return;
    try {
      const raw = fs.readFileSync(jsonFile, "utf-8");
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      for (const item of parsed) {
        if (item && item.id) this.projects.set(item.id, item as Project);
      }
    } catch (err) {
      daemonLog(`Failed to load projects.json: ${err}`);
    }
  }

  private saveAllProjects(): void {
    const all = Array.from(this.projects.values());
    const content = JSON.stringify(all, null, 2);
    writeFileAtomic(projectsJson(), content);
    if (selfWriteNotifier) selfWriteNotifier(projectsJson(), content);
  }

  private saveProject(project: Project): void {
    this.projects.set(project.id, project);
    this.saveAllProjects();
  }

  private createDefaultProject(): void {
    const defaultProject: Project = {
      id: "default",
      name: "Default",
      color: "#ffffff",
      directory: "",
      createdAt: new Date().toISOString(),
      isSystem: true,
      isDefault: true,
    };
    this.saveProject(defaultProject);
  }

  getAll(): Project[] {
    return Array.from(this.projects.values());
  }

  get(id: string): Project | undefined {
    return this.projects.get(id);
  }

  create(name: string, color: string, directory?: string, githubSource?: string): Project {
    if (githubSource !== undefined && githubSource !== "") validateGithubSource(githubSource);
    const id = crypto.randomBytes(4).toString("hex");
    const project: Project = {
      id,
      name,
      color,
      directory: directory ?? "",
      githubSource: githubSource || undefined,
      createdAt: new Date().toISOString(),
      isSystem: false,
      isDefault: false,
    };
    this.saveProject(project);
    return project;
  }

  update(id: string, name: string, color?: string, directory?: string, githubSource?: string): void {
    const project = this.projects.get(id);
    if (!project) throw new Error(`Project ${id} not found`);
    if (project.isSystem) throw new Error("Cannot rename system project");

    const oldDirectory = project.directory ?? "";
    project.name = name;
    if (color) project.color = color;
    if (directory !== undefined) project.directory = directory;
    if (githubSource !== undefined) {
      if (githubSource !== "") validateGithubSource(githubSource);
      project.githubSource = githubSource || undefined;
    }
    this.saveProject(project);

    if (directory !== undefined && directory !== oldDirectory) {
      this.onDirectoryChange?.(id, oldDirectory, directory);
    }
  }

  delete(id: string): void {
    const project = this.projects.get(id);
    if (!project) throw new Error(`Project ${id} not found`);
    if (project.isSystem) throw new Error("Cannot delete system project");
    this.projects.delete(id);
    this.saveAllProjects();
  }

  reload(newProjects: Project[]): void {
    this.projects.clear();
    for (const project of newProjects) {
      this.projects.set(project.id, project);
    }
    if (!this.projects.has("default")) {
      this.createDefaultProject();
    }
    daemonLog(`reloaded ${newProjects.length} project(s) from external change`);
  }
}
