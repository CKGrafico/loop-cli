import type { LoopMeta, LoopStatus } from "../../types.js";
import { t } from "../i18n/index.js";

export function unescapeCommand(str: unknown): string {
  if (typeof str !== "string") return String(str ?? "");
  return str
    .replace(/\\\\/g, "\x00")
    .replace(/\\"/g, '"')
    .replace(/\x00/g, "\\");
}

export function quoteArg(arg: unknown): string {
  const s = typeof arg === "string" ? arg : String(arg ?? "");
  return /[\s"]/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s;
}

export function commandLine(command: unknown, args: unknown[]): string {
  const safeArgs = Array.isArray(args) ? args : [];
  return [unescapeCommand(command), ...safeArgs.map((a) => quoteArg(unescapeCommand(a)))].join(" ").trim();
}

export function formatCmd(command: string, args: string[], max = 24): string {
  const full = commandLine(command, args);
  return full.length > max ? full.slice(0, max - 3) + "..." : full;
}

export function describeLoop(loop: LoopMeta): string {
  return loop.description?.trim() || commandLine(loop.command, loop.commandArgs);
}

export function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 3) + "..." : text;
}

export function timeAgo(iso: string | null): string {
  if (!iso) return t("format.dash");
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 5) return t("format.justNow");
  if (secs < 60) return t("format.secsAgo", { secs });
  const mins = Math.floor(secs / 60);
  if (mins < 60) return t("format.minsAgo", { mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t("format.hrsAgo", { hrs });
  return t("format.daysAgo", { days: Math.floor(hrs / 24) });
}

export function timeUntil(iso: string | null): string {
  if (!iso) return t("format.dash");
  const diff = Math.max(0, new Date(iso).getTime() - Date.now());
  const secs = Math.floor(diff / 1000);
  if (secs < 5) return t("format.justNow");
  if (secs < 60) return t("format.secsAhead", { secs });
  const mins = Math.floor(secs / 60);
  if (mins < 60) return t("format.minsAhead", { mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t("format.hrsAhead", { hrs });
  return t("format.daysAhead", { days: Math.floor(hrs / 24) });
}

const STATUS_COLORS: Record<LoopStatus, string> = {
  running: "#4ade80",
  waiting: "#6b7280",
  paused: "#facc15",
  idle: "#fb923c",
  stopped: "#f87171",
};

export function statusColor(status: LoopMeta["status"]): string {
  return STATUS_COLORS[status] ?? "#ffffff";
}

export function timingLabel(loop: LoopMeta): string {
  if (loop.interval === 0) return t("format.durationManual");
  if (loop.status === "paused") return t("format.timingPaused");
  if (loop.status === "idle") return t("format.timingIdle");
  if (loop.nextRunAt) return t("format.timingNext", { timeAgo: timeUntil(loop.nextRunAt) });
  if (loop.lastRunAt) return t("format.timingLast", { timeAgo: timeAgo(loop.lastRunAt) });
  return t("format.timingNew");
}

export function statusLabel(status: LoopMeta["status"]): string {
  return status === "waiting" ? "waiting" : status;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatRunDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m${Math.floor((ms % 60000) / 1000)}s`;
}

export function formatRunTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  return `${date} ${time}`;
}

export function sinceLabel(loop: LoopMeta): string {
  const ts = loop.sessionStartedAt ?? loop.createdAt;
  if (!ts) return t("format.dash");
  return formatDate(ts);
}
