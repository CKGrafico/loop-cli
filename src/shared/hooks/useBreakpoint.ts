import { useStdout } from "ink";
import { BOARD_BREAKPOINT_COMPACT, BOARD_BREAKPOINT_WIDE } from "../config/constants.js";

/**
 * Three-tier responsive breakpoint for the TUI board.
 *
 * - "wide"    (>= 110 cols): side-by-side panels, full column widths
 * - "compact" (70-109 cols): stacked panels, trimmed columns
 * - "minimal" (< 70 cols):   single panel, essential columns only
 */
export type Breakpoint = "wide" | "compact" | "minimal";

export function useBreakpoint(): Breakpoint {
  const { stdout } = useStdout();
  const width = stdout?.columns ?? 80;
  if (width >= BOARD_BREAKPOINT_WIDE) return "wide";
  if (width >= BOARD_BREAKPOINT_COMPACT) return "compact";
  return "minimal";
}
