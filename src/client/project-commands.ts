import type { LoopMeta, Project } from "../types.js";
import { PROJECT_COLORS } from "../shared/config/constants.js";
import { t } from "../shared/i18n/index.js";
import { sendRequest } from "./ipc.js";
import { pad } from "./cli-format.js";

async function fetchProjects(): Promise<Project[]> {
  const response = await sendRequest({ type: "project-list" });
  if (response.type !== "ok") {
    throw new Error((response as { message: string }).message);
  }
  return response.data as Project[];
}

export function resolveColor(input: string): string {
  if (PROJECT_COLORS[input]) return PROJECT_COLORS[input];
  if (/^#[0-9a-fA-F]{6}$/.test(input)) return input;
  throw new Error(
    t("cli.projectInvalidColor", {
      color: input,
      valid: Object.keys(PROJECT_COLORS).join(", "),
    })
  );
}

export async function resolveProjectId(idOrName: string): Promise<string> {
  const projects = await fetchProjects();
  const byId = projects.find((p) => p.id === idOrName);
  if (byId) return byId.id;
  const matches = projects.filter(
    (p) => p.name.toLowerCase() === idOrName.toLowerCase()
  );
  if (matches.length === 1) return matches[0].id;
  if (matches.length === 0) throw new Error(t("cli.projectNotFound", { name: idOrName }));
  throw new Error(t("cli.projectAmbiguous", { name: idOrName }));
}

export async function listProjectsCli(): Promise<void> {
  try {
    const projects = await fetchProjects();

    if (projects.length === 0) {
      console.log(t("cli.noProjects"));
      process.exit(0);
    }

    const loopResponse = await sendRequest({ type: "list" });
    const loops =
      loopResponse.type === "ok" ? (loopResponse.data as LoopMeta[]) : [];
    const counts = new Map<string, number>();
    for (const loop of loops) {
      counts.set(loop.projectId, (counts.get(loop.projectId) ?? 0) + 1);
    }

    const nameW =
      Math.max(t("cli.projectHeaderName").length, ...projects.map((p) => p.name.length)) + 2;
    const idW =
      Math.max(t("cli.projectHeaderId").length, ...projects.map((p) => p.id.length)) + 2;
    const colorW =
      Math.max(t("cli.projectHeaderColor").length, ...projects.map((p) => p.color.length)) + 2;
    const loopsW = t("cli.projectHeaderLoops").length + 2;

    const header =
      pad(t("cli.projectHeaderName"), nameW) +
      pad(t("cli.projectHeaderId"), idW) +
      pad(t("cli.projectHeaderColor"), colorW) +
      pad(t("cli.projectHeaderLoops"), loopsW) +
      t("cli.projectHeaderSystem");

    console.log(header);
    console.log("-".repeat(header.length));

    for (const project of projects) {
      console.log(
        pad(project.name, nameW) +
        pad(project.id, idW) +
        pad(project.color, colorW) +
        pad(String(counts.get(project.id) ?? 0), loopsW) +
        (project.isSystem ? "yes" : "")
      );
    }
    process.exit(0);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(t("cli.error", { message }));
    process.exit(1);
  }
}

export async function createProjectCli(
  name: string,
  colorInput?: string,
  directory?: string,
  githubSource?: string
): Promise<void> {
  try {
    if (githubSource !== undefined && githubSource !== "") {
      if (!/^[a-zA-Z0-9_.\-]+\/[a-zA-Z0-9_.\-]+$/.test(githubSource)) {
        throw new Error(`Invalid github-source format: "${githubSource}". Expected owner/repo (e.g. PlainConceptsPlatform/loop-task)`);
      }
    }
    const color = colorInput ? resolveColor(colorInput) : PROJECT_COLORS.cyan;
    const response = await sendRequest({
      type: "project-create",
      payload: { name, color, directory, githubSource },
    });
    if (response.type !== "ok") {
      throw new Error((response as { message: string }).message);
    }
    const id = (response.data as { id: string }).id;
    console.log(t("cli.projectCreated", { name, id }));
    process.exit(0);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(t("cli.error", { message }));
    process.exit(1);
  }
}

export async function renameProjectCli(
  idOrName: string,
  newName: string
): Promise<void> {
  try {
    const id = await resolveProjectId(idOrName);
    const response = await sendRequest({
      type: "project-update",
      payload: { id, name: newName },
    });
    if (response.type !== "ok") {
      throw new Error((response as { message: string }).message);
    }
    console.log(t("cli.projectRenamed", { name: newName }));
    process.exit(0);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(t("cli.error", { message }));
    process.exit(1);
  }
}

export async function setProjectColorCli(
  idOrName: string,
  colorInput: string
): Promise<void> {
  try {
    const projects = await fetchProjects();
    const byId = projects.find((p) => p.id === idOrName);
    const matches = byId
      ? [byId]
      : projects.filter((p) => p.name.toLowerCase() === idOrName.toLowerCase());
    if (matches.length === 0) throw new Error(t("cli.projectNotFound", { name: idOrName }));
    if (matches.length > 1) throw new Error(t("cli.projectAmbiguous", { name: idOrName }));
    const project = matches[0];
    const color = resolveColor(colorInput);
    const response = await sendRequest({
      type: "project-update",
      payload: { id: project.id, name: project.name, color },
    });
    if (response.type !== "ok") {
      throw new Error((response as { message: string }).message);
    }
    console.log(t("cli.projectColorSet", { name: project.name, color }));
    process.exit(0);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(t("cli.error", { message }));
    process.exit(1);
  }
}

export async function deleteProjectCli(idOrName: string): Promise<void> {
  try {
    const id = await resolveProjectId(idOrName);
    const response = await sendRequest({
      type: "project-delete",
      payload: { id },
    });
    if (response.type !== "ok") {
      throw new Error((response as { message: string }).message);
    }
    console.log(t("cli.projectDeleted", { name: idOrName }));
    process.exit(0);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(t("cli.error", { message }));
    process.exit(1);
  }
}
