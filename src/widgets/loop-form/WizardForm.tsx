import React, { useState, useCallback, useMemo, useRef } from "react";
import { Box, Text, useInput } from "ink";
import { darkTheme as theme } from "../../shared/ui/theme.js";
import { t } from "../../shared/i18n/index.js";
import { useLoopFormValidation, type CreateField } from "../../shared/hooks/useLoopFormValidation.js";
import { copyToClipboard } from "../../shared/clipboard.js";
import { sanitizePaste } from "../../shared/utils/paste.js";
import { TextField } from "./TextField.js";

export interface WizardStepConfig {
  key: string;
  prompt: string;
  hint: string;
  required: boolean;
  suggestions?: string[];
  inputType?: "text";
  defaultValue?: string;
  skip?: (values: Record<string, string>) => boolean;
  onActivate?: () => void;
  validate?: (value: string) => boolean;
  validationError?: string;
  renderCustom?: (props: {
    value: string;
    isActive: boolean;
    onChange: (value: string) => void;
    onAdvance: () => void;
    onActivate?: () => void;
  }) => React.ReactNode;
}

export interface WizardFormProps {
  title: string;
  steps: WizardStepConfig[];
  onComplete: (values: Record<string, string>) => void;
  onCancel: () => void;
  disabled?: boolean;
}

export function WizardForm(props: WizardFormProps): React.ReactNode {
  const { title, steps, onComplete, onCancel, disabled = false } = props;

  const [values, setValues] = useState<Record<string, string>>({});
  const [activeField, setActiveField] = useState(0);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const { validateField } = useLoopFormValidation();

  const step = steps[activeField];

  const valueFor = useCallback(
    (s: WizardStepConfig): string => values[s.key] ?? s.defaultValue ?? "",
    [values],
  );

  // Resolved values: raw values with defaults filled in.
  // skip() functions must receive these so they work before the user touches a field.
  const resolvedValues = useMemo(() => {
    const result: Record<string, string> = {};
    for (const s of steps) result[s.key] = values[s.key] ?? s.defaultValue ?? "";
    return result;
  }, [steps, values]);

  // Synchronous mirror of resolvedValues  updated inside setValue so
  // findNextField sees the new value immediately, before React re-renders.
  // Without this, onChange("Existing task") + onAdvance() run in the same
  // tick: setValues queues a state update, but findNextField reads stale
  // resolvedValues where taskMode is still "" → taskId is wrongly skipped.
  const computeResolved = (raw: Record<string, string>): Record<string, string> => {
    const result: Record<string, string> = {};
    for (const s of steps) result[s.key] = raw[s.key] ?? s.defaultValue ?? "";
    return result;
  };
  const resolvedValuesRef = useRef<Record<string, string>>(computeResolved({}));

  const setValue = useCallback((key: string, next: string) => {
    resolvedValuesRef.current = computeResolved({ ...resolvedValuesRef.current, [key]: next });
    setValues((prev) => ({ ...prev, [key]: next }));
  }, [steps]);

  const clearError = useCallback((key: string) => {
    setValidationErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const setError = useCallback((key: string, msg: string) => {
    setValidationErrors((prev) => ({ ...prev, [key]: msg }));
  }, []);

  const submit = useCallback(() => {
    const errors: Record<string, string> = {};

    for (const s of steps) {
      if (s.skip && s.skip(resolvedValues)) continue;
      const err = validateField(s.key as CreateField, resolvedValues as Record<CreateField, string>);
      if (err) errors[s.key] = err;
      if (s.validate && !s.validate(valueFor(s))) {
        errors[s.key] = s.validationError ?? t("wizard.validationError");
      }
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      const firstErrorIdx = steps.findIndex((s) => s.key in errors);
      if (firstErrorIdx >= 0) setActiveField(firstErrorIdx);
      return;
    }

    const missing = steps.find(
      (s) => !s.skip?.(values) && s.required && !valueFor(s).trim(),
    );
    if (missing) {
      setActiveField(steps.indexOf(missing));
      return;
    }
    const result: Record<string, string> = {};
    for (const s of steps) {
      if (s.skip && s.skip(resolvedValues)) continue;
      result[s.key] = valueFor(s);
    }
    onComplete(result);
  }, [steps, valueFor, onComplete, resolvedValues]);

  const findNextField = useCallback(
    (from: number, delta: number): number => {
      let next = from + delta;
      const len = steps.length;
      const vals = resolvedValuesRef.current;
      while (next >= 0 && next < len) {
        const candidate = steps[next];
        if (!candidate.skip || !candidate.skip(vals)) return next;
        next += delta;
      }
      return from;
    },
    [steps],
  );

  const moveField = useCallback(
    (delta: number) => {
      if (step) {
        const err = validateField(step.key as CreateField, resolvedValues as Record<CreateField, string>);
        if (err) {
          setError(step.key, err);
          return;
        }
        if (step.validate) {
          const value = valueFor(step);
          if (!step.validate(value)) {
            setError(step.key, step.validationError ?? t("wizard.validationError"));
            return;
          }
        }
        clearError(step.key);
      }

      const next = findNextField(activeField, delta);
      if (next !== activeField) setActiveField(next);
    },
    [step, valueFor, resolvedValues, activeField, findNextField, setError, clearError],
  );

  const visibleSteps = steps.filter((s) => !s.skip || !s.skip(resolvedValues));

  useInput((input, key) => {
    if (input.includes("[<")) return;
    if (key.escape) {
      onCancel();
      return;
    }
    if (key.ctrl && input === "s") {
      submit();
      return;
    }
    if (key.ctrl && input === "y") {
      if (step) {
        copyToClipboard(valueFor(step));
      }
      return;
    }
    if (key.tab) {
      moveField(key.shift ? -1 : 1);
      return;
    }
    if (!step) return;

    if (step.renderCustom) {
      // If onActivate is set, this is a "launch modal" field:
      // Enter opens the modal, everything else is blocked.
      if (step.onActivate) {
        if (key.return) step.onActivate();
      }
      // If no onActivate, the renderCustom component owns its own useInput
      // for text editing (Enter, arrows, backspace). WizardForm only handles
      // Esc / Ctrl+S / Tab which are already caught above.
      return;
    }

    // Text field editing
    if (key.return) {
      moveField(1);
      return;
    }
    if (key.delete || key.backspace) {
      setValue(step.key, valueFor(step).slice(0, -1));
      return;
    }
    // Bracketed paste: content wrapped in ESC[200~ ... ESC[201~
    if (input.includes("\x1b[200~")) {
      setValue(step.key, valueFor(step) + sanitizePaste(input));
      return;
    }
    // Multi-char containing CR/LF with no bracketed markers  ignore
    if (input.length > 1 && (input.includes("\r") || input.includes("\n"))) return;
    // Multi-char printable input = unbracketed single-line paste (e.g. right-click)
    if (input.length > 1 && !key.meta) {
      setValue(step.key, valueFor(step) + sanitizePaste(input));
      return;
    }
    if (input.length === 1 && input >= " " && input <= "~") {
      setValue(step.key, valueFor(step) + input);
    }
  }, { isActive: !disabled });

  const mid = Math.ceil(steps.length / 2);
  const columns: [WizardStepConfig[], number][] = [
    [steps.slice(0, mid), 0],
    [steps.slice(mid), mid],
  ];

  const filledCount = visibleSteps.filter((s) => valueFor(s).trim().length > 0).length;

  function renderField(s: WizardStepConfig, fieldIdx: number): React.ReactNode {
    const isActive = fieldIdx === activeField;
    const val = valueFor(s);
    if (s.skip && s.skip(resolvedValues)) return null;
    return (
      <Box key={s.key} flexDirection="column" marginBottom={1}>
        <Box>
          <Text color={isActive ? theme.accent.brand : theme.text.muted} bold>
            {isActive ? "\u203a " : "  "}
          </Text>
          <Text
            color={isActive ? theme.accent.brand : theme.text.secondary}
            bold
          >
            {s.prompt}
          </Text>
          {s.required ? <Text color={theme.semantic.danger}>*</Text> : null}
        </Box>
        <Box paddingLeft={2} width="100%">
          {s.renderCustom ? (
            s.renderCustom({
              value: val,
              isActive,
              onChange: (next: string) => setValue(s.key, next),
              onAdvance: () => moveField(1),
            })
          ) : (
            <TextField value={val} hint={s.hint} isActive={isActive} />
          )}
        </Box>
        {validationErrors[s.key] ? (
          <Box paddingLeft={2}>
            <Text color={theme.semantic.danger}>{validationErrors[s.key]}</Text>
          </Box>
        ) : null}
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      backgroundColor={theme.bg.surface}
      paddingY={1}
      paddingX={2}
      flexGrow={1}
    >
      <Box justifyContent="space-between" marginBottom={1}>
        <Text color={theme.accent.loop} bold>
          {title}
        </Text>
        <Text color={theme.text.muted}>
          {t("wizard.filled", { filled: filledCount, total: visibleSteps.length })}
          {" . "}
          {t("wizard.footerHints")}
        </Text>
      </Box>

      <Box flexDirection="row" gap={4}>
        {columns.map(([col, offset]) => (
          <Box key={offset} flexDirection="column" width="50%">
            {col.map((s, i) => renderField(s, i + offset))}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
