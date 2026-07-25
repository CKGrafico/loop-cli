import React from "react";
import { Box, Text, useStdout } from "ink";
import type { LoopMeta, Project } from "../../types.js";
import { darkTheme as theme, statusColor } from "../../shared/ui/theme.js";
import { describeLoop, commandLine, timeAgo, timeUntil, truncate } from "../../shared/ui/format.js";
import { t } from "../../shared/i18n/index.js";
import type { Breakpoint } from "../../shared/hooks/useBreakpoint.js";

function labelWidth(bp: Breakpoint): number {
  return bp === "wide" ? 11 : 8;
}

function dividerLen(bp: Breakpoint, termWidth: number): number {
  if (bp === "wide") return 40;
  if (bp === "compact") return Math.min(30, termWidth - 6);
  return Math.min(20, termWidth - 4);
}

function Field(props: { label: string; lw: number; children: React.ReactNode }): React.ReactNode {
  return (
    <Box overflow="hidden">
      <Text bold color={theme.text.muted}>{props.label.padEnd(props.lw)}</Text>
      <Text color={theme.text.primary} wrap="truncate">{props.children}</Text>
    </Box>
  );
}

function MutedField(props: { label: string; lw: number; children: React.ReactNode }): React.ReactNode {
  return (
    <Box overflow="hidden">
      <Text bold color={theme.text.muted}>{props.label.padEnd(props.lw)}</Text>
      <Text color={theme.text.muted} wrap="truncate">{props.children}</Text>
    </Box>
  );
}

export function Inspector(props: { loop: LoopMeta | null; projects?: Project[]; breakpoint?: Breakpoint }): React.ReactNode {
  const { loop, breakpoint = "wide" } = props;
  const { stdout } = useStdout();
  const termWidth = stdout?.columns ?? 80;
  const lw = labelWidth(breakpoint);
  const divLen = dividerLen(breakpoint, termWidth);
  const DIVIDER = "\u2500".repeat(divLen);
  const truncLen = breakpoint === "wide" ? 38 : breakpoint === "compact" ? 25 : 15;

  if (!loop) {
    return (
      <Box flexDirection="column" paddingY={0}>
        <Box paddingLeft={1}>
          <Text color={theme.text.muted}>{t("board.inspectorTitle")}</Text>
        </Box>
        <Box paddingLeft={1}>
          <Text color={theme.text.muted}>{DIVIDER}</Text>
        </Box>
        <Box paddingLeft={1}>
          <Text color={theme.text.muted}>{t("board.inspectorEmpty")}</Text>
        </Box>
      </Box>
    );
  }

  const sColor = statusColor(loop.status);
  const maxRunsLabel = loop.maxRuns ? String(loop.maxRuns) : t("board.unlimited");
  const lastRun = loop.lastRunAt ? timeAgo(loop.lastRunAt) : t("format.dash");
  const lastExit = loop.lastExitCode !== null ? String(loop.lastExitCode) : t("format.dash");
  const nextRun = loop.nextRunAt ? t("format.timingNext", { timeAgo: timeUntil(loop.nextRunAt) }) : t("format.dash");

  const fullCmd = truncate(commandLine(loop.command, loop.commandArgs), truncLen);
  const desc = truncate(describeLoop(loop), truncLen);

  // Fields omitted in compact/minimal to save vertical space
  const showOptional = breakpoint === "wide";

  return (
    <Box flexDirection="column" paddingY={0}>
      <Box paddingLeft={1}>
        <Text color={theme.text.muted}>{t("board.inspectorTitle")}</Text>
      </Box>
      <Box paddingLeft={1}>
        <Text color={theme.text.muted}>{DIVIDER}</Text>
      </Box>
      <Box flexDirection="column" paddingLeft={1}>
        {loop.isRecipe ? (
          <Box>
            <Text bold color={theme.semantic.warning}>{"Recipe".padEnd(lw)}</Text>
            <Text color={theme.semantic.warning}>{loop.recipeFile ?? ""}</Text>
          </Box>
        ) : null}
        <Box>
          <Text bold color={theme.text.muted}>{t("board.fieldStatus").padEnd(lw)}</Text>
          <Text color={sColor}>{loop.status}</Text>
        </Box>
        <Field label={t("board.fieldRuns")} lw={lw}><Text color={theme.text.primary}>{loop.runCount} / {maxRunsLabel}</Text></Field>
        <Field label={t("board.fieldInterval")} lw={lw}><Text color={theme.text.primary}>{loop.intervalHuman}</Text></Field>
        <Field label={t("board.fieldLastExit")} lw={lw}><Text color={theme.text.primary}>{lastExit}</Text></Field>
        {showOptional ? (
          <Field label={t("board.fieldLastRun")} lw={lw}><Text color={theme.text.primary}>{lastRun}</Text></Field>
        ) : null}
        {showOptional ? (
          <Field label={t("board.fieldNextRun")} lw={lw}><Text color={theme.text.primary}>{nextRun}</Text></Field>
        ) : null}
        {(loop.silentChainCount ?? 0) > 0 ? (
          <Field label={t("board.fieldSilentChains")} lw={lw}><Text color={theme.text.muted}>{t("board.silentChainCount", { count: (loop.silentChainCount ?? 0).toLocaleString() })}</Text></Field>
        ) : null}
        <MutedField label={t("board.fieldDesc")} lw={lw}>{desc}</MutedField>
        <MutedField label={t("board.fieldCommand")} lw={lw}>{fullCmd}</MutedField>
      </Box>
      <Box paddingLeft={1}>
        <Text color={theme.text.muted}>{DIVIDER}</Text>
      </Box>
    </Box>
  );
}
