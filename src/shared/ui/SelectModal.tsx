import React, { useState, useMemo, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { darkTheme as theme } from "./theme.js";
import { t } from "../i18n/index.js";

const MAX_VISIBLE = 10;

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Filterable modal picker: type to narrow, up/down to navigate, enter to
 * select, esc to cancel. The single interaction pattern for every enumerated
 * field in the board  a fixed set of two options and a list of dozens both
 * use this, so users only ever learn one gesture for "change this value".
 */
export function SelectModal(props: {
  title: string;
  options: SelectOption[];
  initialValue?: string;
  onSelect: (option: SelectOption) => void;
  onClose: () => void;
  accentColor?: string;
}): React.ReactNode {
  const { title, options, initialValue, onSelect, onClose } = props;
  const accent = props.accentColor ?? theme.accent.brand;
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(() => {
    const idx = options.findIndex((o) => o.value === initialValue);
    return idx >= 0 ? idx : 0;
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const clampedCursor = filtered.length > 0 ? cursor % filtered.length : 0;

  const selectAt = useCallback(
    (idx: number) => {
      const option = filtered[idx];
      if (option) onSelect(option);
    },
    [filtered, onSelect],
  );

  useInput((input, key) => {
    if (input.includes("[<")) return;
    if (key.escape) {
      onClose();
      return;
    }
    if (key.return) {
      selectAt(clampedCursor);
      return;
    }
    if (key.upArrow) {
      setCursor((prev) => (prev <= 0 ? Math.max(0, filtered.length - 1) : prev - 1));
      return;
    }
    if (key.downArrow) {
      setCursor((prev) => (prev >= filtered.length - 1 ? 0 : prev + 1));
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
        width={50}
        height={Math.min(20, visible.length + 7)}
        flexDirection="column"
        backgroundColor={theme.bg.elevated}
        borderStyle="round"
        borderColor={accent}
        paddingX={1}
        paddingY={0}
      >
        <Box justifyContent="space-between">
          <Text color={accent} bold>
            {title}
          </Text>
          <Text color={theme.text.muted}>esc</Text>
        </Box>

        <Box marginTop={0}>
          <Text color={theme.text.muted}>{"› "}</Text>
          <Text color={query ? theme.text.primary : theme.text.muted}>
            {query || t("selectModal.searchPlaceholder")}
          </Text>
          <Text inverse>{" "}</Text>
        </Box>

        <Box flexDirection="column" marginTop={0}>
          {visible.length === 0 ? (
            <Text color={theme.text.muted}>{t("selectModal.empty")}</Text>
          ) : (
            visible.map((option, visIdx) => {
              const realIdx = start + visIdx;
              const isSelected = realIdx === clampedCursor;
              const isCurrent = option.value === initialValue;
              return (
                <Box key={option.value} backgroundColor={isSelected ? theme.bg.active : undefined}>
                  <Text color={isSelected ? theme.text.inverse : theme.text.muted}>
                    {isSelected ? "❯ " : "  "}
                  </Text>
                  <Text color={isSelected ? theme.text.inverse : isCurrent ? accent : theme.text.primary}>
                    {option.label}
                  </Text>
                </Box>
              );
            })
          )}
        </Box>

        <Box marginTop={1} justifyContent="space-between">
          <Text color={theme.text.muted}>
            {filtered.length}/{options.length}
          </Text>
          <Text color={theme.text.muted}>{t("selectModal.hint")}</Text>
        </Box>
      </Box>
    </Box>
  );
}

/** Bordered field showing the current value, matching TextField's focus styling. */
export function SelectValueField(props: {
  label: string | null;
  placeholder: string;
  isActive: boolean;
}): React.ReactNode {
  const { label, placeholder, isActive } = props;
  return (
    <Box flexDirection="column" width="100%">
      <Box
        borderStyle="single"
        borderColor={isActive ? theme.accent.brand : theme.border.dim}
        backgroundColor={isActive ? theme.bg.input : undefined}
        paddingLeft={1}
        overflow="hidden"
        width="100%"
      >
        {label ? (
          <Text color={theme.text.primary}>{label}</Text>
        ) : (
          <Text color={theme.text.muted}>{placeholder}</Text>
        )}
      </Box>
      {isActive ? (
        <Box marginTop={0}>
          <Text color={theme.accent.brand}>{"› "}</Text>
          <Text color={theme.text.muted}>{t("selectModal.fieldHint", { action: "enter" })}</Text>
        </Box>
      ) : null}
    </Box>
  );
}
