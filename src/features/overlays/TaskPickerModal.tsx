import React, { useState, useMemo, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { darkTheme as theme } from "../../shared/ui/theme.js";
import { t } from "../../shared/i18n/index.js";
import type { TaskDefinition } from "../../types.js";

const MAX_VISIBLE = 10;

export function TaskPickerModal(props: {
  tasks: TaskDefinition[];
  onSelect: (task: TaskDefinition) => void;
  onClose: () => void;
}): React.ReactNode {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return props.tasks;
    return props.tasks.filter(
      (task) =>
        task.name.toLowerCase().includes(q) ||
        task.command.toLowerCase().includes(q),
    );
  }, [props.tasks, query]);

  const clampedCursor = filtered.length > 0 ? cursor % filtered.length : 0;

  const selectAt = useCallback(
    (idx: number) => {
      const task = filtered[idx];
      if (task) props.onSelect(task);
    },
    [filtered, props],
  );

  useInput((input, key) => {
    if (input.includes("[<")) return;
    if (key.escape) {
      props.onClose();
      return;
    }
    if (key.return) {
      selectAt(clampedCursor);
      return;
    }
    if (key.upArrow) {
      setCursor((prev) =>
        prev <= 0 ? Math.max(0, filtered.length - 1) : prev - 1,
      );
      return;
    }
    if (key.downArrow) {
      setCursor((prev) =>
        prev >= filtered.length - 1 ? 0 : prev + 1,
      );
      return;
    }
    if (key.backspace || key.delete) {
      setQuery((prev) => prev.slice(0, -1));
      setCursor(0);
      return;
    }
    if (key.ctrl) return;
    if (input.length === 1 && input >= " " && input <= "~") {
      setQuery((prev) => prev + input);
      setCursor(0);
    }
  });

  const start = Math.max(0, clampedCursor - Math.floor(MAX_VISIBLE / 2));
  const end = Math.min(filtered.length, start + MAX_VISIBLE);
  const visible = filtered.slice(start, end);

  return (
    <Box
      position="absolute"
      top={0}
      left={0}
      width="100%"
      height="100%"
      justifyContent="center"
      alignItems="center"
    >
      <Box
        width={60}
        height={Math.min(20, visible.length + 8)}
        flexDirection="column"
        backgroundColor={theme.bg.elevated}
        borderStyle="round"
        borderColor={theme.accent.task}
        paddingX={1}
        paddingY={0}
      >
        <Box justifyContent="space-between">
          <Text color={theme.accent.task} bold>
            {t("taskPicker.title")}
          </Text>
          <Text color={theme.text.muted}>esc</Text>
        </Box>

        <Box marginTop={0}>
          <Text color={theme.text.muted}>{"\u203a "}</Text>
          <Text color={query ? theme.text.primary : theme.text.muted}>
            {query || t("taskPicker.searchPlaceholder")}
          </Text>
          <Text inverse>{" "}</Text>
        </Box>

        <Box flexDirection="column" marginTop={0}>
          {visible.length === 0 ? (
            <Text color={theme.text.muted}>
              {t("taskPicker.empty")}
            </Text>
          ) : (
            visible.map((task, visIdx) => {
              const realIdx = start + visIdx;
              const isSelected = realIdx === clampedCursor;
              return (
                <Box
                  key={task.id}
                  backgroundColor={isSelected ? theme.bg.active : undefined}
                >
                  <Text color={isSelected ? theme.text.inverse : theme.text.muted}>
                    {isSelected ? "\u276f " : "  "}
                  </Text>
                  <Text color={isSelected ? theme.text.inverse : theme.text.primary}>
                    {task.name}
                  </Text>
                  <Text color={isSelected ? theme.text.inverse : theme.text.muted}>
                    {" " + task.command}
                  </Text>
                </Box>
              );
            })
          )}
        </Box>

        <Box marginTop={1} justifyContent="space-between">
          <Text color={theme.text.muted}>
            {filtered.length}/{props.tasks.length}
          </Text>
          <Text color={theme.text.muted}>
            {t("taskPicker.hint")}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
