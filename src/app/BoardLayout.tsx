import React from "react";
import { Box } from "ink";
import type { Breakpoint } from "../shared/hooks/useBreakpoint.js";

export function BoardLayout(props: { breakpoint: Breakpoint; children: React.ReactNode }): React.ReactNode {
  return (
    <Box width="100%" flexGrow={1}>
      <Box width="100%" flexDirection={props.breakpoint === "wide" ? "row" : "column"} flexGrow={1}>
        {props.children}
      </Box>
    </Box>
  );
}
