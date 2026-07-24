import React, { useEffect, useRef, useState } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import type { RunRecord } from "../../types.js";
import { darkTheme as theme } from "../../shared/ui/theme.js";
import { t } from "../../shared/i18n/index.js";
import { useInject } from "../../shared/hooks/useInject.js";
import { TYPES } from "../../shared/services/types.js";
import type { LogService } from "../../shared/services/types.js";
import { formatDate } from "../../shared/ui/format.js";
import { copyToClipboard } from "../../shared/clipboard.js";
import { LOG_MODAL_LINES_MAX } from "../../shared/config/constants.js";
import { appendClamped, clampLines } from "../../shared/utils/log-lines.js";

function colorForLine(line: string, run: RunRecord): string {
  if (line.includes("[Run #")) return theme.accent.loop;
  if (line.startsWith("$ ")) return "#f0abfc";
  if (line.startsWith("  cwd:")) return theme.text.muted;
  if (line.includes("--- Chain:")) return theme.accent.task;
  if (line.trimStart().startsWith("[exit")) {
    const match = /\[exit\s+(\d+)/.exec(line);
    const code = match ? Number(match[1]) : run.exitCode;
    return code === 0 ? theme.semantic.success : theme.semantic.danger;
  }
  return theme.text.primary;
}

const MAX_VALUE_LENGTH = 60;

function expandJsonLine(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;

  const lines: string[] = ["context: {"];
  for (const key of Object.keys(parsed)) {
    const value = (parsed as Record<string, unknown>)[key];
    let display: string;
    if (typeof value === "string") {
      display = value.length > MAX_VALUE_LENGTH
        ? `"${value.slice(0, MAX_VALUE_LENGTH)}..."`
        : `"${value}"`;
    } else if (typeof value === "number" || typeof value === "boolean") {
      display = String(value);
    } else if (value === null) {
      display = "null";
    } else {
      display = JSON.stringify(value);
    }
    lines.push(`  ${key}: ${display}`);
  }
  lines.push("}");
  return lines;
}

export function LogModal(props: {
  loopId: string | null;
  run: RunRecord;
  logLines: string[];
  loading: boolean;
  onClose: () => void;
  onCopy?: () => void;
}): React.ReactNode {
  const [lines, setLines] = useState<string[]>(() => clampLines(props.logLines, LOG_MODAL_LINES_MAX));
  const [streaming, setStreaming] = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [follow, setFollow] = useState(true);
  const [scrollOffset, setScrollOffset] = useState(0);
  const injectedLogService = useInject<LogService>(TYPES.LogService);
  const logServiceRef = useRef(injectedLogService);
  const logService = logServiceRef.current;
  const { stdout } = useStdout();
  const terminalHeight = stdout?.rows ?? 24;
  const MAX_VISIBLE_LINES = Math.max(1, Math.floor(terminalHeight * 0.7) - 7);

  useEffect(() => {
    setLines(clampLines(props.logLines, LOG_MODAL_LINES_MAX));
  }, [props.logLines]);

  useEffect(() => {
    if (!props.loopId) return;
    if (props.run.status !== "running") return;
    setStreaming(true);
    const socket = logService.streamRunLog(
      props.loopId,
      props.run.runNumber,
      (line) => setLines((prev) => appendClamped(prev, line, LOG_MODAL_LINES_MAX)),
      () => setStreaming(false),
      () => setStreaming(false)
    );
    return () => {
      socket.destroy();
    };
  }, [props.loopId, props.run.runNumber, props.run.status, logService]);

  const filtered = searchQuery
    ? lines.filter((l) => l.toLowerCase().includes(searchQuery.toLowerCase()))
    : lines;

  const totalLines = filtered.length;
  const startIdx = follow
    ? Math.max(0, totalLines - MAX_VISIBLE_LINES)
    : scrollOffset;
  const endIdx = startIdx + MAX_VISIBLE_LINES;
  const visible = filtered.slice(startIdx, endIdx);

  useInput((input, key) => {
    // Bracketed paste: content wrapped in ESC[200~ ... ESC[201~. Must come
    // before the escape check  the leading ESC trips key.escape and would
    // close the modal before the paste is acknowledged. LogModal doesn't
    // insert pastes, so just swallow the sequence.
    if (input.includes("\x1b[200~")) {
      return;
    }

    if (searchMode) {
      if (key.escape || key.return) {
        setSearchMode(false);
        return;
      }
      if (key.backspace || key.delete) {
        setSearchQuery((q) => q.slice(0, -1));
        return;
      }
      if (input && !key.ctrl && input.length === 1 && input >= " " && input <= "~") {
        setSearchQuery((q) => q + input);
        return;
      }
      return;
    }

    if (key.escape) {
      props.onClose();
      return;
    }
    if (input === "/") {
      setSearchMode(true);
      setSearchQuery("");
      return;
    }
    if (key.ctrl && input === "x") {
      copyToClipboard(lines.join("\n"));
      props.onCopy?.();
      return;
    }
    if (key.ctrl && input === "t") {
      setFollow(false);
      setScrollOffset(0);
      return;
    }
    if (key.ctrl && input === "b") {
      setFollow(true);
      setScrollOffset(0);
      return;
    }
    if (key.downArrow) {
      const base = follow ? Math.max(0, totalLines - MAX_VISIBLE_LINES) : scrollOffset;
      setFollow(false);
      setScrollOffset(Math.min(base + 1, Math.max(0, totalLines - MAX_VISIBLE_LINES)));
      return;
    }
    if (key.upArrow) {
      const base = follow ? Math.max(0, totalLines - MAX_VISIBLE_LINES) : scrollOffset;
      setFollow(false);
      setScrollOffset(Math.max(0, base - 1));
      return;
    }
  });

  const isLoading = props.loading || streaming;
  const statusIcon =
    props.run.status === "running"
      ? "\u21bb"
      : props.run.exitCode === 0
        ? "\u2713"
        : "\u2717";
  const statusColor =
    props.run.status === "running"
      ? theme.semantic.warning
      : props.run.exitCode === 0
        ? theme.semantic.success
        : theme.semantic.danger;

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
        borderStyle="round"
        borderColor={theme.accent.brand}
        backgroundColor={theme.bg.elevated}
        paddingX={2}
        paddingY={1}
        flexDirection="column"
        width="95%"
        height="70%"
      >
        <Text color={theme.accent.brand} bold>
          {`Run #${props.run.runNumber} - ${formatDate(props.run.startedAt)}`}
        </Text>

        <Box flexDirection="column" marginTop={1} flexGrow={1}>
          <Box marginBottom={1} justifyContent="space-between">
            <Text color={statusColor}>
              {statusIcon}{" "}
              {props.run.status === "running"
                ? t("board.logModalRunning")
                : t("board.logModalExit", { code: props.run.exitCode })}
            </Text>
            {props.run.duration > 0 ? (
              <Text color={theme.text.muted}> {t("board.logModalDuration")} {props.run.duration}ms</Text>
            ) : null}
            <Text color={theme.text.muted}>
              {searchMode
                ? `/${searchQuery}`
                : `[${startIdx}-${endIdx}/${totalLines}]`}
            </Text>
          </Box>

          {searchMode ? (
            <Box marginBottom={1}>
              <Text color={theme.text.muted}>Search: </Text>
              <Text color={theme.text.primary}>{searchQuery}_</Text>
            </Box>
          ) : null}

          <Box flexDirection="column" flexGrow={1} overflow="hidden">
            {visible.length === 0 ? (
              <Text color={theme.text.muted}>
                {isLoading
                  ? t("board.logModalLoading")
                  : searchQuery
                    ? t("board.logModalNoMatches")
                    : t("board.logModalEmpty")}
              </Text>
            ) : (
              visible.map((line, i) => {
                const realIdx = startIdx + i;
                const expanded = expandJsonLine(line);
                if (expanded) {
                  return (
                    <React.Fragment key={realIdx}>
                      {expanded.map((sub, j) => (
                        <Text
                          key={`${realIdx}-${j}`}
                          color={j === 0 ? theme.accent.task : theme.text.muted}
                          wrap="truncate"
                        >
                          {sub}
                        </Text>
                      ))}
                    </React.Fragment>
                  );
                }
                return (
                  <Text
                    key={realIdx}
                    color={colorForLine(line, props.run)}
                    wrap="truncate"
                  >
                    {line}
                  </Text>
                );
              })
            )}
          </Box>

          <Box marginTop={1} justifyContent="space-between">
            <Text color={theme.text.muted}>
              {searchMode
                ? t("board.logModalSearchHint")
                : t("board.logModalFooterHints")}
            </Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
