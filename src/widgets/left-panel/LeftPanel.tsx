import React from "react";
import { Box, Text } from "ink";
import type { LoopMeta, TaskDefinition, Project } from "../../types.js";
import type { TabName } from "../../app/types.js";
import type { Filters, SortMode } from "../../entities/loops/filters.js";
import type { ProjectFilters } from "../../entities/projects/filters.js";
import { darkTheme as theme, tabAccentColor } from "../../shared/ui/theme.js";
import { t } from "../../shared/i18n/index.js";
import { Navigator } from "./Navigator.js";
import { TaskNavigator } from "./TaskBrowser.js";
import { FocusableList } from "../../shared/ui/FocusableList.js";

import type { Breakpoint } from "../../shared/hooks/useBreakpoint.js";

function Chip(props: { label: string; value: string; highlighted: boolean }): React.ReactNode {
  const { label, value, highlighted } = props;
  return (
    <Text color={highlighted ? theme.text.primary : theme.text.muted}>
      {label} {value}
    </Text>
  );
}

export function LeftPanel(props: {
  isFocused: boolean;
  navActive?: boolean;
  activeTab: TabName;
  query: string;
  // Loop list props
  loops: LoopMeta[];
  selectedIndex: number;
  filters: Filters;
  sort: SortMode;
  breakpoint: Breakpoint;
  projects: Project[];
  onSelect: (index: number) => void;
  onActivate: (index: number) => void;
  // Task list props
  tasks: TaskDefinition[];
  taskSelectedIndex: number;
  onTaskSelect: (index: number) => void;
  onTaskActivate: (index: number) => void;
  // Optional filter bar controls (for loops tab)
  onStatusCycle?: () => void;
  onSortCycle?: () => void;
  onSelectProject?: () => void;
  currentProjectName?: string;
  // Project list props
  projectFilters?: ProjectFilters;
  projectSelectedIndex?: number;
  onProjectSelect?: (index: number) => void;
  onProjectActivate?: (index: number) => void;
  projectLoops?: LoopMeta[];
}): React.ReactNode {
  const {
    isFocused,
    navActive = true,
    activeTab,
    query,
    loops,
    selectedIndex,
    filters,
    sort,
    breakpoint,
    projects,
    onSelect,
    onActivate,
    tasks,
    taskSelectedIndex,
    onTaskSelect,
    onTaskActivate,
    currentProjectName,
    projectFilters,
    projectSelectedIndex = 0,
    onProjectSelect,
    onProjectActivate,
    projectLoops,
  } = props;

  const accentColor = tabAccentColor(activeTab);
  const borderColor = isFocused ? accentColor : theme.border.default;
  const hasFilter = query.length > 0;

  const loopCountFor = (projectId: string): number =>
    (projectLoops ?? loops).filter((l) => l.projectId === projectId).length;

  const panelWidth = breakpoint === "wide" ? "60%" : "100%";

  return (
    <Box
      flexDirection="column"
      width={panelWidth}
      flexShrink={0}
      borderStyle="single"
      borderColor={borderColor}
    >
      {/* Filter chip line - project · status · sort, non-defaults highlighted */}
      <Box paddingLeft={1} gap={1}>
        {hasFilter ? (
          <Text color={accentColor}>
            {t("board.chipFilter", { query })}
          </Text>
        ) : null}
        {activeTab === "loops" ? (
          <>
            <Chip label={t("board.chipProject")} value={currentProjectName ?? t("board.chipAll")} highlighted={currentProjectName != null} />
            <Text color={theme.text.muted}>·</Text>
            <Chip label={t("board.chipStatus")} value={filters.status} highlighted={filters.status !== "all"} />
            <Text color={theme.text.muted}>·</Text>
            <Chip label={t("board.chipSort")} value={sort} highlighted={sort !== "description"} />
          </>
        ) : null}
        {activeTab === "projects" && projectFilters ? (
          <>
            {projectFilters.query.length > 0 ? (
              <Text color={accentColor}>
                {t("board.chipSearch", { query: projectFilters.query })}
              </Text>
            ) : null}
            <Chip label={t("board.chipLoops")} value={projectFilters.hasLoops} highlighted={projectFilters.hasLoops !== "all"} />
            <Text color={theme.text.muted}>·</Text>
            <Chip label={t("board.chipType")} value={projectFilters.isSystem} highlighted={projectFilters.isSystem !== "all"} />
            <Text color={theme.text.muted}>·</Text>
            <Chip label={t("board.chipSort")} value={projectFilters.sort} highlighted={projectFilters.sort !== "name"} />
          </>
        ) : null}
      </Box>

      {/* Content area based on active tab */}
      {activeTab === "loops" ? (
        <Navigator
          visible={loops}
          total={loops.length}
          selectedIndex={selectedIndex}
          breakpoint={breakpoint}
          projects={projects}
          onSelect={onSelect}
          onActivate={onActivate}
          isFocused={isFocused}
          navActive={navActive}
        />
      ) : activeTab === "tasks" ? (
        <TaskNavigator
          visible={tasks}
          total={tasks.length}
          selectedIndex={taskSelectedIndex}
          query={query}
          onSelect={onTaskSelect}
          onActivate={onTaskActivate}
          isFocused={isFocused}
          navActive={navActive}
          allTasks={tasks}
        />
      ) : (
        <ProjectNavigator
          projects={projects}
          loops={projectLoops ?? loops}
          selectedIndex={projectSelectedIndex}
          onSelect={onProjectSelect ?? (() => {})}
          onActivate={onProjectActivate ?? (() => {})}
          isFocused={isFocused}
          navActive={navActive}
          loopCountFor={loopCountFor}
        />
      )}
    </Box>
  );
}

function ProjectNavigator(props: {
  projects: Project[];
  loops: LoopMeta[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onActivate: (index: number) => void;
  isFocused: boolean;
  navActive?: boolean;
  loopCountFor: (id: string) => number;
}): React.ReactNode {
  const { projects, selectedIndex, onSelect, onActivate, isFocused, navActive = true, loopCountFor } = props;

  if (projects.length === 0) {
    return (
      <Box paddingX={1}>
        <Text color={theme.text.muted}>{t("project.noLoops")}</Text>
      </Box>
    );
  }

  return (
    <FocusableList
      items={projects}
      selectedIndex={selectedIndex}
      isFocused={isFocused}
      navActive={navActive}
      limit={15}
      onSelect={onSelect}
      onActivate={onActivate}
      renderItem={(project, isSelected) => {
        const count = loopCountFor(project.id);
        const fg = isSelected ? theme.text.inverse : theme.text.primary;
        const countFg = isSelected ? theme.text.inverse : theme.text.muted;
        const createdFg = isSelected ? theme.text.inverse : theme.text.muted;
        return (
          <React.Fragment>
            <Text color={project.color}>{"\u25CF"}</Text>
            <Text color={fg}> {project.name.padEnd(18)}</Text>
            <Text color={countFg}>{String(count).padStart(3)} </Text>
            <Text color={createdFg}>{project.createdAt.slice(0, 10)}</Text>
          </React.Fragment>
        );
      }}
    />
  );
}
