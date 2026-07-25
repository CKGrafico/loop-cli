import React, { useEffect, useMemo, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import {
  useAutocompleteState,
  type FuzzyMatch,
} from "ink-combobox";
import { darkTheme as theme } from "../../shared/ui/theme.js";
import { t } from "../../shared/i18n/index.js";
import { buildCommands, rankCommands } from "../../features/commands/commands.js";
import {
  COMMAND_INPUT_DROPDOWN_MAX_VISIBLE,
  COMMAND_INPUT_HEIGHT,
} from "../../shared/config/constants.js";
import type { CommandContext, ConfirmState, SearchState } from "../../app/types.js";
import { sanitizePaste } from "../../shared/utils/paste.js";
import { CommandDropdown, renderInputLine } from "./CommandDropdown.js";
import { HintBar, KeyHint } from "./HintBar.js";
import { ConfirmMode, SearchMode } from "./InputModes.js";

export { sanitizePaste } from "../../shared/utils/paste.js";



export interface CommandInputProps {
  context: CommandContext;
  onCommand: (value: string) => void;
  confirmState: ConfirmState | null;
  searchState: SearchState | null;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  onSearchCancel: () => void;
  onConfirmYes: () => void;
  onConfirmCancel: () => void;
  onCopy?: () => void;
  onPanelAction?: () => void;
  disabled?: boolean;
  navOwner?: "modal" | "commandBar" | "panel";
  onInputStateChange?: (hasText: boolean, dropdownOpen: boolean) => void;
}



function CommandMode({
  context,
  onCommand,
  onCopy,
  onPanelAction,
  disabled,
  navOwner,
  onInputStateChange,
}: {
  context: CommandContext;
  onCommand: (value: string) => void;
  onCopy?: () => void;
  onPanelAction?: () => void;
  disabled?: boolean;
  navOwner?: "modal" | "commandBar" | "panel";
  onInputStateChange?: (hasText: boolean, dropdownOpen: boolean) => void;
}): React.ReactNode {
  const commands = useMemo(() => buildCommands(context), [context]);
  const options = useMemo(
    () => commands.map((cmd) => ({ label: cmd.label, value: cmd.value })),
    [commands],
  );

  const { state, dispatch } = useAutocompleteState({
    options,
    visibleOptionCount: COMMAND_INPUT_DROPDOWN_MAX_VISIBLE,
    onSelect: onCommand,
  });

  const rankedFiltered = useMemo<FuzzyMatch[]>(() => {
    const fo = state.filteredOptions;
    if (fo.length === 0 || state.inputValue.length === 0) return fo;

    const byValue = new Map<string, FuzzyMatch>();
    for (const m of fo) byValue.set(m.option.value, m);

    const ranked = rankCommands(
      state.inputValue,
      fo.map((m) => ({ label: m.option.label, value: m.option.value })),
    );

    return ranked
      .map((opt) => byValue.get(opt.value))
      .filter((m): m is FuzzyMatch => m !== undefined);
  }, [state.filteredOptions, state.inputValue]);

  useEffect(() => {
    onInputStateChange?.(state.inputValue.length > 0, state.isOpen);
  }, [state.inputValue, state.isOpen, onInputStateChange]);

  const insertText = useCallback((text: string) => {
    for (const ch of text) dispatch({ type: "INSERT_TEXT", text: ch });
  }, [dispatch]);

  const clearInput = useCallback(() => {
    dispatch({ type: "MOVE_CURSOR_END" });
    for (let i = 0; i < state.inputValue.length; i++) dispatch({ type: "DELETE_BACKWARD" });
  }, [dispatch, state.inputValue.length]);

  useInput(
    (input, key) => {
      if (input.includes("\x1b[200~")) {
        insertText(sanitizePaste(input));
        return;
      }

      // Swallow SGR mouse sequences — handled by useMouseScroll
      if (input.includes("[<")) {
        return;
      }

      if ((key.ctrl && input === "u") || input === "\x15") { clearInput(); return; }

      if (key.ctrl) return;
      if (input.length > 1 && (input.includes("\r") || input.includes("\n"))) return;

      if (navOwner === "panel" && state.inputValue.length === 0 && !state.isOpen) {
        if (input === "j" || input === "k" || key.upArrow || key.downArrow) {
          return;
        }
      }

      if (onCopy && input === "c" && !state.isOpen) {
        onCopy();
        return;
      }

      if (key.escape) {
        dispatch({ type: "CLOSE" });
        if (state.inputValue.length > 0) {
          clearInput();
        }
        return;
      }
      if (key.return) {
        if (state.isOpen && rankedFiltered.length > 0 && state.focusedIndex < rankedFiltered.length) {
          const focused = rankedFiltered[state.focusedIndex];
          dispatch({ type: "CLOSE" });
          for (let i = 0; i <= state.inputValue.length; i++) {
            dispatch({ type: "DELETE_BACKWARD" });
          }
          onCommand(focused.option.value);
        } else if (state.inputValue.length === 0) {
          onPanelAction?.();
        }
        return;
      }
      if (key.tab) { dispatch({ type: "ACCEPT" }); return; }
      if (key.downArrow) { dispatch({ type: "FOCUS_NEXT" }); return; }
      if (key.upArrow) { dispatch({ type: "FOCUS_PREV" }); return; }
      if (key.backspace || key.delete) { dispatch({ type: "DELETE_BACKWARD" }); return; }
      if (key.leftArrow) { dispatch({ type: "MOVE_CURSOR_LEFT" }); return; }
      if (key.rightArrow) { dispatch({ type: "MOVE_CURSOR_RIGHT" }); return; }
      if (input.length > 1 && !key.meta) {
        insertText(sanitizePaste(input));
        return;
      }
      if (input.length === 1 && !key.ctrl && !key.meta && !key.return && !key.tab && !key.escape && input >= " " && input <= "~") {
        dispatch({ type: "INSERT_TEXT", text: input });
      }
    },
    { isActive: !disabled },
  );

  const isEmpty = state.inputValue.length === 0;
  const cursor = "\x1b[7m \x1b[27m";
  const inputContent = isEmpty ? cursor : renderInputLine(state.inputValue, state.cursorOffset);

  return (
    <>
      <CommandDropdown state={state} rankedFiltered={rankedFiltered} />
      <Box>
        <Text color={theme.accent.brand}>{"│ "}</Text>
        {isEmpty ? (
          <Text color={theme.text.muted}>{t("cmdInput.placeholder")}</Text>
        ) : (
          <Text>{inputContent}</Text>
        )}
      </Box>
      <HintBar
        leftHint={
          <Box>
            <Text color={theme.text.muted}>{"\u00b7\u00b7\u00b7\u00b7\u00b7\u00b7\u00b7 "}</Text>
            <KeyHint keyLabel="esc" action="cancel" />
          </Box>
        }
        rightHint={
          <Box>
            <KeyHint keyLabel="enter" action="edit/logs" />
            <KeyHint keyLabel="ctrl+u" action="clear" />
            <KeyHint keyLabel="c" action="copy" />
            <KeyHint keyLabel="tab" action="panels" />
            <KeyHint keyLabel="ctrl+←→" action="tabs" />
            <KeyHint keyLabel="ctrl+p" action="commands" />
          </Box>
        }
      />
    </>
  );
}



export function CommandInput(props: CommandInputProps): React.ReactNode {
  const {
    context,
    onCommand,
    confirmState,
    searchState,
    searchValue,
    onSearchChange,
    onSearchSubmit,
    onSearchCancel,
    onConfirmYes,
    onConfirmCancel,
    onCopy,
    onPanelAction,
    navOwner,
    onInputStateChange,
  } = props;

  return (
    <Box
      flexDirection="column"
      height={COMMAND_INPUT_HEIGHT}
      borderStyle="single"
      borderColor={theme.border.dim}
      paddingY={1}
    >
      {searchState?.active ? (
        <SearchMode
          value={searchValue}
          onSearchChange={onSearchChange}
          onSearchSubmit={onSearchSubmit}
          onSearchCancel={onSearchCancel}
          disabled={props.disabled}
        />
      ) : confirmState === null ? (
        <CommandMode context={context} onCommand={onCommand} onCopy={onCopy} onPanelAction={onPanelAction} disabled={props.disabled} navOwner={navOwner} onInputStateChange={onInputStateChange} />
      ) : (
        <ConfirmMode
          confirmState={confirmState}
          onConfirmYes={onConfirmYes}
          onConfirmCancel={onConfirmCancel}
          disabled={props.disabled}
        />
      )}
    </Box>
  );
}
