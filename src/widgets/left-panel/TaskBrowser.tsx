import React from "react";
import { Box, Text, useInput } from "ink";
import { ScrollList } from "ink-scroll-list";
import type { TaskDefinition } from "../../types.js";
import { darkTheme as theme } from "../../shared/ui/theme.js";
import { commandLine } from "../../shared/ui/format.js";
import { t } from "../../shared/i18n/index.js";
import { FocusableButton } from "../../shared/ui/FocusableButton.js";
import { useMouseScroll } from "../../shared/hooks/useMouseScroll.js";

const NAME_WIDTH = 24;
const COMMAND_WIDTH = 32;
const LIMIT = 15;

export function TaskNavigator(props: {
  visible: TaskDefinition[];
  total: number;
  selectedIndex: number;
  query: string;
  isFocused: boolean;
  navActive?: boolean;
  allTasks: TaskDefinition[];
  onSelect: (index: number) => void;
  onActivate: (index: number) => void;
}): React.ReactNode {
  const { visible, total, selectedIndex, isFocused, navActive = true, allTasks, onSelect, onActivate } = props;

  const title = t("board.taskBrowserTitle", {
    visible: String(visible.length),
    total: String(total),
  });

  useInput(
    (input, key) => {
      // Swallow SGR mouse sequences so they don't interfere
      if (input.includes("[<")) {
        return;
      }
      if (key.upArrow || input === "k") {
        onSelect(Math.max(selectedIndex - 1, 0));
      } else if (key.downArrow || input === "j") {
        onSelect(Math.min(selectedIndex + 1, visible.length - 1));
      } else if (key.ctrl && key.return) {
        onActivate(selectedIndex);
      }
    },
    { isActive: isFocused && navActive },
  );

  useMouseScroll({
    onScrollUp: () => {
      if (!(isFocused && navActive)) return;
      onSelect(Math.max(selectedIndex - 1, 0));
    },
    onScrollDown: () => {
      if (!(isFocused && navActive)) return;
      onSelect(Math.min(selectedIndex + 1, visible.length - 1));
    },
    isActive: isFocused && navActive,
  });

  function resolveName(id: string | null): string | null {
    if (id === null) return null;
    return allTasks.find((t) => t.id === id)?.name ?? id;
  }

  function chainsLabel(task: TaskDefinition): string {
    const hasSuccess = task.onSuccessTaskId !== null;
    const hasFailure = task.onFailureTaskId !== null;
    if (!hasSuccess && !hasFailure) return t("board.taskChainsNone");
    const successName = hasSuccess ? resolveName(task.onSuccessTaskId) : null;
    const failureName = hasFailure ? resolveName(task.onFailureTaskId) : null;
    return t("board.taskChainsFormat", {
      success: hasSuccess ? `\u2713${successName}` : "-",
      failure: hasFailure ? `\u2192${failureName}` : "-",
    });
  }

  function renderTask(task: TaskDefinition, index: number): React.ReactNode {
    const isSelected = index === selectedIndex;
    const name = task.name.length > NAME_WIDTH
      ? task.name.slice(0, NAME_WIDTH - 3) + "..."
      : task.name.padEnd(NAME_WIDTH);
    const cmd = commandLine(task.command, task.commandArgs);
    const cmdDisplay = cmd.length > COMMAND_WIDTH
      ? cmd.slice(0, COMMAND_WIDTH - 3) + "..."
      : cmd.padEnd(COMMAND_WIDTH);
    const chains = chainsLabel(task);
    const silent = task.silentChain ? " [s]" : "";
    const fg = isSelected ? theme.text.inverse : theme.text.primary;
    return (
      <Box backgroundColor={isSelected ? (isFocused && navActive ? theme.bg.activeTask : isFocused ? theme.bg.hover : undefined) : undefined}>
        <Text color={fg}>{name}</Text>
        <Text color={fg}>{cmdDisplay}</Text>
        <Text color={fg}>{chains}{silent}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingLeft={1}>
        <Text color={theme.text.muted}>{title}</Text>
      </Box>
      {visible.length === 0 ? (
        <Box paddingLeft={1}>
          <Text color={theme.text.muted}>{t("board.taskBrowserEmpty")}</Text>
        </Box>
      ) : (
        <Box flexDirection="column">
          <Box paddingLeft={1}>
            <Text color={theme.text.muted}>{"  "}</Text>
            <Text color={theme.text.muted}>{t("board.taskHeaderName").padEnd(NAME_WIDTH)}</Text>
            <Text color={theme.text.muted}>{t("board.taskHeaderCommand").padEnd(COMMAND_WIDTH)}</Text>
            <Text color={theme.text.muted}>{t("board.taskHeaderChains")}</Text>
          </Box>
          <Box paddingLeft={1}>
            <ScrollList
              height={LIMIT}
              selectedIndex={selectedIndex}
              scrollAlignment="auto"
            >
              {visible.map((task, i) => (
                <React.Fragment key={task.id}>
                  {renderTask(task, i)}
                </React.Fragment>
              ))}
            </ScrollList>
          </Box>
        </Box>
      )}
    </Box>
  );
}

const FIELD_LABEL_WIDTH = 13;

function InspectorField(props: { label: string; children: React.ReactNode }): React.ReactNode {
  return (
    <Box>
      <Text bold color={theme.text.secondary}>{props.label.padEnd(FIELD_LABEL_WIDTH)}</Text>
      <Text color={theme.text.primary}>{props.children}</Text>
    </Box>
  );
}

export function TaskInspector(props: { task: TaskDefinition | null; allTasks: TaskDefinition[] }): React.ReactNode {
  const { task, allTasks } = props;

  if (!task) {
    return (
      <Box borderStyle="single" borderColor={theme.border.default} flexDirection="column">
        <Box paddingLeft={1}>
          <Text color={theme.text.muted}>{t("board.inspectorTitle")}</Text>
        </Box>
        <Box paddingLeft={1}>
          <Text color={theme.text.muted}>{t("board.inspectorEmpty")}</Text>
        </Box>
      </Box>
    );
  }

  const cmd = commandLine(task.command, task.commandArgs);
  const resolveName = (id: string | null): string | null => {
    if (id === null) return null;
    return allTasks.find((t) => t.id === id)?.name ?? id;
  };
  const onSuccess = task.onSuccessTaskId ? resolveName(task.onSuccessTaskId) ?? task.onSuccessTaskId : t("board.taskNone");
  const onFailure = task.onFailureTaskId ? resolveName(task.onFailureTaskId) ?? task.onFailureTaskId : t("board.taskNone");

  return (
    <Box borderStyle="single" borderColor={theme.border.default} flexDirection="column">
      <Box paddingLeft={1}>
        <Text color={theme.text.muted}>{t("board.inspectorTitle")}</Text>
      </Box>
      <Box flexDirection="column" paddingLeft={1}>
        <InspectorField label={t("board.fieldId")}>
          <Text color={theme.text.primary}>{task.id}</Text>
        </InspectorField>
        <InspectorField label={t("board.taskLabelName") + ": "}>
          <Text color={theme.text.primary}>{task.name}</Text>
        </InspectorField>
        <InspectorField label={t("board.taskLabelCommand") + ": "}>
          <Text color={theme.text.primary}>{cmd}</Text>
        </InspectorField>
        <InspectorField label={t("board.taskLabelOnSuccess") + ": "}>
          <Text color={theme.text.primary}>{onSuccess}</Text>
        </InspectorField>
        <InspectorField label={t("board.taskLabelOnFailure") + ": "}>
          <Text color={theme.text.primary}>{onFailure}</Text>
        </InspectorField>
        <InspectorField label={t("board.taskFieldSilent") + ": "}>
          <Text color={task.silentChain ? theme.semantic.warning : theme.text.muted}>
            {task.silentChain ? t("board.silentChainYes") : t("board.silentChainNo")}
          </Text>
        </InspectorField>
      </Box>
    </Box>
  );
}

export function TaskActionButtons(props: {
  task: TaskDefinition | null;
  selectable: boolean;
  onAction: (action: string) => void;
}): React.ReactNode {
  const { task, selectable, onAction } = props;

  const actions = selectable
    ? [
        { key: "select", label: t("board.taskActionSelect") },
        { key: "edit", label: t("board.taskActionEdit") },
        { key: "delete", label: t("board.taskActionDelete") },
      ]
    : [
        { key: "edit", label: t("board.taskActionEdit") },
        { key: "delete", label: t("board.taskActionDelete") },
      ];

  if (!task) {
    return (
      <Box
        borderStyle="single"
        borderColor={theme.border.default}
        flexDirection="row"
        height={3}
        backgroundColor={theme.bg.surface}
      >
        <Text color={theme.text.muted}>{t("board.noActions")}</Text>
      </Box>
    );
  }

  return (
    <Box
      borderStyle="single"
      borderColor={theme.border.default}
      flexDirection="row"
      height={3}
      backgroundColor={theme.bg.surface}
    >
      {actions.map((action) => (
        <FocusableButton
          key={action.key}
          label={action.label}
          color={action.key === "delete" ? theme.semantic.danger : theme.text.secondary}
          variant={action.key === "delete" ? "danger" : "default"}
          onPress={() => onAction(action.key)}
        />
      ))}
    </Box>
  );
}
