import React, { useState, useCallback } from "react";
import { Box, Text, useFocus, useInput } from "ink";
import { darkTheme as theme } from "./theme.js";
import { sanitizePaste } from "../utils/paste.js";

export interface FocusableInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onSubmit?: (value: string) => void;
}

export function FocusableInput(props: FocusableInputProps): React.ReactNode {
  const { value, onChange, onSubmit } = props;
  const placeholder = props.placeholder ?? "type here...";
  const { isFocused } = useFocus();

  const [cursorOffset, setCursorOffset] = useState(value.length);

  const insertText = useCallback(
    (text: string) => {
      const before = value.slice(0, cursorOffset);
      const after = value.slice(cursorOffset);
      const next = before + text + after;
      onChange(next);
      setCursorOffset(before.length + text.length);
    },
    [value, cursorOffset, onChange],
  );

  useInput(
    (input, key) => {
      // Bracketed paste: content wrapped in ESC[200~ ... ESC[201~
      if (input.includes("\x1b[200~")) {
        insertText(sanitizePaste(input));
        return;
      }

      // Swallow SGR mouse sequences
      if (input.includes("[<")) return;

      if (key.ctrl || key.escape) return;

      // Multi-char containing CR/LF with no bracketed markers  ignore
      if (input.length > 1 && (input.includes("\r") || input.includes("\n"))) return;

      if (key.return) {
        onSubmit?.(value);
        return;
      }
      if (key.backspace || key.delete) {
        if (cursorOffset > 0) {
          const next = value.slice(0, cursorOffset - 1) + value.slice(cursorOffset);
          onChange(next);
          setCursorOffset((c) => c - 1);
        }
        return;
      }
      if (key.leftArrow) {
        if (cursorOffset > 0) setCursorOffset((c) => c - 1);
        return;
      }
      if (key.rightArrow) {
        if (cursorOffset < value.length) setCursorOffset((c) => c + 1);
        return;
      }

      // Multi-char printable input = unbracketed single-line paste (e.g. right-click)
      if (input.length > 1 && !key.meta) {
        insertText(sanitizePaste(input));
        return;
      }

      // Single printable char
      if (input.length === 1 && input >= " " && input <= "~") {
        insertText(input);
      }
    },
    { isActive: isFocused },
  );

  const borderColor = isFocused ? theme.accent.brand : theme.border.dim;
  const backgroundColor = isFocused ? theme.bg.input : undefined;
  const showPlaceholder = value.length === 0;

  // Render value with cursor
  const before = value.slice(0, cursorOffset);
  const cursorChar =
    cursorOffset < value.length ? value[cursorOffset] : " ";
  const after = cursorOffset < value.length ? value.slice(cursorOffset + 1) : "";

  return (
    <Box
      borderStyle="single"
      borderColor={borderColor}
      backgroundColor={backgroundColor}
      paddingLeft={1}
      overflow="hidden"
    >
      {showPlaceholder ? (
        <Text color={theme.text.muted}>{placeholder}</Text>
      ) : (
        <Text color={theme.text.primary}>
          {before}
          <Text inverse>{cursorChar}</Text>
          {after}
        </Text>
      )}
      {isFocused && showPlaceholder ? <Text inverse>{" "}</Text> : null}
    </Box>
  );
}
