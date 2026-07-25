import React, { useState, useMemo, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import type { TaskDefinition } from "../../types.js";
import { darkTheme as theme } from "../../shared/ui/theme.js";
import { useInject } from "../../shared/hooks/useInject.js";
import { TYPES } from "../../shared/services/types.js";
import type { TaskService } from "../../shared/services/types.js";
import { commandLine } from "../../shared/ui/format.js";

interface ChainNode {
  task: TaskDefinition;
  children: ChainNode[];
  branch: "success" | "failure" | null;
  depth: number;
  isLast: boolean;
}

interface ChainTree {
  root: ChainNode;
}

function buildChains(tasks: TaskDefinition[]): ChainTree[] {
  const taskMap = new Map<string, TaskDefinition>();
  for (const task of tasks) {
    taskMap.set(task.id, task);
  }

  const referenced = new Set<string>();
  for (const task of tasks) {
    if (task.onSuccessTaskId) referenced.add(task.onSuccessTaskId);
    if (task.onFailureTaskId) referenced.add(task.onFailureTaskId);
  }

  const roots = tasks.filter((task) => !referenced.has(task.id));
  const visited = new Set<string>();

  function buildNode(task: TaskDefinition, branch: "success" | "failure" | null, depth: number, isLast: boolean): ChainNode {
    if (visited.has(task.id)) {
      return { task, children: [], branch, depth, isLast };
    }
    visited.add(task.id);

    const children: ChainNode[] = [];
    if (task.onSuccessTaskId) {
      const child = taskMap.get(task.onSuccessTaskId);
      if (child) children.push(buildNode(child, "success", depth + 1, false));
    }
    if (task.onFailureTaskId) {
      const child = taskMap.get(task.onFailureTaskId);
      if (child) {
        if (children.length > 0) children[0]!.isLast = true;
        children.push(buildNode(child, "failure", depth + 1, true));
      }
    }
    if (children.length > 0) children[children.length - 1]!.isLast = true;
    if (children.length === 0 && branch !== null) isLast = true;

    return { task, children, branch, depth, isLast };
  }

  return roots.map((root) => ({
    root: buildNode(root, null, 0, true),
  }));
}

function flattenTree(node: ChainNode, result: Array<{ node: ChainNode; prefix: string }> = [], prefix = ""): Array<{ node: ChainNode; prefix: string }> {
  result.push({ node, prefix });
  for (const child of node.children) {
    const childPrefix = prefix + (node.isLast ? "  " : "\u2502 ");
    flattenTree(child, result, childPrefix);
  }
  return result;
}

export function ChainEditor(props: {
  onEditTask?: (task: TaskDefinition) => void;
  onClose: () => void;
}): React.ReactNode {
  const [tasks, setTasks] = useState<TaskDefinition[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const taskService = useInject<TaskService>(TYPES.TaskService);

  useEffect(() => {
    taskService.list().then(setTasks).catch(() => setTasks([]));
  }, [taskService]);

  const trees = useMemo(() => buildChains(tasks), [tasks]);
  const flatNodes = useMemo(() => {
    const all: Array<{ node: ChainNode; prefix: string }> = [];
    for (const tree of trees) {
      flattenTree(tree.root, all);
    }
    return all;
  }, [trees]);

  useInput((_input, key) => {
    if (_input.includes("[<")) return;
    if (key.escape) {
      props.onClose();
      return;
    }
    if (key.upArrow) {
      setSelectedIndex((i) => i <= 0 ? flatNodes.length - 1 : i - 1);
      return;
    }
    if (key.downArrow) {
      setSelectedIndex((i) => i >= flatNodes.length - 1 ? 0 : i + 1);
      return;
    }
    if (key.return) {
      const node = flatNodes[selectedIndex];
      if (node && props.onEditTask) {
        props.onEditTask(node.node.task);
      }
      return;
    }
  });

  if (flatNodes.length === 0) {
    return (
      <Box borderStyle="single" borderColor={theme.accent.task} flexDirection="column" paddingX={2} paddingY={1}>
        <Text color={theme.accent.task} bold>Chain Editor</Text>
        <Text color={theme.text.muted}>No tasks found. Create tasks first to build chains.</Text>
        <Text color={theme.text.muted}>Press Esc to go back.</Text>
      </Box>
    );
  }

  return (
    <Box borderStyle="single" borderColor={theme.accent.task} flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Text color={theme.accent.task} bold>Chain Editor</Text>
        <Text color={theme.text.muted}> - up/down: navigate, enter: edit task, esc: back</Text>
      </Box>
      {flatNodes.map((item, i) => {
        const isSelected = i === selectedIndex;
        const bg = isSelected ? theme.bg.active : undefined;
        const fg = isSelected ? theme.text.inverse : theme.text.primary;
        const branchLabel = item.node.branch
          ? item.node.branch === "success"
            ? "[\u2713] "
            : "[\u2717] "
          : "";
        const branchColor = item.node.branch === "success"
          ? theme.semantic.success
          : item.node.branch === "failure"
            ? theme.semantic.danger
            : theme.text.primary;

        return (
          <Box key={`${item.node.task.id}-${i}`} backgroundColor={bg}>
            <Text color={theme.text.muted}>{item.prefix}</Text>
            <Text color={isSelected ? theme.text.inverse : branchColor}>{branchLabel}</Text>
            <Text color={fg}>{item.node.task.name}</Text>
            <Text color={isSelected ? theme.text.inverse : theme.text.muted}> - {commandLine(item.node.task.command, item.node.task.commandArgs).slice(0, 40)}</Text>
          </Box>
        );
      })}
      <Box marginTop={1}>
        <Text color={theme.text.muted}>
          {trees.length} root(s) | {tasks.length} total tasks | {flatNodes.length} nodes
        </Text>
      </Box>
    </Box>
  );
}
