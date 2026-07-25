import React, { useState, useMemo } from "react";
import { Box, Text, useInput } from "ink";
import { darkTheme as theme } from "../../shared/ui/theme.js";
import { t } from "../../shared/i18n/index.js";
import { buildTabCommands } from "../../features/commands/commands.js";
import type { Command, CommandCategory, CommandContext } from "../../app/types.js";
import { useMouseScroll } from "../../shared/hooks/useMouseScroll.js";

const CATEGORY_ORDER: CommandCategory[] = ["global", "filters", "loop", "task", "project"];

function categoryLabel(cat: CommandCategory): string {
  switch (cat) {
    case "global": return t("cmdsBrowser.groupGlobal");
    case "filters": return t("cmdsBrowser.groupFilters");
    case "loop": return t("cmdsBrowser.groupLoop");
    case "task": return t("cmdsBrowser.groupTask");
    case "project": return t("cmdsBrowser.groupProject");
  }
}

interface FlatItem {
  command: Command;
  isHeader: boolean;
  category: CommandCategory;
}

const MAX_VISIBLE = 16;

export function CommandsBrowserModal(props: {
  context: CommandContext;
  onClose: () => void;
  onExecute: (value: string) => void;
}): React.ReactNode {
  const allCommands = useMemo(() => buildTabCommands(props.context), [props.context]);

  const flatItems: FlatItem[] = useMemo(() => {
    const items: FlatItem[] = [];
    for (const cat of CATEGORY_ORDER) {
      const cmds = allCommands.filter((c) => c.category === cat).sort((a, b) => a.label.localeCompare(b.label));
      if (cmds.length === 0) continue;
      items.push({ command: { label: categoryLabel(cat), value: `__header_${cat}`, hint: "", tier: "global", category: cat }, isHeader: true, category: cat });
      for (const cmd of cmds) {
        items.push({ command: cmd, isHeader: false, category: cat });
      }
    }
    return items;
  }, [allCommands]);

  const selectableIndices = useMemo(() => {
    return flatItems
      .map((item, i) => ({ item, i }))
      .filter(({ item }) => !item.isHeader)
      .map(({ i }) => i);
  }, [flatItems]);

  const [cursor, setCursor] = useState(0);

  const currentFlatIdx = selectableIndices[cursor] ?? 0;

  useInput((input, key) => {
    if (input.includes("[<")) { return; }
    if (key.escape) { props.onClose(); return; }

    if (key.upArrow) {
      setCursor((prev) => prev <= 0 ? Math.max(0, selectableIndices.length - 1) : prev - 1);
      return;
    }
    if (key.downArrow) {
      setCursor((prev) => prev >= selectableIndices.length - 1 ? 0 : prev + 1);
      return;
    }
    if (key.return) {
      const flatIdx = selectableIndices[cursor];
      if (flatIdx !== undefined) {
        const item = flatItems[flatIdx];
        if (item && !item.isHeader) {
          props.onExecute(item.command.value);
        }
      }
      return;
    }
  });

  useMouseScroll({
    onScrollUp: () => setCursor((prev) => prev <= 0 ? Math.max(0, selectableIndices.length - 1) : prev - 1),
    onScrollDown: () => setCursor((prev) => prev >= selectableIndices.length - 1 ? 0 : prev + 1),
  });

  const windowStart = Math.max(0, currentFlatIdx - Math.floor(MAX_VISIBLE / 2));
  const windowEnd = Math.min(flatItems.length, windowStart + MAX_VISIBLE);
  const visibleItems = flatItems.slice(windowStart, windowEnd);

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
        width={56}
        flexDirection="column"
        backgroundColor={theme.bg.elevated}
        borderStyle="round"
        borderColor={theme.border.dim}
        paddingX={1}
        paddingY={0}
      >
      {/* Header */}
      <Box justifyContent="space-between" paddingY={0}>
        <Text bold color={theme.text.primary}>{t("cmdsBrowser.title")}</Text>
        <Text color={theme.text.muted}>esc</Text>
      </Box>

      {/* Command list */}
      <Box flexDirection="column">
        {visibleItems.map((item, visIdx) => {
          const realIdx = windowStart + visIdx;
          const isSelected = realIdx === currentFlatIdx;

          if (item.isHeader) {
            return (
              <Box
                key={item.command.value}
                marginTop={realIdx === 0 ? 0 : 1}
              >
                <Text color={theme.accent.brand} bold>
                  {item.command.label}
                </Text>
              </Box>
            );
          }

          const shortcut = item.command.shortcut ?? "";

          return (
            <Box
              key={`${item.command.value}-${realIdx}`}
              backgroundColor={isSelected ? theme.bg.active : undefined}
              justifyContent="space-between"
            >
              <Box>
                <Text color={isSelected ? theme.text.inverse : theme.text.primary}>
                  {"  " + item.command.label}
                </Text>
                {item.command.hint.length > 0 ? (
                  <Text color={isSelected ? theme.text.inverse : theme.text.muted}>
                    {"  " + item.command.hint.slice(0, 20)}
                  </Text>
                ) : null}
              </Box>
              {shortcut.length > 0 ? (
                <Text color={isSelected ? theme.text.inverse : theme.text.muted}>
                  {shortcut}
                </Text>
              ) : null}
            </Box>
          );
        })}
      </Box>

      {/* Hint */}
      <Box marginTop={1} justifyContent="center">
        <Text color={theme.text.muted}>{t("cmdsBrowser.hint")}</Text>
      </Box>
      </Box>
    </Box>
  );
}
