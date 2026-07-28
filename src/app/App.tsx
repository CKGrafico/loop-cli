import React, { useMemo, useCallback, useEffect } from "react";
import { Box, useApp } from "ink";
import type { LoopMeta, TaskDefinition } from "../types.js";
import type { View } from "./types.js";
import { useLoopPolling } from "../shared/hooks/useLoopPolling.js";
import { useDaemonSettings } from "../shared/hooks/useDaemonSettings.js";
import { useLogStream } from "../shared/hooks/useLogStream.js";
import { useBreakpoint } from "../shared/hooks/useBreakpoint.js";
import { BoardLayout } from "./BoardLayout.js";
import { useToasts } from "../shared/ui/Toast.js";
import { Header } from "../widgets/header/Header.js";
import { LeftPanel } from "../widgets/left-panel/LeftPanel.js";
import { RightPanel } from "../widgets/right-panel/RightPanel.js";
import { CommandInput } from "../widgets/command-input/CommandInput.js";
import { DebugPanel } from "../shared/ui/DebugPanel.js";
import { useInject } from "../shared/hooks/useInject.js";
import { TYPES } from "../shared/services/types.js";
import type { LoopService, TaskService, ProjectService, LogService, ExportService } from "../shared/services/types.js";
import { cycleSortMode, cycleStatusFilter } from "../entities/loops/filters.js";
import { t } from "../shared/i18n/index.js";
import { darkTheme as theme } from "../shared/ui/theme.js";
import { useRouter } from "./router/index.js";
import { useAppState } from "../features/state/useAppState.js";
import { useCommandHandlers } from "../features/commands/useCommandHandlers.js";
import { useContextualActions } from "../features/commands/useContextualActions.js";
import { useOverlayStack } from "../features/overlays/useOverlayStack.js";
import { useGlobalShortcuts } from "../features/commands/useGlobalShortcuts.js";
import { FormRouter } from "../features/forms/FormRouter.js";
import { OverlayStack } from "../features/overlays/OverlayStack.js";
import { Splash } from "./Splash.js";
import { MOUSE_TRACKING_ENABLE } from "../shared/config/constants.js";

function viewKey(view: View, editTarget: LoopMeta | null, editTask: TaskDefinition | null): string {
  if (view === "create") return `${view}:${editTarget?.id ?? "new"}`;
  if (view === "task-edit") return `${view}:${editTask?.id ?? "new"}`;
  return view;
}

function isBoardView(view: View): boolean {
  return view === "board";
}

export function App(props: { onQuit: () => void }): React.ReactNode {
  const { onQuit } = props;
  const { exit } = useApp();
  const loopService = useInject<LoopService>(TYPES.LoopService);
  const taskService = useInject<TaskService>(TYPES.TaskService);
  const projectService = useInject<ProjectService>(TYPES.ProjectService);
  const logService = useInject<LogService>(TYPES.LogService);
  const exportService = useInject<ExportService>(TYPES.ExportService);
  const { loops, daemonStatus, refresh } = useLoopPolling();
  const daemonSettings = useDaemonSettings();
  const { view, push, pop } = useRouter("board");
  const { toasts, push: pushToast } = useToasts();
  const breakpoint = useBreakpoint();

  // Re-emit DECSET mouse tracking after layout changes or on first render.
  // Ink's internal raw-mode toggling during the initial render cycle and
  // subsequent re-renders (e.g., on resize) can suppress mouse scroll events;
  // re-emitting ensures the terminal re-enables them.
  useEffect(() => {
    process.stdout.write(MOUSE_TRACKING_ENABLE);
  }, [breakpoint]);

  const s = useAppState(loops, pushToast, refresh, loopService, taskService, projectService, logService, view, push, pop);
  useLogStream(s.selectedId, view, (error) => pushToast("error", error.message));

  const { handleCommand } = useCommandHandlers({
    activeTab: s.activeTab, selected: s.selected, selectedRunIndex: s.selectedRunIndex, selectedTask: s.selectedTask, selectedProjectEntity: s.selectedProjectEntity,
    tasks: s.tasks, projects: s.projects, currentProjectId: s.currentProjectId, filters: s.filters, projectFilters: s.projectFilters,
    setCloneMode: s.setCloneMode, setEditTarget: s.setEditTarget, setPendingTaskSelection: s.setPendingTaskSelection,
    setEditTask: s.setEditTask, setEditProject: s.setEditProject, setActiveTab: s.setActiveTab,
    setConfirmState: s.setConfirmState, setCommandsBrowserOpen: s.setCommandsBrowserOpen, setSearchValue: s.setSearchValue, setSearchState: s.setSearchState,
    setFilters: s.setFilters, setSort: s.setSort, setCurrentProjectId: s.setCurrentProjectId,
    setProjectFilters: s.setProjectFilters, setProjectSelectedIndex: s.setProjectSelectedIndex,
    setDebugMode: s.setDebugMode, setExportModal: s.setExportModal, setDiagramModal: s.setDiagramModal,
    push, pop, refresh, refreshTasks: s.refreshTasks, refreshProjects: s.refreshProjects, pushToast,
    loopService, taskService, projectService, exportService, logService,
    runAction: s.runAction, handleOpenRunLog: s.handleOpenRunLog,
  });

  const { handleContextualCopy, triggerContextualAction } = useContextualActions({
    activeTab: s.activeTab, focusedPanel: s.focusedPanel, selected: s.selected, selectedRunIndex: s.selectedRunIndex, selectedTask: s.selectedTask, selectedProjectEntity: s.selectedProjectEntity,
    tasks: s.tasks, push, setCloneMode: s.setCloneMode, setEditTarget: s.setEditTarget, setPendingTaskSelection: s.setPendingTaskSelection,
    handleCommand, handleOpenRunLog: s.handleOpenRunLog, pushToast, isBoardView,
    view, logModalRun: s.logModalRun, commandsBrowserOpen: s.commandsBrowserOpen, confirmState: s.confirmState, searchState: s.searchState,
    setChordState: s.setChordState, chordState: s.chordState,
  });

  const { popLayer, anyModalOpen, commandInputDisabled, inputOwner } = useOverlayStack({
    confirmState: s.confirmState, setConfirmState: s.setConfirmState, searchState: s.searchState, setSearchState: s.setSearchState, setSearchValue: s.setSearchValue,
    logModalRun: s.logModalRun, setLogModalRun: s.setLogModalRun, logModalLoopId: s.logModalLoopId, setLogModalLoopId: s.setLogModalLoopId,
    commandsBrowserOpen: s.commandsBrowserOpen, setCommandsBrowserOpen: s.setCommandsBrowserOpen, exportModal: s.exportModal, setExportModal: s.setExportModal,
    diagramModal: s.diagramModal, setDiagramModal: s.setDiagramModal,
    contextHelpOpen: s.contextHelpOpen, setContextHelpOpen: s.setContextHelpOpen, view, pop, onQuit, exit,
    commandBarHasText: s.commandBarHasText, commandBarDropdownOpen: s.commandBarDropdownOpen,
  });

  useGlobalShortcuts({
    activeTab: s.activeTab, focusedPanel: s.focusedPanel, setFocusedPanel: s.setFocusedPanel, setActiveTab: s.setActiveTab,
    view, handleCommand, triggerContextualAction, popLayer,
    anyModalOpen, debugMode: s.debugMode, setDebugEntries: s.setDebugEntries, inputOwner,
    confirmState: s.confirmState, searchState: s.searchState, logModalRun: s.logModalRun, commandsBrowserOpen: s.commandsBrowserOpen, exportModal: s.exportModal,
    diagramModal: s.diagramModal,
    contextHelpOpen: s.contextHelpOpen, setContextHelpOpen: s.setContextHelpOpen, onQuit, exit, setConfirmState: s.setConfirmState,
    setLogModalRun: s.setLogModalRun, setLogModalLoopId: s.setLogModalLoopId, setCommandsBrowserOpen: s.setCommandsBrowserOpen,
    chordState: s.chordState, setChordState: s.setChordState,
  });

  const handleConfirmYes = useCallback(() => { if (s.confirmState) { s.confirmState.onConfirm(); s.setConfirmState(null); } }, [s.confirmState]);
  const handleConfirmCancel = useCallback(() => { s.setConfirmState(null); }, []);

  const cancelCreate = () => { s.setEditTarget(null); s.setCloneMode(false); s.setPendingTaskSelection(null); pop(); };
  const cancelTask = () => { s.setEditTask(null); pop(); };
  const cancelProject = () => { s.setEditProject(null); pop(); };
  const handleChooseTask = (task: { id: string; name: string }) => { s.setPendingTaskSelection(task); };
  const onCreateDone = (updated: boolean, _id: string, desc: string) => {
    s.setEditTarget(null); s.setCloneMode(false); s.setPendingTaskSelection(null); pop();
    pushToast("success", updated ? t("board.toastUpdated", { desc }) : t("board.toastStarted", { desc }));
    void refresh();
  };
  const onTaskDone = (updated: boolean, id: string) => {
    s.setEditTask(null); void s.refreshTasks(); pop();
    pushToast("success", updated ? t("board.toastTaskUpdated", { id }) : t("board.toastTaskCreated", { id }));
  };
  const onProjectDone = (updated: boolean, name: string) => {
    s.setEditProject(null); void s.refreshProjects(); pop();
    pushToast("success", updated ? t("project.toastUpdated", { name }) : t("project.toastCreated", { name }));
  };

  const commandContext = useMemo(
    () => ({ activeTab: s.activeTab, selectedLoop: s.selected, selectedTask: s.selectedTask, selectedProject: s.selectedProjectEntity }),
    [s.activeTab, s.selected, s.selectedTask]
  );

  if (daemonStatus === "starting") {
    return React.createElement(Splash);
  }

  return (
    <Box flexDirection="column" width="100%" height={process.stdout.rows || 24} backgroundColor={theme.bg.base}>
      <Header daemonStatus={daemonStatus} httpApiEnabled={daemonSettings.reachable ? daemonSettings.httpApiEnabled : undefined} mcpApiEnabled={daemonSettings.reachable ? daemonSettings.mcpApiEnabled : undefined} telemetryEnabled={daemonSettings.reachable ? daemonSettings.telemetryEnabled : undefined} counts={s.counts} activeTab={s.activeTab} onTabChange={s.setActiveTab} tabCounts={s.tabCounts} />
      <Box key={viewKey(view, s.editTarget, s.editTask)} flexGrow={1} width="100%">
        {isBoardView(view) ? (
          <BoardLayout breakpoint={breakpoint}>
            <LeftPanel
              isFocused={(breakpoint === "minimal" || s.focusedPanel === "left") && !anyModalOpen} navActive={inputOwner === "panel"}
              activeTab={s.activeTab} query={s.leftPanelQuery} loops={s.visible} selectedIndex={s.clampedIndex}
              filters={s.filters} sort={s.sort} breakpoint={breakpoint} projects={s.filteredProjects}
              onSelect={(i) => s.setSelectedIndex(i)} onActivate={(i) => { s.setSelectedIndex(i); }}
              tasks={s.filteredTasks} taskSelectedIndex={s.taskClampedIndex}
              onTaskSelect={(i) => s.setTaskSelectedIndex(i)}
              onTaskActivate={(i) => { s.setTaskSelectedIndex(i); s.setEditTask(s.filteredTasks[i] ?? null); push("task-edit"); }}
              onStatusCycle={() => s.setFilters((prev) => ({ ...prev, status: cycleStatusFilter(prev.status) }))}
              onSortCycle={() => s.setSort(cycleSortMode(s.sort))}
              onSelectProject={() => s.setActiveTab("projects")}
              currentProjectName={s.currentProjectId === "all" ? t("project.showAll") : (s.projects.find(p => p.id === s.currentProjectId)?.name ?? "Default")}
              projectFilters={s.projectFilters} projectSelectedIndex={s.projectClampedIndex}
              onProjectSelect={(i) => s.setProjectSelectedIndex(i)} onProjectActivate={(i) => { s.setProjectSelectedIndex(i); }}
              projectLoops={loops}
            />
            {breakpoint !== "minimal" ? (
              <RightPanel
                breakpoint={breakpoint}
                isFocused={s.focusedPanel === "right" && !anyModalOpen} navActive={inputOwner === "panel"}
                activeTab={s.activeTab} loop={s.selected} selectedRunIndex={s.selectedRunIndex}
                onSelectRun={(i) => s.setSelectedRunIndex(i)} onOpenRun={s.handleOpenRunLog}
                selectedTask={s.selectedTask} allTasks={s.tasks}
                selectedProject={s.selectedProjectEntity} projectLoopCount={s.projectLoopCount} projects={s.projects}
                onProjectEdit={() => { if (s.selectedProjectEntity && !s.selectedProjectEntity.isSystem) handleCommand("edit"); }}
                onProjectDelete={() => { if (s.selectedProjectEntity && !s.selectedProjectEntity.isSystem) handleCommand("delete"); }}
              />
            ) : null}
            {s.debugMode ? <DebugPanel breakpoint={breakpoint} entries={s.debugEntries} /> : null}
          </BoardLayout>
        ) : (
          <FormRouter view={view} editTarget={s.editTarget} cloneMode={s.cloneMode}
            editTask={s.editTask} editProject={s.editProject} pendingTaskSelection={s.pendingTaskSelection}
            tasks={s.tasks} projects={s.projects} currentProjectId={s.currentProjectId}
            cancelCreate={cancelCreate} onCreateDone={onCreateDone} handleChooseTask={handleChooseTask}
            cancelTask={cancelTask} onTaskDone={onTaskDone} cancelProject={cancelProject} onProjectDone={onProjectDone}
          />
        )}
      </Box>
      {isBoardView(view) ? (
        <CommandInput context={commandContext} onCommand={handleCommand}
          confirmState={s.confirmState} searchState={s.searchState} searchValue={s.searchValue}
          onSearchChange={s.handleSearchChange} onSearchSubmit={s.handleSearchSubmit} onSearchCancel={s.handleSearchCancel}
          onConfirmYes={handleConfirmYes} onConfirmCancel={handleConfirmCancel}
          onCopy={handleContextualCopy} onPanelAction={triggerContextualAction}
          disabled={commandInputDisabled} navOwner={inputOwner}
          onInputStateChange={(hasText, dropdownOpen) => { s.setCommandBarHasText(hasText); s.setCommandBarDropdownOpen(dropdownOpen); }}
        />
      ) : null}
      <OverlayStack
        commandsBrowserOpen={s.commandsBrowserOpen} commandContext={commandContext}
        onCommandsBrowserClose={() => s.setCommandsBrowserOpen(false)}
        onCommandsBrowserExecute={(v) => { s.setCommandsBrowserOpen(false); handleCommand(v); }}
        contextHelpOpen={s.contextHelpOpen} onContextHelpClose={() => s.setContextHelpOpen(false)}
        exportModal={s.exportModal} onExportModalClose={() => s.setExportModal(null)}
        onExportCopy={() => pushToast("success", t("board.toastCopied"))}
        diagramModal={s.diagramModal} onDiagramModalClose={() => s.setDiagramModal(null)}
        logModalRun={s.logModalRun} logModalLoopId={s.logModalLoopId}
        logModalLines={s.logModalLines} logModalLoading={s.logModalLoading}
        onLogModalClose={() => { s.setLogModalRun(null); s.setLogModalLoopId(null); }}
        onLogCopy={() => pushToast("success", t("board.toastCopied"))}
        toasts={toasts}
      />
    </Box>
  );
}
