import React from "react";
import { Box, Text, useStdout } from "ink";
import type { LoopMeta, RunRecord, Project, TaskDefinition } from "../../types.js";
import { darkTheme as theme, tabAccentColor } from "../../shared/ui/theme.js";
import type { TabName } from "../../app/types.js";
import type { Breakpoint } from "../../shared/hooks/useBreakpoint.js";
import { t } from "../../shared/i18n/index.js";
import { Inspector } from "./Inspector.js";
import { RunHistory } from "./RunHistory.js";
import { FocusableButton } from "../../shared/ui/FocusableButton.js";
import { commandLine } from "../../shared/ui/format.js";

const DIVIDER = "\u2500".repeat(40);

export function RightPanel(props: {
  isFocused: boolean;
  navActive?: boolean;
  activeTab: TabName;
  breakpoint?: Breakpoint;
  loop: LoopMeta | null;
  selectedRunIndex: number;
  onSelectRun: (index: number) => void;
  onOpenRun: (run: RunRecord) => void;
  selectedTask?: TaskDefinition | null;
  allTasks?: TaskDefinition[];
  selectedProject?: Project | null;
  projectLoopCount?: number;
  onProjectEdit?: () => void;
  onProjectDelete?: () => void;
  projects?: Project[];
}): React.ReactNode {
  const {
    isFocused,
    navActive = true,
    activeTab,
    breakpoint = "wide",
    loop,
    selectedRunIndex,
    onSelectRun,
    onOpenRun,
    selectedTask,
    allTasks,
    selectedProject,
    projectLoopCount,
    onProjectEdit,
    onProjectDelete,
    projects,
  } = props;
  const borderColor = isFocused ? tabAccentColor(activeTab) : theme.border.default;
  const { stdout } = useStdout();
  const panelHeight = (stdout?.rows ?? 24) - 8;
  const panelWidth = breakpoint === "wide" ? "40%" : "100%";

  return (
    <Box
      flexDirection="column"
      width={panelWidth}
      height={panelHeight}
      borderStyle="single"
      borderColor={borderColor}
    >
      {activeTab === "projects" ? (
        <ProjectInspector
          project={selectedProject ?? null}
          loopCount={projectLoopCount ?? 0}
          onEdit={onProjectEdit}
          onDelete={onProjectDelete}
        />
      ) : activeTab === "tasks" ? (
        <TaskInspector task={selectedTask ?? null} allTasks={allTasks ?? []} breakpoint={breakpoint} />
      ) : (
        <>
          <Inspector loop={loop} projects={projects} breakpoint={breakpoint} />
          <RunHistory
            loop={loop}
            selectedRunIndex={selectedRunIndex}
            onSelectRun={onSelectRun}
            onOpenRun={onOpenRun}
            isFocused={isFocused}
            navActive={navActive}
            breakpoint={breakpoint}
          />
        </>
      )}
    </Box>
  );
}

function TaskInspector(props: { task: TaskDefinition | null; allTasks: TaskDefinition[]; breakpoint?: Breakpoint }): React.ReactNode {
  const { task, allTasks, breakpoint = "wide" } = props;
  const divLen = breakpoint === "wide" ? 40 : breakpoint === "compact" ? 30 : 20;
  const taskDivider = "\u2500".repeat(divLen);

  if (!task) {
    return (
      <Box flexDirection="column" flexGrow={1} padding={1}>
        <Text color={theme.accent.task} bold>{t("board.taskInspectorTitle")}</Text>
        <Text color={theme.text.muted}>{taskDivider}</Text>
        <Text color={theme.text.muted}>{t("board.taskInspectorEmpty")}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" flexGrow={1} paddingY={0}>
      <Box paddingLeft={1}>
        <Text color={theme.accent.task} bold>{t("board.taskInspectorTitle")}</Text>
      </Box>
      <Box paddingLeft={1}>
        <Text color={theme.text.muted}>{taskDivider}</Text>
      </Box>
      <Box flexDirection="column" paddingLeft={1}>
        <Field label={t("board.taskFieldName")}>
          <Text color={theme.accent.task} bold>{task.name}</Text>
        </Field>
        <Field label={t("board.taskFieldId")}>
          <Text color={theme.text.primary}>{task.id}</Text>
        </Field>
        {breakpoint !== "minimal" ? (
          <Field label={t("board.taskFieldCommand")}>
            <Text color={theme.text.primary}>
              {task.commandRaw
                ? task.commandRaw.split("\n").filter(Boolean).join(" ")
                : commandLine(task.command, task.commandArgs)}
            </Text>
          </Field>
        ) : null}
        {breakpoint === "wide" ? (
          <Field label={t("board.taskFieldCreated")}>
            <Text color={theme.text.primary}>{task.createdAt.slice(0, 10)}</Text>
          </Field>
        ) : null}
        <Field label={t("board.taskFieldChain")}>
          {task.onSuccessTaskId ? (
            <Text color={theme.semantic.success}>{"\u2713 " + (allTasks.find((t) => t.id === task.onSuccessTaskId)?.name ?? task.onSuccessTaskId)}</Text>
          ) : null}
          {task.onFailureTaskId ? (
            <Text color={theme.semantic.danger}>{" \u2192 " + (allTasks.find((t) => t.id === task.onFailureTaskId)?.name ?? task.onFailureTaskId)}</Text>
          ) : null}
          {!task.onSuccessTaskId && !task.onFailureTaskId ? (
            <Text color={theme.text.muted}>{t("board.taskNone")}</Text>
          ) : null}
        </Field>
        <Field label={t("board.taskFieldSilent")}>
          <Text color={task.silentChain ? theme.semantic.warning : theme.text.muted}>
            {task.silentChain ? t("board.silentChainYes") : t("board.silentChainNo")}
          </Text>
        </Field>
      </Box>
      <Box paddingLeft={1}>
        <Text color={theme.text.muted}>{taskDivider}</Text>
      </Box>
    </Box>
  );
}

const LABEL_WIDTH = 9;

function Field(props: { label: string; children: React.ReactNode }): React.ReactNode {
  return (
    <Box>
      <Text bold color={theme.text.muted}>{props.label.padEnd(LABEL_WIDTH)}</Text>
      {props.children}
    </Box>
  );
}

function ProjectInspector(props: {
  project: Project | null;
  loopCount: number;
  onEdit?: () => void;
  onDelete?: () => void;
}): React.ReactNode {
  const { project, loopCount, onEdit, onDelete } = props;

  if (!project) {
    return (
      <Box padding={1} flexGrow={1}>
        <Text color={theme.text.muted}>{t("project.inspectorEmpty")}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" flexGrow={1} padding={1}>
      <Box marginBottom={1}>
        <Text color={project.color} bold>
          {"\u25CF"}
        </Text>
        <Text color={theme.text.primary} bold>
          {" " + project.name}
        </Text>
      </Box>

      <Box>
        <Text color={theme.text.muted}>{t("project.fieldId")}</Text>
        <Text color={theme.text.secondary}>{project.id}</Text>
      </Box>

      <Box>
        <Text color={theme.text.muted}>{t("project.fieldLoops")}</Text>
        <Text color={theme.text.secondary}>
          {t("project.loopCount", { count: String(loopCount) })}
        </Text>
      </Box>

      <Box>
        <Text color={theme.text.muted}>{t("project.fieldCreated")}</Text>
        <Text color={theme.text.secondary}>{project.createdAt.slice(0, 10)}</Text>
      </Box>

      {project.directory && (
        <Box>
          <Text color={theme.text.muted}>{t("project.fieldDirectory")}</Text>
          <Text color={theme.text.secondary}>{project.directory}</Text>
        </Box>
      )}

      {project.isSystem && (
        <Box marginTop={1}>
          <Text color={theme.semantic.warning}>{t("project.systemLabel")}</Text>
        </Box>
      )}

      {!project.isSystem && (
        <Box marginTop={1} flexDirection="row">
          {onEdit && (
            <FocusableButton
              label={`${t("project.editProjectLabel")} (${t("project.keyEditHint")})`}
              color={theme.accent.project}
              onPress={onEdit}
            />
          )}
          {onDelete && (
            <FocusableButton
              label={`${t("project.deleteProjectLabel")} (${t("project.keyDeleteHint")})`}
              color={theme.semantic.danger}
              variant="danger"
              onPress={onDelete}
            />
          )}
        </Box>
      )}
    </Box>
  );
}
