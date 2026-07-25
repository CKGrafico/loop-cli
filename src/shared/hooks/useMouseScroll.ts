import { useInput } from "ink";
import { useRef } from "react";

/**
 * Terminal mouse scroll event hook for Ink-based CLIs.
 *
 * When the app enables SGR mouse tracking (DECSET 1000 + 1006), the terminal
 * emits scroll-wheel events as escape sequences on stdin. This hook parses
 * those sequences and fires the provided callbacks, letting scrollable
 * components respond to mouse scroll just like arrow keys.
 *
 * IMPORTANT: Ink's parseKeypress strips the leading ESC byte (\x1b) from
 * unknown escape sequences before passing them to useInput. So SGR mouse
 * sequences arrive as `[<64;col;rowM` (without the ESC prefix). This hook
 * matches the stripped format.
 *
 * Usage:
 *   useMouseScroll({ onScrollUp, onScrollDown, isActive: isFocused })
 *
 * The hook only parses — it does NOT enable/disable mouse tracking.
 * That lifecycle is owned by the app entry point (see constants.ts for
 * the DECSET sequences to emit on stdout).
 */

export interface MouseScrollOptions {
  /** Called when the user scrolls up (mouse wheel up). */
  onScrollUp: () => void;
  /** Called when the user scrolls down (mouse wheel down). */
  onScrollDown: () => void;
  /** When false, the hook ignores scroll events. Default: true. */
  isActive?: boolean;
}

/**
 * Parse SGR (1006) mouse scroll sequences from an input string that Ink
 * has already passed through (ESC byte stripped).
 *
 * Ink strips the leading \x1b, so the input arrives as:
 *   [<button;col;rowM  (press)   or  [<button;col;rowm  (release)
 *
 * Scroll wheel: button 64 = scroll up, button 65 = scroll down.
 *
 * A single useInput call may contain multiple concatenated mouse events
 * (fast scrolling). Returns the net scroll direction:
 * positive = scrolled down, negative = up, zero = no scroll.
 */
export function parseMouseScroll(input: string): number {
  let delta = 0;
  // Match stripped SGR sequences: [<button;col;rowM or m
  // (Ink strips the ESC byte, so we match without \x1b)
  const sgrRe = /\[<(\d+);\d+;\d+[Mm]/g;
  let match: RegExpExecArray | null;
  while ((match = sgrRe.exec(input)) !== null) {
    const button = Number(match[1]);
    if (button === 64) delta -= 1; // scroll up
    else if (button === 65) delta += 1; // scroll down
  }
  return delta;
}

/**
 * Hook that listens for mouse scroll events via Ink's useInput and fires
 * callbacks.
 *
 * Must be used inside an Ink app that has enabled SGR mouse tracking
 * (DECSET 1000 + 1006) at startup. The hook does not enable/disable
 * tracking itself.
 */
export function useMouseScroll(options: MouseScrollOptions): void {
  const { onScrollUp, onScrollDown, isActive = true } = options;
  const callbacksRef = useRef({ onScrollUp, onScrollDown });
  callbacksRef.current = { onScrollUp, onScrollDown };

  useInput(
    (input) => {
      const delta = parseMouseScroll(input);
      if (delta < 0) {
        for (let i = 0; i < Math.abs(delta); i++) {
          callbacksRef.current.onScrollUp();
        }
      } else if (delta > 0) {
        for (let i = 0; i < delta; i++) {
          callbacksRef.current.onScrollDown();
        }
      }
    },
    { isActive },
  );
}
