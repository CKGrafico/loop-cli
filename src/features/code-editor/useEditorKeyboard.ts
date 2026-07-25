import { useInput } from "ink";
import { t } from "../../shared/i18n/index.js";
import { copyToClipboard, readFromClipboard } from "../../shared/clipboard.js";
import { sanitizeMultilinePaste, wrapCommand } from "../../shared/utils/paste.js";

export interface UseEditorKeyboardParams {
  lines: string[];
  cursorRow: number;
  cursorCol: number;
  value: string;
  setValue: (v: string) => void;
  setCursorRow: (v: number | ((prev: number) => number)) => void;
  setCursorCol: (v: number | ((prev: number) => number)) => void;
  undo: () => void;
  redo: () => void;
  onSave: (value: string) => void;
  onCancel: () => void;
  setFlashMsg: (msg: string | null) => void;
  applyMutation: (nextLines: string[], newCursorRow: number, newCursorCol: number) => void;
}

export function useEditorKeyboard(params: UseEditorKeyboardParams): void {
  const {
    lines,
    cursorRow,
    cursorCol,
    value,
    setValue,
    setCursorRow,
    setCursorCol,
    undo,
    redo,
    onSave,
    onCancel,
    setFlashMsg,
    applyMutation,
  } = params;

  useInput(
    (input, key) => {
      if (input.includes("\x1b[200~")) {
        const pasted = wrapCommand(sanitizeMultilinePaste(input));
        if (pasted) {
          const next = [...lines];
          const line = next[cursorRow] ?? "";
          next[cursorRow] =
            line.slice(0, cursorCol) + pasted + line.slice(cursorCol);
          applyMutation(next, cursorRow, cursorCol + pasted.length);
        }
        return;
      }

      // Swallow SGR mouse sequences
      if (input.includes("[<")) return;
      if (key.escape) {
        onCancel();
        return;
      }
      if ((key.ctrl && input === "s") || input === "\x13") {
        onSave(value);
        return;
      }
      if ((key.ctrl && !key.shift && input === "z") || input === "\x1a") {
        undo();
        return;
      }
      if (key.ctrl && key.shift && input === "z") {
        redo();
        return;
      }
      if ((key.ctrl && input === "x") || input === "\x18") {
        copyToClipboard(value);
        setValue("");
        setCursorRow(0);
        setCursorCol(0);
        setFlashMsg(t("codeEditor.copied"));
        return;
      }
      if ((key.ctrl && input === "v") || input === "\x16") {
        const clip = readFromClipboard();
        if (clip) {
          const pasted = sanitizeMultilinePaste(clip);
          if (pasted) {
            const next = [...lines];
            const line = next[cursorRow] ?? "";
            next[cursorRow] =
              line.slice(0, cursorCol) + pasted + line.slice(cursorCol);
            applyMutation(next, cursorRow, cursorCol + pasted.length);
          }
        } else {
          setFlashMsg(t("codeEditor.clipboardEmpty"));
        }
        return;
      }
      if ((key.ctrl && input === "l") || input === "\x0c") {
        setValue("");
        setCursorRow(0);
        setCursorCol(0);
        setFlashMsg(t("codeEditor.cleared"));
        return;
      }

      if (key.return) {
        const next = [...lines];
        const line = next[cursorRow] ?? "";
        next.splice(
          cursorRow,
          1,
          line.slice(0, cursorCol),
          line.slice(cursorCol),
        );
        applyMutation(next, cursorRow + 1, 0);
        return;
      }

      if (key.upArrow) {
        if (cursorRow > 0) {
          const newRow = cursorRow - 1;
          setCursorRow(newRow);
          setCursorCol((c) => Math.min(c, (lines[newRow] ?? "").length));
        }
        return;
      }
      if (key.downArrow) {
        if (cursorRow < lines.length - 1) {
          const newRow = cursorRow + 1;
          setCursorRow(newRow);
          setCursorCol((c) => Math.min(c, (lines[newRow] ?? "").length));
        }
        return;
      }
      if (key.leftArrow) {
        if (cursorCol > 0) {
          setCursorCol((c) => c - 1);
        } else if (cursorRow > 0) {
          setCursorRow((r) => r - 1);
          setCursorCol((lines[cursorRow - 1] ?? "").length);
        }
        return;
      }
      if (key.rightArrow) {
        const curLen = (lines[cursorRow] ?? "").length;
        if (cursorCol < curLen) {
          setCursorCol((c) => c + 1);
        } else if (cursorRow < lines.length - 1) {
          setCursorRow((r) => r + 1);
          setCursorCol(0);
        }
        return;
      }

      if (key.backspace || key.delete) {
        if (cursorCol > 0) {
          const next = [...lines];
          const line = next[cursorRow] ?? "";
          next[cursorRow] =
            line.slice(0, cursorCol - 1) + line.slice(cursorCol);
          applyMutation(next, cursorRow, cursorCol - 1);
        } else if (cursorRow > 0) {
          const next = [...lines];
          const prev = next[cursorRow - 1] ?? "";
          const cur = next[cursorRow] ?? "";
          next.splice(cursorRow - 1, 2, prev + cur);
          applyMutation(next, cursorRow - 1, prev.length);
        }
        return;
      }

      if (input.length > 1 && !key.meta) {
        const pasted = wrapCommand(sanitizeMultilinePaste(input));
        if (pasted) {
          const next = [...lines];
          const line = next[cursorRow] ?? "";
          next[cursorRow] =
            line.slice(0, cursorCol) + pasted + line.slice(cursorCol);
          applyMutation(next, cursorRow, cursorCol + pasted.length);
        }
        return;
      }

      if (input.length === 1 && input >= " " && input <= "~") {
        const next = [...lines];
        const line = next[cursorRow] ?? "";
        next[cursorRow] =
          line.slice(0, cursorCol) + input + line.slice(cursorCol);
        applyMutation(next, cursorRow, cursorCol + 1);
      }
    },
    { isActive: true },
  );
}
