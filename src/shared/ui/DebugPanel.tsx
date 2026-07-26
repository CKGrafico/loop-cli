import React from "react";
import { Box, Text } from "ink";
import type { Breakpoint } from "../hooks/useBreakpoint.js";
import { darkTheme as theme } from "./theme.js";

export interface DebugEntry {
  id: number;
  input: string;
  len: number;
  ctrl: boolean;
  return: boolean;
  shift: boolean;
  meta: boolean;
  tab: boolean;
  upArrow: boolean;
  downArrow: boolean;
  leftArrow: boolean;
  rightArrow: boolean;
  escape: boolean;
  codes: string;
}

const MAX_ENTRIES = 12;

export function DebugPanel(props: { entries: DebugEntry[]; breakpoint?: Breakpoint }): React.ReactNode {
  const panelWidth = props.breakpoint === "wide" || props.breakpoint === undefined ? "22%" : "100%";

  return (
    <Box
      flexDirection="column"
      width={panelWidth}
      flexShrink={0}
      borderStyle="single"
      borderColor={theme.semantic.warning}
      backgroundColor={theme.bg.surface}
    >
      <Box paddingLeft={1}>
        <Text color={theme.semantic.warning} bold>
          DEBUG
        </Text>
      </Box>
      <Box paddingLeft={1} flexDirection="column">
        {props.entries.length === 0 ? (
          <Text color={theme.text.muted}>press keys...</Text>
        ) : (
          props.entries.map((e) => (
            <Box key={e.id} flexDirection="column">
              <Text color={theme.text.primary}>
                len={e.len} codes=[{e.codes}]
              </Text>
              <Text color={theme.text.muted}>
                c={e.ctrl ? 1 : 0} r={e.return ? 1 : 0} t={e.tab ? 1 : 0} e={e.escape ? 1 : 0}
              </Text>
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
}

export { MAX_ENTRIES };
