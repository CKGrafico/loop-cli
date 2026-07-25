import React from "react";
import { Box, Text, useInput, useStdout } from "ink";
import { ScrollList } from "ink-scroll-list";
import type { LoopMeta, RunRecord } from "../../types.js";
import { darkTheme as theme } from "../../shared/ui/theme.js";
import { formatRunTime, formatRunDuration, formatFileSize } from "../../shared/ui/format.js";
import { t } from "../../shared/i18n/index.js";
import { useMouseScroll } from "../../shared/hooks/useMouseScroll.js";

function runIcon(run: RunRecord): string {
  if (run.status === "running") return "\u21bb";
  return run.exitCode === 0 ? "\u2713" : "\u2717";
}

function runIconColor(run: RunRecord): string {
  if (run.status === "running") return theme.accent.loop;
  return run.exitCode === 0 ? theme.semantic.success : theme.semantic.danger;
}

const CHAIN_LABEL_MAX = 28;

function truncateChainLabel(label: string): string {
  if (label.length <= CHAIN_LABEL_MAX) return label;
  const ellipsis = "...";
  const keep = CHAIN_LABEL_MAX - ellipsis.length;
  return label.slice(0, keep) + ellipsis;
}

export function groupRunsByCycle(runs: RunRecord[]): RunRecord[] {
  const byRun = new Map<number, RunRecord[]>();
  for (const r of runs) {
    const group = byRun.get(r.runNumber);
    if (group) group.push(r);
    else byRun.set(r.runNumber, [r]);
  }
  const result: RunRecord[] = [];
  for (const group of byRun.values()) {
    if (group.length === 1) {
      result.push(group[0]!);
      continue;
    }
    const first = group[0]!;
    const last = group[group.length - 1]!;
    const anyRunning = group.some((r) => r.status === "running");
    const totalDuration = group.reduce((sum, r) => sum + r.duration, 0);
    const totalLogSize = group.reduce((sum, r) => sum + r.logSize, 0);
    const chainNames = group
      .map((r) => r.chainName)
      .filter((n): n is string => Boolean(n));
    const chainLabel = chainNames.length > 0
      ? truncateChainLabel(`\u2192 ${chainNames.join(" \u2192 ")}`)
      : undefined;
    result.push({
      runNumber: first.runNumber,
      startedAt: first.startedAt,
      exitCode: anyRunning ? -1 : last.exitCode,
      duration: totalDuration,
      logSize: totalLogSize,
      status: anyRunning ? "running" : "completed",
      logOffset: first.logOffset,
      chainGroupId: first.chainGroupId,
      chainName: chainLabel,
    });
  }
  return result;
}

const SPARK_CHARS = ["\u2581", "\u2582", "\u2583", "\u2584", "\u2585", "\u2586", "\u2587", "\u2588"];

function sparkline(durations: number[]): string {
  if (durations.length === 0) return "";
  const max = Math.max(...durations, 1);
  const min = Math.min(...durations, 0);
  const range = max - min || 1;
  return durations.map((d) => {
    const level = Math.round(((d - min) / range) * (SPARK_CHARS.length - 1));
    return SPARK_CHARS[level] ?? SPARK_CHARS[0]!;
  }).join("");
}

function computeTrends(runs: RunRecord[]): {
  sparkline: string;
  avgDuration: number;
  successStreak: number;
  failureStreak: number;
  lastFailureAgo: string | null;
} {
  if (runs.length === 0) {
    return { sparkline: "", avgDuration: 0, successStreak: 0, failureStreak: 0, lastFailureAgo: null };
  }

  const recent = runs.slice(-20);
  const durations = recent.map((r) => r.duration).filter((d) => d > 0);
  const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

  let successStreak = 0;
  let failureStreak = 0;
  for (let i = runs.length - 1; i >= 0; i--) {
    const r = runs[i]!;
    if (r.exitCode === 0 && failureStreak === 0) successStreak++;
    else if (r.exitCode !== 0 && successStreak === 0) failureStreak++;
    else break;
  }

  let lastFailureAgo: string | null = null;
  for (let i = runs.length - 1; i >= 0; i--) {
    if (runs[i]!.exitCode !== 0) {
      const diff = Date.now() - new Date(runs[i]!.startedAt).getTime();
      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor(diff / 60000);
      lastFailureAgo = hours > 0 ? `${hours}h ago` : `${mins}m ago`;
      break;
    }
  }

  return {
    sparkline: sparkline(durations),
    avgDuration: Math.round(avgDuration),
    successStreak,
    failureStreak,
    lastFailureAgo,
  };
}

export function RunHistory(props: {
  loop: LoopMeta | null;
  selectedRunIndex: number;
  onSelectRun: (index: number) => void;
  onOpenRun: (run: RunRecord) => void;
  isFocused: boolean;
  navActive?: boolean;
}): React.ReactNode {
  const { loop, selectedRunIndex, onSelectRun, onOpenRun, isFocused, navActive = true } = props;
  const { stdout } = useStdout();
  const terminalHeight = stdout?.rows ?? 24;
  const LIMIT = Math.max(3, terminalHeight - 22);

  const runs = groupRunsByCycle(loop?.runHistory ?? []);
  const reversed = [...runs].reverse();
  const n = reversed.length;

  useInput(
    (input, key) => {
      if (n === 0) return;
      // Swallow SGR mouse sequences so they don't interfere
      if (input.includes("[<")) {
        return;
      }
      if (key.upArrow || input === "k") {
        const next = selectedRunIndex <= 0 ? n - 1 : selectedRunIndex - 1;
        onSelectRun(next);
        return;
      }
      if (key.downArrow || input === "j") {
        const next = selectedRunIndex >= n - 1 ? 0 : selectedRunIndex + 1;
        onSelectRun(next);
        return;
      }
      if (key.ctrl && key.return) {
        const run = reversed[selectedRunIndex];
        if (run) onOpenRun(run);
        return;
      }
    },
    { isActive: isFocused && navActive },
  );

  useMouseScroll({
    onScrollUp: () => {
      if (n === 0 || !(isFocused && navActive)) return;
      const next = selectedRunIndex <= 0 ? n - 1 : selectedRunIndex - 1;
      onSelectRun(next);
    },
    onScrollDown: () => {
      if (n === 0 || !(isFocused && navActive)) return;
      const next = selectedRunIndex >= n - 1 ? 0 : selectedRunIndex + 1;
      onSelectRun(next);
    },
    isActive: isFocused && navActive,
  });

  const title = isFocused ? t("board.runHistoryTitleHint") : t("board.runHistoryTitle");
  const trends = computeTrends(runs);

  function renderRun(run: RunRecord, isSelected: boolean): React.ReactNode {
    const fg = isSelected ? theme.text.inverse : theme.text.primary;
    const time = formatRunTime(run.startedAt);
    const duration = formatRunDuration(run.duration);
    const size = formatFileSize(run.logSize);
    const icon = runIcon(run);
    const iconColor = runIconColor(run);
    const chain = run.chainName ?? "";
    return (
      <>
        <Text color={fg}>{time.padEnd(10)}</Text>
        <Text color={isSelected ? theme.text.inverse : iconColor}>{icon} </Text>
        <Text color={fg}>{duration.padEnd(10)}</Text>
        <Text color={fg}>{size.padEnd(8)}</Text>
        <Text color={fg}>{chain}</Text>
      </>
    );
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingLeft={1} paddingRight={1} justifyContent="space-between">
        <Text color={theme.text.muted}>{title}</Text>
        {(trends.failureStreak > 0 || trends.lastFailureAgo) ? (
          <Text color={theme.semantic.warning}>
            {trends.failureStreak > 0 ? t("board.runHistoryFailStreak", { count: String(trends.failureStreak) }) : ""}
            {trends.failureStreak > 0 && trends.lastFailureAgo ? " " : ""}
            {trends.lastFailureAgo ? t("board.runHistoryLastFail", { ago: trends.lastFailureAgo }) : ""}
          </Text>
        ) : null}
      </Box>
      {reversed.length === 0 ? (
        <Box paddingLeft={1}>
          <Text color={theme.text.muted}>{t("board.runHistoryEmpty")}</Text>
        </Box>
      ) : (
        <Box flexDirection="column">
          {trends.sparkline ? (
            <Box paddingLeft={1} marginBottom={0}>
              <Text color={theme.text.muted}>Durations: </Text>
              <Text color={theme.accent.loop}>{trends.sparkline}</Text>
              <Text color={theme.text.muted}> avg:{formatRunDuration(trends.avgDuration)} </Text>
              {trends.successStreak > 0 ? (
                <Text color={theme.semantic.success}>streak:{trends.successStreak} ok</Text>
              ) : null}
            </Box>
          ) : null}
          <Box paddingLeft={1}>
            <Text color={theme.text.muted}>{t("board.runHistoryTime").padEnd(10)}</Text>
            <Text color={theme.text.muted}>{"  "}</Text>
            <Text color={theme.text.muted}>{t("board.runHistoryDuration").padEnd(10)}</Text>
            <Text color={theme.text.muted}>{t("board.runHistorySize").padEnd(8)}</Text>
            <Text color={theme.text.muted}>{t("board.runHistoryDesc")}</Text>
          </Box>
          <ScrollList selectedIndex={selectedRunIndex} height={LIMIT}>
            {reversed.map((run, i) => {
              const isSelected = i === selectedRunIndex;
              const indicator = isSelected ? "\u203a " : "  ";
              return (
                <Box
                  key={i}
                  backgroundColor={isSelected ? (isFocused && navActive ? theme.bg.active : isFocused ? theme.bg.hover : undefined) : undefined}
                >
                  <Text color={isSelected ? theme.text.inverse : theme.text.primary}>
                    {indicator}
                  </Text>
                  {renderRun(run, isSelected)}
                </Box>
              );
            })}
          </ScrollList>
        </Box>
      )}
    </Box>
  );
}