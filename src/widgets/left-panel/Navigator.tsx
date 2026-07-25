import React from "react";
import { Box, Text, useInput } from "ink";
import Spinner from "ink-spinner";
import { ScrollList } from "ink-scroll-list";
import type { LoopMeta, Project } from "../../types.js";
import { darkTheme as theme, statusColor } from "../../shared/ui/theme.js";
import { describeLoop, sinceLabel, statusLabel, timingLabel, truncate } from "../../shared/ui/format.js";
import { t } from "../../shared/i18n/index.js";
import { useMouseScroll } from "../../shared/hooks/useMouseScroll.js";
import type { Breakpoint } from "../../shared/hooks/useBreakpoint.js";

const DESC_WIDTH_WIDE = 32;
const DESC_WIDTH_COMPACT = 20;
const DESC_WIDTH_MINIMAL = 14;
const SINCE_WIDTH = 13;
const RUNS_WIDTH = 4;
const STATUS_WIDTH = 8;
const COL_GAP = 1;
const LIMIT = 15;

function descWidth(bp: Breakpoint): number {
  if (bp === "wide") return DESC_WIDTH_WIDE;
  if (bp === "compact") return DESC_WIDTH_COMPACT;
  return DESC_WIDTH_MINIMAL;
}

export function Navigator(props: {
  visible: LoopMeta[];
  total: number;
  selectedIndex: number;
  breakpoint?: Breakpoint;
  projects: Project[];
  onSelect: (index: number) => void;
  onActivate: (index: number) => void;
  isFocused: boolean;
  navActive?: boolean;
}): React.ReactNode {
  const { visible, total, selectedIndex, projects, onSelect, onActivate, isFocused, navActive = true, breakpoint = "wide" } = props;

  const n = visible.length;
  const dw = descWidth(breakpoint);
  const showSince = breakpoint === "wide";
  const showTiming = breakpoint !== "minimal";

  useInput(
    (input, key) => {
      if (n === 0) return;
      // Swallow SGR mouse sequences so they don't interfere
      if (input.includes("[<")) {
        return;
      }
      if (key.upArrow || input === "k") {
        const next = selectedIndex <= 0 ? n - 1 : selectedIndex - 1;
        onSelect(next);
        return;
      }
      if (key.downArrow || input === "j") {
        const next = selectedIndex >= n - 1 ? 0 : selectedIndex + 1;
        onSelect(next);
        return;
      }
      if (key.ctrl && key.return) {
        onActivate(selectedIndex);
        return;
      }
    },
    { isActive: isFocused && navActive },
  );

  useMouseScroll({
    onScrollUp: () => {
      if (n === 0 || !(isFocused && navActive)) return;
      const next = selectedIndex <= 0 ? n - 1 : selectedIndex - 1;
      onSelect(next);
    },
    onScrollDown: () => {
      if (n === 0 || !(isFocused && navActive)) return;
      const next = selectedIndex >= n - 1 ? 0 : selectedIndex + 1;
      onSelect(next);
    },
    isActive: isFocused && navActive,
  });

  const title = t("board.navigatorCount", {
    visible: String(visible.length),
    total: String(total),
  });

  function projectColor(loop: LoopMeta): string {
    const proj = projects.find((p) => p.id === loop.projectId);
    return proj?.color ?? theme.text.muted;
  }

  function projectName(loop: LoopMeta): string {
    const proj = projects.find((p) => p.id === loop.projectId);
    return proj?.name ?? "Default";
  }

  function isFailed(loop: LoopMeta): boolean {
    return loop.lastExitCode !== null && loop.lastExitCode !== 0;
  }

  function renderLoop(loop: LoopMeta, isSelected: boolean): React.ReactNode {
    const rawDesc = describeLoop(loop);
    const prefix = breakpoint === "minimal" ? "" : `${projectName(loop)}: `;
    const desc = truncate(`${prefix}${rawDesc}`, dw);
    const since = sinceLabel(loop);
    const timing = timingLabel(loop);
    const failed = isFailed(loop);
    const sColor = failed ? theme.semantic.danger : statusColor(loop.status);
    const sLabel = statusLabel(loop.status);
    const recipeBadge = loop.isRecipe ? "R " : "";
    const statusText = `${recipeBadge}${sLabel}`;
    const fg = isSelected ? theme.text.inverse : theme.text.primary;
    const dotChar = failed ? "\u2717 " : "\u25cf ";
    const dotColor = failed
      ? theme.semantic.danger
      : isSelected
        ? theme.text.inverse
        : projectColor(loop);
    return (
      <>
        <Text color={dotColor}>{dotChar}</Text>
        <Text color={fg}>{desc.padEnd(dw + COL_GAP)}</Text>
        {showSince ? <Text color={fg}>{since.padEnd(SINCE_WIDTH + COL_GAP)}</Text> : null}
        <Text color={fg}>{String(loop.runCount).padStart(RUNS_WIDTH) + " ".repeat(COL_GAP)}</Text>
        <Text color={isSelected ? theme.text.inverse : sColor}>{statusText.padEnd(STATUS_WIDTH + 1 + COL_GAP)}</Text>
        {showTiming ? <Text color={fg}>{timing}</Text> : null}
        {loop.status === "running" ? (
          <Text color={theme.semantic.success}>{" "}<Spinner type="dots" /></Text>
        ) : null}
      </>
    );
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingLeft={1}>
        <Text color={theme.text.muted}>{title}</Text>
      </Box>
      {visible.length === 0 ? (
        <Box paddingLeft={1}>
          <Text color={theme.text.muted}>{t("board.noMatch")}</Text>
        </Box>
      ) : (
        <Box flexDirection="column">
          <Box paddingLeft={1}>
            <Text color={theme.text.muted}>{"  "}</Text>
            <Text color={theme.text.muted}>{"  "}</Text>
            <Text color={theme.text.muted}>{t("board.headerDescription").padEnd(dw + COL_GAP)}</Text>
            {showSince ? <Text color={theme.text.muted}>{t("board.headerSince").padEnd(SINCE_WIDTH + COL_GAP)}</Text> : null}
            <Text color={theme.text.muted}>{t("board.headerRuns").padStart(RUNS_WIDTH) + " ".repeat(COL_GAP)}</Text>
            <Text color={theme.text.muted}>{t("board.headerStatus").padEnd(STATUS_WIDTH + COL_GAP)}</Text>
            {showTiming ? <Text color={theme.text.muted}>{t("board.headerTiming")}</Text> : null}
          </Box>
          <Box paddingLeft={1}>
            <ScrollList selectedIndex={selectedIndex} height={LIMIT}>
              {visible.map((loop, i) => {
                const isSelected = i === selectedIndex;
                const indicator = isSelected ? "\u203a " : "  ";
                return (
                  <Box
                    key={i}
                    backgroundColor={isSelected ? (isFocused && navActive ? theme.bg.active : isFocused ? theme.bg.hover : undefined) : undefined}
                  >
                    <Text color={isSelected ? theme.text.inverse : theme.text.primary}>
                      {indicator}
                    </Text>
                    {renderLoop(loop, isSelected)}
                  </Box>
                );
              })}
            </ScrollList>
          </Box>
        </Box>
      )}
    </Box>
  );
}
