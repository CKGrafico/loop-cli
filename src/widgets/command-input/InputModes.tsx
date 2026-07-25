import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { darkTheme as theme } from "../../shared/ui/theme.js";
import { t } from "../../shared/i18n/index.js";
import type { ConfirmState } from "../../app/types.js";
import { HintBar, KeyHint } from "./HintBar.js";

export function ConfirmMode({
  confirmState,
  onConfirmYes,
  onConfirmCancel,
  disabled,
}: {
  confirmState: ConfirmState;
  onConfirmYes: () => void;
  onConfirmCancel: () => void;
  disabled?: boolean;
}): React.ReactNode {
  const [value, setValue] = useState("");

  useInput(
    (input, key) => {
      if (input.includes("[<")) return;
      if (key.ctrl) return;
      if (input.length > 1 && (input.includes("\r") || input.includes("\n"))) return;
      if (key.escape) { setValue(""); onConfirmCancel(); return; }
      if (key.return) {
        if (value.toLowerCase() === "yes") { setValue(""); onConfirmYes(); }
        else { setValue(""); onConfirmCancel(); }
        return;
      }
      if (key.backspace || key.delete) { setValue((v) => v.slice(0, -1)); return; }
      if (input && !key.ctrl && !key.meta && input.length === 1) { setValue((v) => v + input); return; }
    },
    { isActive: !disabled },
  );

  const cursor = "\x1b[7m \x1b[27m";

  return (
    <>
      <Box>
        <Text color={theme.semantic.danger}>{"│ "}</Text>
        <Text color={theme.text.muted}>{confirmState.prompt + " "}</Text>
        {value.length > 0 ? (
          <Text>{value + cursor}</Text>
        ) : (
          <Text>{cursor}</Text>
        )}
      </Box>
      <HintBar
        leftHint={
          <Box>
            <Text color={theme.text.muted}>{"\u00b7\u00b7\u00b7\u00b7\u00b7\u00b7\u00b7 "}</Text>
            <KeyHint keyLabel="esc" action="cancel" />
          </Box>
        }
        rightHint={<KeyHint keyLabel="enter" action="confirm" />}
      />
    </>
  );
}

export function SearchMode({
  value,
  onSearchChange,
  onSearchSubmit,
  onSearchCancel,
  disabled,
}: {
  value: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  onSearchCancel: () => void;
  disabled?: boolean;
}): React.ReactNode {
  useInput(
    (input, key) => {
      if (input.includes("[<")) return;
      if (key.ctrl) return;
      if (input.length > 1 && (input.includes("\r") || input.includes("\n"))) return;
      if (key.escape) { onSearchCancel(); return; }
      if (key.return) { onSearchSubmit(); return; }
      if (key.backspace || key.delete) { onSearchChange(value.slice(0, -1)); return; }
      if (input && !key.ctrl && !key.meta && input.length === 1) { onSearchChange(value + input); return; }
    },
    { isActive: !disabled },
  );

  const placeholder = t("cmdInput.searchPlaceholder");
  const cursor = "\x1b[7m \x1b[27m";

  return (
    <>
      <Box>
        <Text color={theme.accent.project}>{"│ "}</Text>
        {value.length > 0 ? (
          <Text>{value + cursor}</Text>
        ) : (
          <Text color={theme.text.muted}>{placeholder}</Text>
        )}
      </Box>
      <HintBar
        leftHint={
          <Box>
            <Text color={theme.text.muted}>{"\u00b7\u00b7\u00b7\u00b7\u00b7\u00b7\u00b7 "}</Text>
            <KeyHint keyLabel="esc" action="cancel" />
          </Box>
        }
        rightHint={<KeyHint keyLabel="enter" action="apply" />}
      />
    </>
  );
}
