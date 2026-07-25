import React from "react";
import { Box, Text, useInput } from "ink";
import { darkTheme as theme } from "./theme.js";

export function Modal(props: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  width?: number | string;
  height?: number | string;
}): React.ReactNode {
  useInput((_input, key) => {
    if (_input.includes("[<")) return;
    if (key.escape) {
      props.onClose();
    }
  });

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
        width={props.width ?? "60%"}
        height={props.height}
      >
        <Text color={theme.accent.brand} bold>
          {props.title}
        </Text>
        <Box flexDirection="column" marginTop={1} flexGrow={1}>
          {props.children}
        </Box>
      </Box>
    </Box>
  );
}
