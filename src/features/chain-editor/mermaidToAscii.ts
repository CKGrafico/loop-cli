/**
 * Mermaid-to-ASCII renderer for loop-task recipe diagrams.
 *
 * Supports the exact Mermaid subset produced by the loop-task-diagram skill v3:
 *   flowchart TD
 *       prefixStart("Start<br/>Purpose")
 *       taskId["Name<br/>Purpose"] -->|✓| target
 *       taskId("Name<br/>Purpose") -.->|✗| target
 *       terminalId(("Name<br/>Purpose"))
 *       classDef start fill:#ffffff,stroke:#172033,...
 *       classDef decision fill:#fff8e8,stroke:#c75b00,...
 *       classDef action fill:#eef0ff,stroke:#554cff,...
 *       classDef idle fill:#202c40,stroke:#738198,...
 *       classDef failure fill:#fff0f0,stroke:#ef2929,...
 *       classDef success fill:#e8f8ec,stroke:#18883c,...
 *       class nodeId className
 *
 * Rendering rules:
 *   - Vertical top-down layout (TD = top-down)
 *   - Solid arrows for success (✓), dashed for failure (✗)
 *   - Decision nodes []: square box
 *   - Action nodes (): rounded box
 *   - Terminal nodes (()): double-bordered box, color by class
 *   - Width capped at 80 characters
 */

import type { TaskDefinition } from "../../types.js";

type NodeRole = "start" | "decision" | "action" | "idle" | "failure" | "success" | "none";
type NodeShape = "box" | "round" | "doubleRound";

interface DiagramNode {
  id: string;
  label: string;
  purpose: string;
  shape: NodeShape;
  role: NodeRole;
  successTarget: string | null;
  failureTarget: string | null;
}

/**
 * Parse a Mermaid flowchart string into nodes and edges.
 */
function parseMermaid(mermaid: string): {
  nodes: Map<string, DiagramNode>;
  entryId: string | null;
} {
  const nodes = new Map<string, DiagramNode>();
  const classMap = new Map<string, NodeRole>();
  let entryId: string | null = null;
  let firstNode = true;

  const lines = mermaid.split("\n").map((l) => l.trim()).filter(Boolean);

  // First pass: collect class assignments
  for (const line of lines) {
    if (line.startsWith("class ")) {
      const rest = line.slice(6).trim();
      const parts = rest.split(/\s+/);
      if (parts.length === 2) {
        const role = parts[1] as NodeRole;
        if (["start", "decision", "action", "idle", "failure", "success"].includes(role)) {
          for (const id of parts[0].split(",")) {
            classMap.set(id.trim(), role);
          }
        }
      }
      continue;
    }
  }

  // Second pass: parse nodes and edges
  for (const line of lines) {
    // Skip directives
    if (line.startsWith("flowchart") || line.startsWith("classDef") || line.startsWith("class ")) continue;

    // Edge lines with box source: id["label"] -->|✓| targetId
    const solidBoxEdge = line.match(/^(\w+)\["([^"]*?)"\]\s*-->\|([^|]+)\|\s*(\w+)$/);
    const solidRoundEdge = line.match(/^(\w+)\("([^"]*?)"\)\s*-->\|([^|]+)\|\s*(\w+)$/);
    const solidDoubleEdge = line.match(/^(\w+)\(\("([^"]*?)"\)\)\s*-->\|([^|]+)\|\s*(\w+)$/);
    const dashedBoxEdge = line.match(/^(\w+)\["([^"]*?)"\]\s*-\.\->\|([^|]+)\|\s*(\w+)$/);
    const dashedRoundEdge = line.match(/^(\w+)\("([^"]*?)"\)\s*-\.\->\|([^|]+)\|\s*(\w+)$/);
    const dashedDoubleEdge = line.match(/^(\w+)\(\("([^"]*?)"\)\)\s*-\.\->\|([^|]+)\|\s*(\w+)$/);

    // Simple edge (just IDs)
    const solidSimple = line.match(/^(\w+)\s*-->\|?([^|]*)\|?\s*(\w+)$/);
    const dashedSimple = line.match(/^(\w+)\s*-\.\->\|?([^|]*)\|?\s*(\w+)$/);
    // Also handle bare --> without labels
    const bareSolid = line.match(/^(\w+)\("([^"]*?)"\)\s*-->\s*(\w+)$/);
    const bareSolidBox = line.match(/^(\w+)\["([^"]*?)"\]\s*-->\s*(\w+)$/);

    // Standalone node declarations
    const standaloneBox = line.match(/^(\w+)\["([^"]*?)"\]$/);
    const standaloneRound = line.match(/^(\w+)\("([^"]*?)"\)$/);
    const standaloneDouble = line.match(/^(\w+)\(\("([^"]*?)"\)\)$/);

    if (solidBoxEdge) {
      const [, fromId, labelText, , toId] = solidBoxEdge;
      const { name, purpose } = splitLabel(labelText);
      ensureNode(nodes, fromId, name, purpose, "box", classMap);
      if (firstNode && !entryId) { entryId = fromId; firstNode = false; }
      nodes.get(fromId)!.successTarget = toId;
      ensureNodeById(nodes, toId, classMap);
    } else if (solidRoundEdge) {
      const [, fromId, labelText, , toId] = solidRoundEdge;
      const { name, purpose } = splitLabel(labelText);
      ensureNode(nodes, fromId, name, purpose, "round", classMap);
      if (firstNode && !entryId) { entryId = fromId; firstNode = false; }
      nodes.get(fromId)!.successTarget = toId;
      ensureNodeById(nodes, toId, classMap);
    } else if (dashedBoxEdge) {
      const [, fromId, labelText, , toId] = dashedBoxEdge;
      const { name, purpose } = splitLabel(labelText);
      ensureNode(nodes, fromId, name, purpose, "box", classMap);
      if (firstNode && !entryId) { entryId = fromId; firstNode = false; }
      nodes.get(fromId)!.failureTarget = toId;
      ensureNodeById(nodes, toId, classMap);
    } else if (dashedRoundEdge) {
      const [, fromId, labelText, , toId] = dashedRoundEdge;
      const { name, purpose } = splitLabel(labelText);
      ensureNode(nodes, fromId, name, purpose, "round", classMap);
      if (firstNode && !entryId) { entryId = fromId; firstNode = false; }
      nodes.get(fromId)!.failureTarget = toId;
      ensureNodeById(nodes, toId, classMap);
    } else if (bareSolid) {
      const [, fromId, labelText, toId] = bareSolid;
      const { name, purpose } = splitLabel(labelText);
      ensureNode(nodes, fromId, name, purpose, "round", classMap);
      if (firstNode && !entryId) { entryId = fromId; firstNode = false; }
      nodes.get(fromId)!.successTarget = toId;
      ensureNodeById(nodes, toId, classMap);
    } else if (bareSolidBox) {
      const [, fromId, labelText, toId] = bareSolidBox;
      const { name, purpose } = splitLabel(labelText);
      ensureNode(nodes, fromId, name, purpose, "box", classMap);
      if (firstNode && !entryId) { entryId = fromId; firstNode = false; }
      nodes.get(fromId)!.successTarget = toId;
      ensureNodeById(nodes, toId, classMap);
    } else if (standaloneDouble) {
      const [, id, labelText] = standaloneDouble;
      const { name, purpose } = splitLabel(labelText);
      ensureNode(nodes, id, name, purpose, "doubleRound", classMap);
    } else if (standaloneRound) {
      const [, id, labelText] = standaloneRound;
      const { name, purpose } = splitLabel(labelText);
      ensureNode(nodes, id, name, purpose, "round", classMap);
      if (firstNode && !entryId) { entryId = id; firstNode = false; }
    } else if (standaloneBox) {
      const [, id, labelText] = standaloneBox;
      const { name, purpose } = splitLabel(labelText);
      ensureNode(nodes, id, name, purpose, "box", classMap);
    }
  }

  return { nodes, entryId };
}

function splitLabel(raw: string): { name: string; purpose: string } {
  const label = raw.replace(/<br\/>/g, "\n");
  const idx = label.indexOf("\n");
  if (idx === -1) return { name: label, purpose: "" };
  return { name: label.slice(0, idx), purpose: label.slice(idx + 1) };
}

function ensureNode(
  nodes: Map<string, DiagramNode>,
  id: string,
  name: string,
  purpose: string,
  shape: NodeShape,
  classMap: Map<string, NodeRole>,
): void {
  if (!nodes.has(id)) {
    const role = classMap.get(id) || "none";
    nodes.set(id, {
      id,
      label: name,
      purpose,
      shape,
      role,
      successTarget: null,
      failureTarget: null,
    });
  }
}

function ensureNodeById(
  nodes: Map<string, DiagramNode>,
  targetId: string,
  classMap: Map<string, NodeRole>,
): void {
  if (!nodes.has(targetId)) {
    ensureNode(nodes, targetId, targetId, "", "box", classMap);
  }
}

/**
 * Render a Mermaid flowchart as vertical ASCII art.
 */
export function renderMermaidAsAscii(mermaid: string): string {
  const { nodes, entryId } = parseMermaid(mermaid);
  const lines: string[] = [];
  const visited = new Set<string>();

  function renderNode(id: string, indent: number): void {
    if (visited.has(id)) {
      lines.push(" ".repeat(indent) + `↻ back to ${id}`);
      return;
    }
    visited.add(id);

    const node = nodes.get(id);
    if (!node) return;

    const prefix = " ".repeat(indent);
    const maxContentWidth = 76 - indent;

    // Build content
    const content: string[] = [];
    content.push(node.label);
    if (node.purpose) content.push("  " + node.purpose);

    const truncated = content.map((l) =>
      l.length > maxContentWidth ? l.slice(0, maxContentWidth - 3) + "..." : l,
    );

    const boxWidth = Math.min(80, Math.max(...truncated.map((l) => l.length)) + 4);

    if (node.role === "failure") {
      // Red terminal — bold box
      lines.push(prefix + "┏" + "━".repeat(boxWidth - 2) + "┓");
      for (const line of truncated) {
        const padded = line + " ".repeat(Math.max(0, boxWidth - 4 - line.length));
        lines.push(prefix + "┃ " + padded + " ┃");
      }
      lines.push(prefix + "┗" + "━".repeat(boxWidth - 2) + "┛");
    } else if (node.role === "success") {
      // Green terminal — double border
      lines.push(prefix + "╔" + "═".repeat(boxWidth - 2) + "╗");
      for (const line of truncated) {
        const padded = line + " ".repeat(Math.max(0, boxWidth - 4 - line.length));
        lines.push(prefix + "║ " + padded + " ║");
      }
      lines.push(prefix + "╚" + "═".repeat(boxWidth - 2) + "╝");
    } else if (node.role === "idle") {
      // Idle terminal — dotted border
      lines.push(prefix + "┌" + "┄".repeat(boxWidth - 2) + "┐");
      for (const line of truncated) {
        const padded = line + " ".repeat(Math.max(0, boxWidth - 4 - line.length));
        lines.push(prefix + "┊ " + padded + " ┊");
      }
      lines.push(prefix + "└" + "┄".repeat(boxWidth - 2) + "┘");
    } else if (node.shape === "round" || node.role === "start" || node.role === "action") {
      // Rounded / start / action — round corners
      lines.push(prefix + "╭" + "─".repeat(boxWidth - 2) + "╮");
      for (const line of truncated) {
        const padded = line + " ".repeat(Math.max(0, boxWidth - 4 - line.length));
        lines.push(prefix + "│ " + padded + " │");
      }
      lines.push(prefix + "╰" + "─".repeat(boxWidth - 2) + "╯");
    } else {
      // Decision / default box
      lines.push(prefix + "┌" + "─".repeat(boxWidth - 2) + "┐");
      for (const line of truncated) {
        const padded = line + " ".repeat(Math.max(0, boxWidth - 4 - line.length));
        lines.push(prefix + "│ " + padded + " │");
      }
      lines.push(prefix + "└" + "─".repeat(boxWidth - 2) + "┘");
    }

    // Draw edges
    if (node.successTarget && node.failureTarget) {
      if (node.successTarget === node.failureTarget) {
        lines.push(prefix + "  │");
        lines.push(prefix + "  ├── ✓ ──┐");
        lines.push(prefix + "  └── ✗ ──┘");
        renderNode(node.successTarget, indent + 2);
      } else {
        lines.push(prefix + "  ├──── ✓ ──▶");
        renderNode(node.successTarget, indent + 4);
        lines.push(prefix + "  │");
        lines.push(prefix + "  └──── ✗ ──▶");
        renderNode(node.failureTarget, indent + 4);
      }
    } else if (node.successTarget) {
      lines.push(prefix + "  │");
      lines.push(prefix + "  ✓");
      lines.push(prefix + "  ▼");
      renderNode(node.successTarget, indent);
    } else if (node.failureTarget) {
      lines.push(prefix + "  │");
      lines.push(prefix + "  ✗");
      lines.push(prefix + "  ▼");
      renderNode(node.failureTarget, indent);
    }
  }

  const startId = entryId || nodes.keys().next().value;
  if (startId) {
    renderNode(startId, 0);
  }

  return lines.join("\n");
}

/**
 * Fallback: generate a vertical ASCII diagram directly from task definitions.
 * Used when the recipe has no `diagram:` field.
 */
export function renderTaskChainAscii(
  rootTaskId: string,
  tasks: TaskDefinition[],
): string {
  const taskMap = new Map<string, TaskDefinition>();
  for (const task of tasks) taskMap.set(task.id, task);

  const lines: string[] = [];
  const visited = new Set<string>();

  function renderTaskNode(taskId: string): void {
    if (visited.has(taskId)) {
      lines.push(`  ↻ back to ${taskId}`);
      return;
    }
    visited.add(taskId);

    const task = taskMap.get(taskId);
    if (!task) {
      lines.push(`  ⚠ ${taskId} (missing task)`);
      return;
    }

    const nameLC = (task.name || "").toLowerCase();
    const isTerminal = !task.onSuccessTaskId && !task.onFailureTaskId;
    const isFail = isTerminal && (nameLC.includes("fail") || nameLC.includes("recovery") || nameLC.includes("reset"));
    const isIdle = isTerminal && (task.silentChain || nameLC.includes("idle") || nameLC.includes("nothing"));
    const isSuccess = isTerminal && !isFail && !isIdle;

    const lines_content: string[] = [task.name];
    lines_content.push("  " + [task.command, ...task.commandArgs].join(" ").slice(0, 60));

    const boxWidth = Math.min(80, Math.max(...lines_content.map((l) => l.length)) + 4);

    if (isFail) {
      lines.push("┏" + "━".repeat(boxWidth - 2) + "┓");
      for (const line of lines_content) {
        lines.push("┃ " + line + " ".repeat(Math.max(0, boxWidth - 4 - line.length)) + " ┃");
      }
      lines.push("┗" + "━".repeat(boxWidth - 2) + "┛");
    } else if (isSuccess) {
      lines.push("╔" + "═".repeat(boxWidth - 2) + "╗");
      for (const line of lines_content) {
        lines.push("║ " + line + " ".repeat(Math.max(0, boxWidth - 4 - line.length)) + " ║");
      }
      lines.push("╚" + "═".repeat(boxWidth - 2) + "╝");
    } else if (isIdle) {
      lines.push("┌" + "┄".repeat(boxWidth - 2) + "┐");
      for (const line of lines_content) {
        lines.push("┊ " + line + " ".repeat(Math.max(0, boxWidth - 4 - line.length)) + " ┊");
      }
      lines.push("└" + "┄".repeat(boxWidth - 2) + "┘");
    } else {
      lines.push("┌" + "─".repeat(boxWidth - 2) + "┐");
      for (const line of lines_content) {
        lines.push("│ " + line + " ".repeat(Math.max(0, boxWidth - 4 - line.length)) + " │");
      }
      lines.push("└" + "─".repeat(boxWidth - 2) + "┘");
    }

    if (task.onSuccessTaskId && task.onFailureTaskId) {
      if (task.onSuccessTaskId === task.onFailureTaskId) {
        lines.push("  ├──── ✓ ──┐");
        lines.push("  └──── ✗ ──┘");
        renderTaskNode(task.onSuccessTaskId);
      } else {
        lines.push("  ├──── ✓ ──▶");
        renderTaskNode(task.onSuccessTaskId);
        lines.push("  └──── ✗ ──▶");
        renderTaskNode(task.onFailureTaskId);
      }
    } else if (task.onSuccessTaskId) {
      lines.push("  │  ✓");
      lines.push("  ▼");
      renderTaskNode(task.onSuccessTaskId);
    } else if (task.onFailureTaskId) {
      lines.push("  │  ✗");
      lines.push("  ▼");
      renderTaskNode(task.onFailureTaskId);
    }
  }

  renderTaskNode(rootTaskId);
  return lines.join("\n");
}
