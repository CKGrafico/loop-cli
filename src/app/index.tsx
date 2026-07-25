import { render } from "ink";
import React from "react";
import { App } from "./App.js";
import { BRACKETED_PASTE_ENABLE, BRACKETED_PASTE_DISABLE, MOUSE_TRACKING_ENABLE, MOUSE_TRACKING_DISABLE, USER_TIMING_SWEEP_MS } from "../shared/config/constants.js";
import { InversifyProvider } from "../shared/providers/InversifyProvider.js";

function startUserTimingSweep(): void {
  const timer = setInterval(() => {
    performance.clearMarks();
    performance.clearMeasures();
  }, USER_TIMING_SWEEP_MS);
  timer.unref();
}

export async function launchBoard(): Promise<void> {
  startUserTimingSweep();
  process.stdout.write(BRACKETED_PASTE_ENABLE);
  process.stdout.write(MOUSE_TRACKING_ENABLE);
  const disableBracketedPaste = () => process.stdout.write(BRACKETED_PASTE_DISABLE);
  const disableMouseTracking = () => process.stdout.write(MOUSE_TRACKING_DISABLE);

  const instance = render(React.createElement(
    InversifyProvider,
    null,
    React.createElement(App, {
      onQuit: () => {
        disableBracketedPaste();
        disableMouseTracking();
        instance.unmount();
      }
    }),
  ));

  // Re-emit DECSET sequences after Ink's first render cycle.
  // Ink internally toggles raw mode during mount, which can suppress the
  // mouse tracking and bracketed paste modes we enabled above. Re-emitting
  // after render() ensures the terminal re-enables them.
  process.nextTick(() => {
    process.stdout.write(MOUSE_TRACKING_ENABLE);
    process.stdout.write(BRACKETED_PASTE_ENABLE);
  });

  process.on("exit", () => {
    disableBracketedPaste();
    disableMouseTracking();
  });

  process.on("uncaughtException", (error) => {
    console.error("Uncaught exception:", error);
    disableBracketedPaste();
    disableMouseTracking();
    instance.unmount();
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    console.error("Unhandled rejection:", reason);
  });
}
