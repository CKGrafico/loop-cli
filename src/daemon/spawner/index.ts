import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  readDaemonPid,
  isDaemonAlive,
  removeDaemonPid,
  removeDaemonSignature,
  readDaemonSignature,
  computeCodeSignature,
  getSocketPath,
  getDaemonStartLockFile,
} from "../state/index.js";
import { t } from "../../shared/i18n/index.js";
import { DAEMON_POLL_MS, DAEMON_SPAWN_TIMEOUT_MS } from "../../shared/config/constants.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let cachedSignature: string | null = null;
const START_LOCK_TIMEOUT_MS = 5000;

function currentCodeSignature(): string {
  if (cachedSignature === null) {
    cachedSignature = computeCodeSignature();
  }
  return cachedSignature;
}

function blockingWait(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function acquireStartLock(): number {
  const lockPath = getDaemonStartLockFile();
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  const deadline = Date.now() + START_LOCK_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const fd = fs.openSync(lockPath, "wx");
      fs.writeFileSync(fd, String(process.pid));
      return fd;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }

      let ownerPid: number | null = null;
      try {
        const raw = fs.readFileSync(lockPath, "utf-8").trim();
        const parsed = Number.parseInt(raw, 10);
        ownerPid = Number.isNaN(parsed) ? null : parsed;
      } catch {
        // The lock may be between creation and its owner PID write.
      }

      if (ownerPid !== null && !isDaemonAlive(ownerPid)) {
        try {
          fs.unlinkSync(lockPath);
        } catch {
          // Another waiter may have removed or replaced the stale lock.
        }
      } else {
        blockingWait(DAEMON_POLL_MS);
      }
    }
  }

  throw new Error("Timed out waiting for another process to start the daemon");
}

function releaseStartLock(fd: number): void {
  fs.closeSync(fd);
  try {
    const lockPath = getDaemonStartLockFile();
    if (fs.readFileSync(lockPath, "utf-8").trim() === String(process.pid)) {
      fs.unlinkSync(lockPath);
    }
  } catch {
    // The lock may already have been cleaned up after an interrupted start.
  }
}

/**
 * Find PIDs of all running loop-task daemon processes, excluding the current
 * process and optionally a tracked PID.
 */
function findOrphanedDaemonPids(excludePid?: number): number[] {
  const pids: number[] = [];
  try {
    const platform = process.platform;
    let output: string;
    if (platform === "win32") {
      // Use Get-CimInstance instead of wmic (removed in Windows 11 24H2).
      // Output format: one line per process: "CommandLine <tab> ProcessId"
      output = execSync(
        `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name='node.exe'\\" | Select-Object CommandLine,ProcessId | Format-Table -HideTableHeaders"`,
        { encoding: "utf-8", timeout: 5000 },
      );
      for (const line of output.split("\n")) {
        if (line.includes("daemon/index.js") || line.includes("daemon/index.ts")) {
          const pid = parseInt(line.trim().split(/\s+/).pop() ?? "", 10);
          if (!Number.isNaN(pid) && pid !== process.pid && pid !== excludePid) {
            pids.push(pid);
          }
        }
      }
    } else {
      output = execSync("pgrep -f 'daemon/index'", {
        encoding: "utf-8",
        timeout: 3000,
      });
      for (const line of output.split("\n")) {
        const pid = parseInt(line.trim(), 10);
        if (!Number.isNaN(pid) && pid !== process.pid && pid !== excludePid) {
          pids.push(pid);
        }
      }
    }
  } catch {
    // pgrep not available or no matches
  }
  return pids;
}

export function stopDaemon(pid: number): void {
  killDaemonPid(pid);
  killOrphanedDaemons(pid);
  removeDaemonPid();
  removeDaemonSignature();
}

function killDaemonPid(pid: number): void {
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    // already gone
  }

  const deadline = Date.now() + DAEMON_SPAWN_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (!isDaemonAlive(pid)) {
      break;
    }
    blockingWait(DAEMON_POLL_MS);
  }

  if (isDaemonAlive(pid)) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // best effort
    }
  }
}

function killOrphanedDaemons(excludePid?: number): void {
  const orphans = findOrphanedDaemonPids(excludePid);
  for (const orphanPid of orphans) {
    try {
      process.kill(orphanPid, "SIGTERM");
    } catch {
      // already gone
    }
  }
  blockingWait(1000);
  for (const pid of findOrphanedDaemonPids(excludePid)) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // best effort
    }
  }
}

export function ensureDaemon(): void {
  const lockFd = acquireStartLock();
  try {
    const currentSignature = currentCodeSignature();
    const pid = readDaemonPid();

    if (pid !== null && isDaemonAlive(pid)) {
      if (readDaemonSignature() === currentSignature) {
        return;
      }
      stopDaemon(pid);
    } else if (pid !== null) {
      removeDaemonPid();
      removeDaemonSignature();
    }

    const daemonScript = path.resolve(
      __dirname,
      __filename.endsWith(".ts") ? "../index.ts" : "../index.js"
    );
    const args = __filename.endsWith(".ts")
      ? process.execPath.includes("bun")
        ? [daemonScript]
        : ["--import", "tsx", daemonScript]
      : [daemonScript];
    const child = spawn(process.execPath, args, {
      detached: true,
      stdio: "ignore",
    });

    child.unref();

    const deadline = Date.now() + DAEMON_SPAWN_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const newPid = readDaemonPid();
      if (
        newPid !== null &&
        isDaemonAlive(newPid) &&
        readDaemonSignature() === currentSignature
      ) {
        return;
      }
      blockingWait(DAEMON_POLL_MS);
    }

    throw new Error(t("errors.daemonFailedToStart"));
  } finally {
    releaseStartLock(lockFd);
  }
}

export function getSocket(): string {
  return getSocketPath();
}
