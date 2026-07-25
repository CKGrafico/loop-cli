import React from "react";
import { Box, Text, useFocus, useInput } from "ink";
import { darkTheme as theme } from "./theme.js";

export function FocusableButton(props: {
  label: string;
  color: string;
  onPress?: () => void;
  variant?: "default" | "danger";
}): React.ReactNode {
  const { label, color, onPress, variant = "default" } = props;
  const { isFocused } = useFocus();

  useInput(
    (_input, key) => {
      if (_input.includes("[<")) return;
      if (key.return) {
        onPress?.();
      }
    },
    { isActive: isFocused },
  );

  const accent = variant === "danger" ? theme.semantic.danger : color;
  const textColor = isFocused ? theme.text.inverse : accent;
  const indicator = isFocused ? "› " : "  ";

  return (
    <Box
      backgroundColor={isFocused ? theme.bg.active : undefined}
      paddingX={1}
      marginRight={1}
      flexShrink={0}
    >
      <Text color={textColor} bold>{indicator + label}</Text>
    </Box>
  );
}
