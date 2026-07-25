import { useInput } from "ink";
import { MAX_ENTRIES } from "../../shared/ui/DebugPanel.js";
import type { DebugEntry } from "../../shared/ui/DebugPanel.js";
import type { ShortcutContext, View } from "../../app/types.js";

const FORM_VIEWS: View[] = ["create", "task-create", "task-edit", "project-create", "project-edit"];

function isBoardView(view: View): boolean {
  return view === "board";
}

export function useGlobalShortcuts(context: ShortcutContext) {
  const {
    activeTab, focusedPanel: _focusedPanel, setFocusedPanel, setActiveTab,
    view, handleCommand, triggerContextualAction, popLayer,
    anyModalOpen: _anyModalOpen, debugMode, setDebugEntries,
    inputOwner: _inputOwner, confirmState, searchState,
    logModalRun, commandsBrowserOpen, exportModal, diagramModal,
    contextHelpOpen, setContextHelpOpen,
    onQuit, exit, setConfirmState,
    setLogModalRun, setLogModalLoopId, setCommandsBrowserOpen,
    chordState, setChordState,
  } = context;

  useInput((input, key) => {
    // Swallow SGR mouse sequences — handled by useMouseScroll in each component
    if (input.includes("[<")) {
      return;
    }

    if (key.ctrl && input === "c") {
      if (!logModalRun && !confirmState && !commandsBrowserOpen && !exportModal && !diagramModal) {
        setConfirmState({
          prompt: "",
          onConfirm: () => { onQuit(); exit(); },
        });
        return;
      }
    }

    if (debugMode) {
      const entry: DebugEntry = {
        id: Date.now(),
        input,
        len: input.length,
        ctrl: key.ctrl,
        return: key.return,
        shift: key.shift,
        meta: key.meta,
        tab: key.tab,
        upArrow: key.upArrow,
        downArrow: key.downArrow,
        leftArrow: key.leftArrow,
        rightArrow: key.rightArrow,
        escape: key.escape,
        codes: Array.from(input).map((c: string) => c.charCodeAt(0)).join(","),
      };
      setDebugEntries((prev) => [entry, ...prev].slice(0, MAX_ENTRIES));
    }

    const isMultiCharEnter = input.length > 1 && (input.includes("\r") || input.includes("\n"));
    const isCtrlEnter = (key.ctrl && key.return) || input === "\x0e" || isMultiCharEnter;
    if (isCtrlEnter && isBoardView(view) && !logModalRun && !commandsBrowserOpen && !confirmState && !searchState?.active && !diagramModal) {
      triggerContextualAction();
      return;
    }

    const canShortcut = key.ctrl && isBoardView(view) && !logModalRun && !commandsBrowserOpen && !confirmState && !searchState?.active && !exportModal && !diagramModal;
    if (canShortcut) {
      const globalShortcuts: Record<string, () => void> = {
        p: () => { setCommandsBrowserOpen(true); },
        b: () => handleCommand("debug"),
        x: () => handleCommand("export"),
        i: () => handleCommand("import"),
      };
      const filterShortcuts: Record<string, () => void> = {
        s: () => handleCommand("search"),
        t: () => handleCommand("filter-status"),
        o: () => handleCommand("sort"),
        p: () => handleCommand("filter-project"),
      };
      const actionShortcuts: Record<string, () => void> = {
        n: () => handleCommand(activeTab === "loops" ? "new-loop" : activeTab === "tasks" ? "new-task" : "new-project"),
        e: () => handleCommand("edit"),
        d: () => handleCommand("delete"),
        ...(activeTab === "loops" ? {
          p: () => handleCommand("pause"),
          r: () => handleCommand("play"),
          s: () => handleCommand("stop"),
          t: () => handleCommand("trigger"),
          c: () => handleCommand("clone"),
          o: () => handleCommand("logs"),
        } : {}),
      };

      if (chordState === "ctrl+f" && filterShortcuts[input]) {
        filterShortcuts[input]!();
        setChordState(null);
        return;
      }
      if (chordState === "ctrl+a" && actionShortcuts[input]) {
        actionShortcuts[input]!();
        setChordState(null);
        return;
      }
      if (chordState) { setChordState(null); }

      if (input === "f") { setChordState("ctrl+f"); return; }
      if (input === "a") { setChordState("ctrl+a"); return; }
      const globalHandler = globalShortcuts[input];
      if (globalHandler) { globalHandler(); return; }
    }

    if (confirmState && !key.escape) return;
    if (searchState?.active && !key.escape) return;

    if (key.escape) { popLayer(); return; }

    if (logModalRun) {
      if (input === "q") { setLogModalRun(null); setLogModalLoopId(null); }
      return;
    }

    if (commandsBrowserOpen) return;

    if (contextHelpOpen) { setContextHelpOpen(false); return; }
    if (logModalRun) return;
    if (FORM_VIEWS.includes(view)) return;

    if (isBoardView(view)) {
      if (key.ctrl && key.rightArrow) {
        setActiveTab((prev) => prev === "loops" ? "tasks" : prev === "tasks" ? "projects" : "loops");
        return;
      }
      if (key.ctrl && key.leftArrow) {
        setActiveTab((prev) => prev === "loops" ? "projects" : prev === "tasks" ? "loops" : "tasks");
        return;
      }
      if (key.tab) {
        setFocusedPanel((prev) => prev === "left" ? "right" : "left");
        return;
      }
      if (input === "1") { setActiveTab("loops"); return; }
      if (input === "2") { setActiveTab("tasks"); return; }
      if (input === "3") { setActiveTab("projects"); return; }
    }
  });
}
