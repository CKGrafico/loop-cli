import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { darkTheme as theme } from "../../shared/ui/theme.js";
import { t } from "../../shared/i18n/index.js";
import { copyToClipboard } from "../../shared/clipboard.js";
import { useMouseScroll } from "../../shared/hooks/useMouseScroll.js";

interface DiagramModalProps {
  diagramText: string;
  onClose: () => void;
  onCopy?: () => void;
}

const VISIBLE_LINES = 20;

export function DiagramModal(props: DiagramModalProps): React.ReactNode {
  const lines = props.diagramText.split("\n");
  const totalLines = lines.length;
  const maxScroll = Math.max(0, totalLines - VISIBLE_LINES);
  const [scrollOffset, setScrollOffset] = useState(0);

  useInput((input, key) => {
    if (input.includes("\x1b[200~")) {
      return;
    }
    if (input.includes("[<")) {
      return;
    }
    if (key.escape) { props.onClose(); return; }
    if (key.downArrow) { setScrollOffset((o) => Math.min(o + 1, maxScroll)); return; }
    if (key.upArrow) { setScrollOffset((o) => Math.max(0, o - 1)); return; }
    if (input === "c" && !key.ctrl) { copyToClipboard(props.diagramText); props.onCopy?.(); return; }
  });

  useMouseScroll({
    onScrollUp: () => setScrollOffset((o) => Math.max(0, o - 1)),
    onScrollDown: () => setScrollOffset((o) => Math.min(o + 1, maxScroll)),
  });

  const visible = lines.slice(scrollOffset, scrollOffset + VISIBLE_LINES);

  return (
    <Box
      position="absolute"
      top={0}
      left={0}
      width="100%"
      height="100%"
      flexDirection="column"
      backgroundColor={theme.bg.elevated}
      borderStyle="round"
      borderColor={theme.accent.brand}
      paddingX={2}
      paddingY={1}
    >
      <Box marginBottom={1}>
        <Text color={theme.accent.brand} bold>{t("diagram.modalTitle")}</Text>
      </Box>

      <Box flexDirection="column" flexGrow={1} overflow="hidden">
        {visible.map((line, i) => (
          <Text key={scrollOffset + i} color={theme.text.primary} wrap="truncate">
            {line}
          </Text>
        ))}
      </Box>

      <Box marginTop={1} justifyContent="space-between">
        <Text color={theme.text.muted}>{t("diagram.hint")}</Text>
        <Text color={theme.text.muted}>[{scrollOffset}-{scrollOffset + visible.length}/{totalLines}]</Text>
      </Box>
    </Box>
  );
}
