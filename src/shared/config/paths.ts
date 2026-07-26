import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

export function getDataDir(): string {
  const override = process.env.LOOP_CLI_HOME;
  const base = override && override.trim() ? override : os.homedir();
  return path.join(base, ".loop-cli");
}

export function getLoopsDir(): string {
  return path.join(getDataDir(), "loops");
}

export function getTasksDir(): string {
  return path.join(getDataDir(), "tasks");
}

export function getLogsDir(): string {
  return path.join(getDataDir(), "logs");
}

export function loopFile(id: string): string {
  return path.join(getLoopsDir(), `${id}.json`);
}

export function taskFile(id: string): string {
  return path.join(getTasksDir(), `${id}.json`);
}

export function loopsJson(): string {
  return path.join(getDataDir(), "loops.json");
}

export function tasksJson(): string {
  return path.join(getDataDir(), "tasks.json");
}

export function recipeRuntimeJson(): string {
  return path.join(getDataDir(), "recipe-runtime.json");
}

export function projectsJson(): string {
  return path.join(getDataDir(), "projects.json");
}

export function settingsJson(): string {
  return path.join(getDataDir(), "settings.json");
}

export function logFile(id: string): string {
  return path.join(getLogsDir(), `${id}.log`);
}

export function getPidFile(): string {
  return path.join(getDataDir(), "daemon.pid");
}

export function getSignatureFile(): string {
  return path.join(getDataDir(), "daemon.sig");
}

export function getDaemonStartLockFile(): string {
  return path.join(getDataDir(), "daemon.start.lock");
}

export function getDaemonLogFile(): string {
  return path.join(getDataDir(), "daemon.log");
}

export function getBoardLogFile(): string {
  return path.join(getDataDir(), "board.log");
}

export function getSocketPath(): string {
  const suffix = crypto
    .createHash("sha1")
    .update(getDataDir())
    .digest("hex")
    .slice(0, 12);

  if (process.platform === "win32") {
    return `\\\\.\\pipe\\loop-cli-${os.userInfo().username}-${suffix}`;
  }
  return path.join(getDataDir(), `daemon-${suffix}.sock`);
}
