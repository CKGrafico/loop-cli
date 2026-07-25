import { useState, useMemo, useEffect, useCallback } from "react";
import type { LoopMeta, RunRecord, TaskDefinition, Project } from "../../types.js";
import type { ConfirmState, View, TabName, PanelFocus, SearchState } from "../../app/types.js";
import type { Filters, SortMode } from "../../entities/loops/filters.js";
import { applyLoopFilters, defaultFilters } from "../../entities/loops/filters.js";
import type { ProjectFilters } from "../../entities/projects/filters.js";
import { applyProjectFilters, defaultProjectFilters } from "../../entities/projects/filters.js";
import type { DebugEntry } from "../../shared/ui/DebugPanel.js";
import type { LoopService, TaskService, ProjectService, LogService } from "../../shared/services/types.js";
import { POLL_MS } from "../../shared/config/constants.js";

export interface AppState {
  activeTab: TabName;
  setActiveTab: React.Dispatch<React.SetStateAction<TabName>>;
  focusedPanel: PanelFocus;
  setFocusedPanel: React.Dispatch<React.SetStateAction<PanelFocus>>;
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  sort: SortMode;
  setSort: React.Dispatch<React.SetStateAction<SortMode>>;
  selectedIndex: number;
  setSelectedIndex: React.Dispatch<React.SetStateAction<number>>;
  editTarget: LoopMeta | null;
  setEditTarget: React.Dispatch<React.SetStateAction<LoopMeta | null>>;
  cloneMode: boolean;
  setCloneMode: React.Dispatch<React.SetStateAction<boolean>>;
  editTask: TaskDefinition | null;
  setEditTask: React.Dispatch<React.SetStateAction<TaskDefinition | null>>;
  editProject: Project | null;
  setEditProject: React.Dispatch<React.SetStateAction<Project | null>>;
  pendingTaskSelection: { id: string; name: string } | null;
  setPendingTaskSelection: React.Dispatch<React.SetStateAction<{ id: string; name: string } | null>>;
  selectedRunIndex: number;
  setSelectedRunIndex: React.Dispatch<React.SetStateAction<number>>;
  logModalRun: RunRecord | null;
  setLogModalRun: React.Dispatch<React.SetStateAction<RunRecord | null>>;
  logModalLoopId: string | null;
  setLogModalLoopId: React.Dispatch<React.SetStateAction<string | null>>;
  logModalLines: string[];
  setLogModalLines: React.Dispatch<React.SetStateAction<string[]>>;
  logModalLoading: boolean;
  setLogModalLoading: React.Dispatch<React.SetStateAction<boolean>>;
  tasks: TaskDefinition[];
  setTasks: React.Dispatch<React.SetStateAction<TaskDefinition[]>>;
  taskSelectedIndex: number;
  setTaskSelectedIndex: React.Dispatch<React.SetStateAction<number>>;
  taskQuery: string;
  setTaskQuery: React.Dispatch<React.SetStateAction<string>>;
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  currentProjectId: string;
  setCurrentProjectId: React.Dispatch<React.SetStateAction<string>>;
  projectSelectedIndex: number;
  setProjectSelectedIndex: React.Dispatch<React.SetStateAction<number>>;
  projectFilters: ProjectFilters;
  setProjectFilters: React.Dispatch<React.SetStateAction<ProjectFilters>>;
  commandsBrowserOpen: boolean;
  setCommandsBrowserOpen: React.Dispatch<React.SetStateAction<boolean>>;
  contextHelpOpen: boolean;
  setContextHelpOpen: React.Dispatch<React.SetStateAction<boolean>>;
  exportModal: { json: string; filePath: string | null; error: string | null } | null;
  setExportModal: React.Dispatch<React.SetStateAction<{ json: string; filePath: string | null; error: string | null } | null>>;
  diagramModal: string | null;
  setDiagramModal: React.Dispatch<React.SetStateAction<string | null>>;
  confirmState: ConfirmState | null;
  setConfirmState: React.Dispatch<React.SetStateAction<ConfirmState | null>>;
  searchState: SearchState | null;
  setSearchState: React.Dispatch<React.SetStateAction<SearchState | null>>;
  searchValue: string;
  setSearchValue: React.Dispatch<React.SetStateAction<string>>;
  debugMode: boolean;
  setDebugMode: React.Dispatch<React.SetStateAction<boolean>>;
  debugEntries: DebugEntry[];
  setDebugEntries: React.Dispatch<React.SetStateAction<DebugEntry[]>>;
  chordState: "ctrl+f" | "ctrl+a" | null;
  setChordState: React.Dispatch<React.SetStateAction<"ctrl+f" | "ctrl+a" | null>>;
  commandBarHasText: boolean;
  setCommandBarHasText: React.Dispatch<React.SetStateAction<boolean>>;
  commandBarDropdownOpen: boolean;
  setCommandBarDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useAppState(
  loops: LoopMeta[],
  pushToast: (type: "success" | "error" | "info", message: string) => void,
  refresh: () => void,
  loopService: LoopService,
  taskService: TaskService,
  projectService: ProjectService,
  logService: LogService,
  _view: View,
  _push: (view: View) => void,
  _pop: () => void,
): AppState & {
  visible: LoopMeta[];
  clampedIndex: number;
  selected: LoopMeta | null;
  selectedId: string | null;
  filteredTasks: TaskDefinition[];
  taskClampedIndex: number;
  selectedTask: TaskDefinition | null;
  filteredProjects: Project[];
  projectClampedIndex: number;
  selectedProjectEntity: Project | null;
  projectLoopCount: number;
  refreshTasks: () => Promise<void>;
  refreshProjects: () => Promise<void>;
  runAction: (label: string, action: () => Promise<void>) => () => Promise<void>;
  handleOpenRunLog: (run: RunRecord) => void;
  leftPanelQuery: string;
  handleSearchChange: (value: string) => void;
  handleSearchSubmit: () => void;
  handleSearchCancel: () => void;
  counts: { total: number; running: number; waiting: number; paused: number; idle: number };
  tabCounts: { loops: number; tasks: number; projects: number };
} {
  const [activeTab, setActiveTab] = useState<TabName>("loops");
  const [focusedPanel, setFocusedPanel] = useState<PanelFocus>("left");
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [sort, setSort] = useState<SortMode>("description");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [editTarget, setEditTarget] = useState<LoopMeta | null>(null);
  const [cloneMode, setCloneMode] = useState(false);
  const [editTask, setEditTask] = useState<TaskDefinition | null>(null);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [pendingTaskSelection, setPendingTaskSelection] = useState<{ id: string; name: string } | null>(null);
  const [selectedRunIndex, setSelectedRunIndex] = useState(0);
  const [logModalRun, setLogModalRun] = useState<RunRecord | null>(null);
  const [logModalLoopId, setLogModalLoopId] = useState<string | null>(null);
  const [logModalLines, setLogModalLines] = useState<string[]>([]);
  const [logModalLoading, setLogModalLoading] = useState(false);
  const [tasks, setTasks] = useState<TaskDefinition[]>([]);
  const [taskSelectedIndex, setTaskSelectedIndex] = useState(0);
  const [taskQuery, setTaskQuery] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string>("all");
  const [projectSelectedIndex, setProjectSelectedIndex] = useState(0);
  const [projectFilters, setProjectFilters] = useState<ProjectFilters>(defaultProjectFilters);
  const [commandsBrowserOpen, setCommandsBrowserOpen] = useState(false);
  const [contextHelpOpen, setContextHelpOpen] = useState(false);
  const [exportModal, setExportModal] = useState<{ json: string; filePath: string | null; error: string | null } | null>(null);
  const [diagramModal, setDiagramModal] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [searchState, setSearchState] = useState<SearchState | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [debugMode, setDebugMode] = useState(false);
  const [debugEntries, setDebugEntries] = useState<DebugEntry[]>([]);
  const [chordState, setChordState] = useState<"ctrl+f" | "ctrl+a" | null>(null);
  const [commandBarHasText, setCommandBarHasText] = useState(false);
  const [commandBarDropdownOpen, setCommandBarDropdownOpen] = useState(false);

  const visible = useMemo(
    () => applyLoopFilters(
      currentProjectId === "all" ? loops : loops.filter((l) => (l.projectId ?? "default") === currentProjectId),
      filters, sort, projects
    ),
    [loops, filters, sort, currentProjectId, projects]
  );
  const clampedIndex = Math.min(selectedIndex, Math.max(0, visible.length - 1));
  const selected = visible[clampedIndex] ?? null;
  const selectedId = selected?.id ?? null;

  useEffect(() => { setSelectedRunIndex(0); }, [selected?.id]);

  const filteredTasks = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    if (!taskQuery) return sorted;
    const q = taskQuery.toLowerCase();
    return sorted.filter((t) => `${t.id} ${t.name} ${t.command}`.toLowerCase().includes(q));
  }, [tasks, taskQuery]);
  const taskClampedIndex = Math.min(taskSelectedIndex, Math.max(0, filteredTasks.length - 1));
  const selectedTask = filteredTasks[taskClampedIndex] ?? null;

  const filteredProjects = useMemo(() => applyProjectFilters(projects, loops, projectFilters), [projects, loops, projectFilters]);
  const projectClampedIndex = Math.min(projectSelectedIndex, Math.max(0, filteredProjects.length - 1));
  const selectedProjectEntity = filteredProjects[projectClampedIndex] ?? null;
  const projectLoopCount = selectedProjectEntity
    ? loops.filter((l) => (l.projectId ?? "default") === selectedProjectEntity.id).length
    : 0;

  async function refreshTasks(): Promise<void> {
    try { setTasks(await taskService.list()); } catch { /* ignore */ }
  }
  async function refreshProjects(): Promise<void> {
    try { setProjects(await projectService.list()); } catch { /* ignore */ }
  }
  useEffect(() => { void refreshTasks(); void refreshProjects(); }, []);
  useEffect(() => {
    const timer = setInterval(() => { void refreshTasks(); void refreshProjects(); }, POLL_MS);
    return () => clearInterval(timer);
  }, []);

  function runAction(label: string, action: () => Promise<void>): () => Promise<void> {
    return async () => {
      try { await action(); void refresh(); pushToast("success", label); }
      catch (error) { pushToast("error", error instanceof Error ? error.message : String(error)); }
    };
  }

  function handleOpenRunLog(run: RunRecord): void {
    if (!selectedId) return;
    setLogModalRun(run);
    setLogModalLoopId(selectedId);
    if (run.status === "running") { setLogModalLoading(false); setLogModalLines([]); return; }
    setLogModalLoading(true);
    setLogModalLines([]);
    logService.fetchRunLog(selectedId, run.runNumber)
      .then((log) => { setLogModalLines(log ? log.split("\n").map((l) => l.replace(/\r$/, "")) : []); setLogModalLoading(false); })
      .catch((err: Error) => { setLogModalLines([]); setLogModalLoading(false); pushToast("error", err.message ?? "Failed to load log"); });
  }

  const leftPanelQuery = searchState?.active ? searchValue : activeTab === "tasks" ? taskQuery : filters.query;
  const handleSearchChange = useCallback((value: string) => {
    setSearchValue(value);
    if (activeTab === "tasks") setTaskQuery(value); else setFilters((prev) => ({ ...prev, query: value }));
  }, [activeTab]);
  const handleSearchSubmit = useCallback(() => { setSearchState(null); }, []);
  const handleSearchCancel = useCallback(() => {
    setSearchValue("");
    if (activeTab === "tasks") setTaskQuery(""); else setFilters((prev) => ({ ...prev, query: "" }));
    setSearchState(null);
  }, [activeTab]);

  const counts = {
    total: loops.length, running: loops.filter((l) => l.status === "running").length,
    waiting: loops.filter((l) => l.status === "waiting").length, paused: loops.filter((l) => l.status === "paused").length,
    idle: loops.filter((l) => l.status === "idle").length,
  };
  const tabCounts = { loops: loops.length, tasks: tasks.length, projects: projects.length };

  return {
    activeTab, setActiveTab, focusedPanel, setFocusedPanel,
    filters, setFilters, sort, setSort, selectedIndex, setSelectedIndex,
    editTarget, setEditTarget, cloneMode, setCloneMode,
    editTask, setEditTask, editProject, setEditProject,
    pendingTaskSelection, setPendingTaskSelection, selectedRunIndex, setSelectedRunIndex,
    logModalRun, setLogModalRun, logModalLoopId, setLogModalLoopId,
    logModalLines, setLogModalLines, logModalLoading, setLogModalLoading,
    tasks, setTasks, taskSelectedIndex, setTaskSelectedIndex, taskQuery, setTaskQuery,
    projects, setProjects, currentProjectId, setCurrentProjectId,
    projectSelectedIndex, setProjectSelectedIndex, projectFilters, setProjectFilters,
    commandsBrowserOpen, setCommandsBrowserOpen, contextHelpOpen, setContextHelpOpen,
    exportModal, setExportModal, diagramModal, setDiagramModal, confirmState, setConfirmState,
    searchState, setSearchState, searchValue, setSearchValue,
    debugMode, setDebugMode, debugEntries, setDebugEntries,
    chordState, setChordState, commandBarHasText, setCommandBarHasText, commandBarDropdownOpen, setCommandBarDropdownOpen,
    visible, clampedIndex, selected, selectedId,
    filteredTasks, taskClampedIndex, selectedTask,
    filteredProjects, projectClampedIndex, selectedProjectEntity, projectLoopCount,
    refreshTasks, refreshProjects, runAction, handleOpenRunLog,
    leftPanelQuery, handleSearchChange, handleSearchSubmit, handleSearchCancel,
    counts, tabCounts,
  };
}
