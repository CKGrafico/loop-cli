/**
 * Mermaid-to-ASCII renderer for loop-task recipe diagrams.
 *
 * Supports the exact Mermaid subset produced by the loop-task-diagram skill:
 *   flowchart TD
 *       taskId["Name<br/>Purpose"] -->|✓| targetId
 *       taskId -.->|✗| targetId
 *       finalNode(("End"))
 *       style taskId fill:#e1f5fe
 *       class taskId silent
 *       classDef silent stroke-dasharray:5 5,fill:#fef9e7
 *
 * Rendering rules:
 *   - Vertical top-down layout (TD = top-down)
 *   - Solid arrows for success (✓), dashed for failure (✗)
 *   - Boxes with name + purpose on two lines
 *   - Entry task gets an entry marker (▶)
 *   - Silent chain tasks get a dashed border
 *   - Terminal nodes use (( end ))
 *   - Width capped at 80 characters
 */

import type { TaskDefinition } from "../../types.js";

interface DiagramNode {
  id: string;
  label: string;
  purpose: string;
  isEntry: boolean;
  isSilent: boolean;
  isEnd: boolean;
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
  const styles = new Set<string>();
  const silentClasses = new Set<string>();
  let entryId: string | null = null;
  let firstNode = true;

  const lines = mermaid.split("\n").map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    // Skip directives
    if (line.startsWith("flowchart") || line.startsWith("classDef")) continue;

    // Collect style entries (entry indicator)
    if (line.startsWith("style ")) {
      const id = line.split(/\s+/)[1]?.trim();
      if (id) styles.add(id);
      continue;
    }

    // Collect class entries (silent chain)
    if (line.startsWith("class ")) {
      const rest = line.slice(6).trim();
      const parts = rest.split(/\s+/);
      if (parts.length === 2 && parts[1] === "silent") {
        // Could be comma-separated IDs
        for (const id of parts[0].split(",")) {
          silentClasses.add(id.trim());
        }
      }
      continue;
    }

    // Parse edge lines
    const solidMatch = line.match(/^(\S+)\["([^"\\]*(?:\\.[^"\\]*)*)"\]\s*-->\|([^|]+)\|\s*(\S+)$/);
    const solidMatchSimple = line.match(/^(\S+)\s*-->\|([^|]+)\|\s*(\S+)$/);
    const dashedMatch = line.match(/^(\S+)\["([^"\\]*(?:\\.[^"\\]*)*)"\]\s*-\.\->\|([^|]+)\|\s*(\S+)$/);
    const dashedMatchSimple = line.match(/^(\S+)\s*-\.\->\|([^|]+)\|\s*(\S+)$/);

    if (solidMatch) {
      const [, fromId, labelText, edgeLabel, toId] = solidMatch;
      const { name, purpose } = splitLabel(labelText.replace(/<br\/>/g, "\n"));
      ensureNode(nodes, fromId, name, purpose, silentClasses);
      if (firstNode && !entryId) { entryId = fromId; firstNode = false; }
      nodes.get(fromId)!.successTarget = toId;
      // Also ensure target exists
      ensureTargetNode(nodes, toId, silentClasses);
    } else if (dashedMatch) {
      const [, fromId, labelText, edgeLabel, toId] = dashedMatch;
      const { name, purpose } = splitLabel(labelText.replace(/<br\/>/g, "\n"));
      ensureNode(nodes, fromId, name, purpose, silentClasses);
      if (firstNode && !entryId) { entryId = fromId; firstNode = false; }
      nodes.get(fromId)!.failureTarget = toId;
      ensureTargetNode(nodes, toId, silentClasses);
    } else if (solidMatchSimple) {
      const [, fromId, edgeLabel, toId] = solidMatchSimple;
      const existing = nodes.get(fromId);
      if (!existing) {
        ensureNode(nodes, fromId, fromId, "", silentClasses);
        if (firstNode && !entryId) { entryId = fromId; firstNode = false; }
      }
      nodes.get(fromId)!.successTarget = toId;
      ensureTargetNode(nodes, toId, silentClasses);
    } else if (dashedMatchSimple) {
      const [, fromId, edgeLabel, toId] = dashedMatchSimple;
      const existing = nodes.get(fromId);
      if (!existing) {
        ensureNode(nodes, fromId, fromId, "", silentClasses);
        if (firstNode && !entryId) { entryId = fromId; firstNode = false; }
      }
      nodes.get(fromId)!.failureTarget = toId;
      ensureTargetNode(nodes, toId, silentClasses);
    }
  }

  // Mark entry and silent
  for (const [id, node] of nodes) {
    node.isEntry = id === entryId || styles.has(id);
    node.isSilent = silentClasses.has(id);
  }

  return { nodes, entryId };
}

function splitLabel(label: string): { name: string; purpose: string } {
  const idx = label.indexOf("\n");
  if (idx === -1) return { name: label, purpose: "" };
  return { name: label.slice(0, idx), purpose: label.slice(idx + 1) };
}

function ensureNode(
  nodes: Map<string, DiagramNode>,
  id: string,
  name: string,
  purpose: string,
  silentClasses: Set<string>,
): void {
  if (!nodes.has(id)) {
    nodes.set(id, {
      id,
      label: name,
      purpose,
      isEntry: false,
      isSilent: silentClasses.has(id),
      isEnd: false,
      successTarget: null,
      failureTarget: null,
    });
  }
}

function ensureTargetNode(
  nodes: Map<string, DiagramNode>,
  targetRef: string,
  silentClasses: Set<string>,
): void {
  // Target could be taskId["Label"] or just taskId or finalNode(("End"))
  const labelMatch = targetRef.match(/^(\S+)\["([^"\\]*(?:\\.[^"\\]*)*)"\]$/);
  // Match terminal node: id(("End")) — camelCase ID before (( ))
  const endMatch = targetRef.match(/^(\w+)\(\("([^"]+)"\)\)$/);

  if (labelMatch) {
    const [, id, labelText] = labelMatch;
    const { name, purpose } = splitLabel(labelText.replace(/<br\/>/g, "\n"));
    ensureNode(nodes, id, name, purpose, silentClasses);
  } else if (endMatch) {
    // Terminal node like finalNode(("End"))
    const [, id, label] = endMatch;
    if (!nodes.has(id)) {
      nodes.set(id, {
        id,
        label,
        purpose: "",
        isEntry: false,
        isSilent: false,
        isEnd: true,
        successTarget: null,
        failureTarget: null,
      });
    }
  } else {
    // Simple ID reference
    if (!nodes.has(targetRef)) {
      ensureNode(nodes, targetRef, targetRef, "", silentClasses);
    }
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

    if (node.isEnd) {
      lines.push(prefix + `(( ${node.label} ))`);
      return;
    }

    // Build box content
    const content: string[] = [];
    if (node.isEntry) content.push("▶ " + node.label);
    else content.push(node.label);
    if (node.purpose) content.push("  " + node.purpose);

    // Truncate lines to max width
    const truncated = content.map((l) =>
      l.length > maxContentWidth ? l.slice(0, maxContentWidth - 3) + "..." : l,
    );

    const boxWidth = Math.min(80, Math.max(...truncated.map((l) => l.length)) + 4);

    // Draw box
    const border = node.isSilent ? "╌" + "─".repeat(boxWidth - 2) + "╌" : "┌" + "─".repeat(boxWidth - 2) + "┐";
    lines.push(prefix + border);

    for (const line of truncated) {
      const padded = line + " ".repeat(Math.max(0, boxWidth - 4 - line.length));
      if (node.isSilent) {
        lines.push(prefix + "╎ " + padded + " ╎");
      } else {
        lines.push(prefix + "│ " + padded + " │");
      }
    }

    const bottomBorder = node.isSilent ? "╌" + "─".repeat(boxWidth - 2) + "╌" : "└" + "─".repeat(boxWidth - 2) + "┘";
    lines.push(prefix + bottomBorder);

    // Draw edges
    const edgeIndent = indent + 2;

    if (node.successTarget && node.failureTarget) {
      // Both edges: split rendering
      if (node.successTarget === node.failureTarget) {
        // Converges to same target
        lines.push(prefix + "  │");
        lines.push(prefix + "  ├── ✓ ──┐");
        lines.push(prefix + "  └── ✗ ──┘");
        renderNode(node.successTarget, edgeIndent);
      } else {
        // Branching
        lines.push(prefix + "  ├──── ✓ ──▶");
        renderNode(node.successTarget, edgeIndent + 4);
        lines.push(prefix + "  │");
        lines.push(prefix + "  └──── ✗ ──▶");
        renderNode(node.failureTarget, edgeIndent + 4);
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
    // Both null = terminal, nothing more to draw
  }

  // Start from entry node
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

    const silent = task.silentChain ? " (silent)" : "";
    const lines_content: string[] = [task.name + silent];
    lines_content.push("  " + [task.command, ...task.commandArgs].join(" ").slice(0, 60));

    const boxWidth = Math.min(80, Math.max(...lines_content.map((l) => l.length)) + 4);
    lines.push("┌" + "─".repeat(boxWidth - 2) + "┐");
    for (const line of lines_content) {
      lines.push("│ " + line + " ".repeat(Math.max(0, boxWidth - 4 - line.length)) + " │");
    }
    lines.push("└" + "─".repeat(boxWidth - 2) + "┘");

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
    } else {
      lines.push("  (( end ))");
    }
  }

  renderTaskNode(rootTaskId);
  return lines.join("\n");
}
