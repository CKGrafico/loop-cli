import type { LoopMeta, Project } from "../../types.js";

export type StatusFilter =
  | "all"
  | "running"
  | "waiting"
  | "paused"
  | "idle";

export type IntervalFilter = "all" | "manual" | "short" | "medium" | "long";

export type ActivityFilter = "all" | "active" | "stale";

export type SortMode = "description" | "status" | "recent" | "created";

export interface Filters {
  status: StatusFilter;
  intervalBucket: IntervalFilter;
  recentActivity: ActivityFilter;
  query: string;
}

export const defaultFilters: Filters = {
  status: "all",
  intervalBucket: "all",
  recentActivity: "all",
  query: "",
};

const statusOrder: Record<LoopMeta["status"], number> = {
  running: 0,
  waiting: 1,
  paused: 2,
  idle: 3,
  stopped: 4,
};

function intervalBucketOf(interval: number): IntervalFilter {
  if (interval === 0) return "manual";
  if (interval <= 60_000) return "short";
  if (interval <= 3_600_000) return "medium";
  return "long";
}

function activityBucketOf(loop: LoopMeta): ActivityFilter {
  const baseline = loop.lastRunAt ?? loop.createdAt;
  const ageMs = Date.now() - new Date(baseline).getTime();
  return ageMs <= 15 * 60_000 ? "active" : "stale";
}

function matches(loop: LoopMeta, filters: Filters): boolean {
  if (filters.status !== "all" && loop.status !== filters.status) {
    return false;
  }

  if (
    filters.intervalBucket !== "all" &&
    intervalBucketOf(loop.interval) !== filters.intervalBucket
  ) {
    return false;
  }

  if (
    filters.recentActivity !== "all" &&
    activityBucketOf(loop) !== filters.recentActivity
  ) {
    return false;
  }

  const query = filters.query.trim().toLowerCase();
  if (!query) {
    return true;
  }

  const haystack = [
    loop.id,
    loop.command,
    ...loop.commandArgs,
    loop.description ?? "",
    loop.status,
    loop.intervalHuman,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function describeLoop(loop: LoopMeta): string {
  return loop.description?.trim() || [loop.command, ...loop.commandArgs].join(" ").trim();
}

function projectSortName(loop: LoopMeta, projects: Project[]): string {
  if (!loop.projectId) return "\uFFFF";
  const proj = projects.find((p) => p.id === loop.projectId);
  return proj?.name ?? "\uFFFF";
}

function compare(left: LoopMeta, right: LoopMeta, sort: SortMode, projects: Project[]): number {
  if (sort === "description") {
    const byProject = projectSortName(left, projects).localeCompare(projectSortName(right, projects));
    if (byProject !== 0) return byProject;
    return describeLoop(left).localeCompare(describeLoop(right));
  }

  if (sort === "created") {
    return right.createdAt.localeCompare(left.createdAt);
  }

  if (sort === "recent") {
    return (right.lastRunAt ?? right.createdAt).localeCompare(
      left.lastRunAt ?? left.createdAt
    );
  }

  const byStatus = statusOrder[left.status] - statusOrder[right.status];
  if (byStatus !== 0) {
    return byStatus;
  }

  const leftNext = left.nextRunAt ?? left.lastRunAt ?? left.createdAt;
  const rightNext = right.nextRunAt ?? right.lastRunAt ?? right.createdAt;
  return rightNext.localeCompare(leftNext);
}

export function applyLoopFilters(
  loops: LoopMeta[],
  filters: Filters,
  sort: SortMode,
  projects: Project[] = []
): LoopMeta[] {
  return loops
    .filter((loop) => matches(loop, filters))
    .sort((left, right) => compare(left, right, sort, projects));
}

const SORT_CYCLE: Record<SortMode, SortMode> = {
  description: "status",
  status: "recent",
  recent: "created",
  created: "description",
};

export function cycleSortMode(mode: SortMode): SortMode {
  return SORT_CYCLE[mode];
}

const STATUS_CYCLE: Record<StatusFilter, StatusFilter> = {
  all: "running",
  running: "waiting",
  waiting: "paused",
  paused: "idle",
  idle: "all",
};

export function cycleStatusFilter(status: StatusFilter): StatusFilter {
  return STATUS_CYCLE[status];
}
