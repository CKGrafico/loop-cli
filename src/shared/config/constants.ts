export const POLL_MS = 1000;

export const TOAST_TIMEOUT_MS = 3500;

export const TOAST_MAX = 4;

export const LOG_LINES_MAX = 500;

export const MAX_LOG_BYTES = 1024 * 1024;

export const MAX_CONTEXT_STDOUT_BYTES = 1024 * 1024;

/** Max bytes for stdout attached to a span attribute (16KB) */
export const MAX_SPAN_OUTPUT_BYTES = 16 * 1024;

export const MAX_LOG_GENERATIONS = 3;

export const MAX_INMEMORY_RUN_HISTORY = 100;

export const MAX_STREAM_INITIAL_BYTES = 256 * 1024;

export const USER_TIMING_SWEEP_MS = 10_000;

export const LOG_MODAL_LINES_MAX = 5000;

export const LOG_LINE_CHARS_MAX = 10_000;

export const FOLLOW_REATTACH_DELAY_MS = 100;

export const FOLLOW_REATTACH_MAX_ATTEMPTS = 20;

export const FOLLOW_READ_BATCH_BYTES = 1024 * 1024;

export const SLEEP_CHUNK_MS = 200;

export const DAEMON_SPAWN_TIMEOUT_MS = 5000;

export const DAEMON_POLL_MS = 100;

export const IPC_TIMEOUT_MS = 10000;

export const LOG_TAIL_DEFAULT = 50;

/** Terminal width >= this shows the wide (side-by-side) two-panel layout. */
export const BOARD_BREAKPOINT_WIDE = 110;

/** Terminal width >= this and < WIDE shows the compact (stacked) single-panel layout. */
export const BOARD_BREAKPOINT_COMPACT = 70;

/** Legacy alias kept for backward compat with any external consumers. */
export const BOARD_BREAKPOINT_WIDTH = BOARD_BREAKPOINT_WIDE;

export const HEADER_COMPACT_WIDTH = 60;

export const SEARCH_SELECT_HEIGHT = 6;


// DECSET 2004: terminal wraps pasted text in ESC[200~ ... ESC[201~ so the
// app can insert it wholesale instead of processing each char as a keypress.
export const BRACKETED_PASTE_ENABLE = "\x1b[?2004h";
export const BRACKETED_PASTE_DISABLE = "\x1b[?2004l";
export const PASTE_MAX_CHARS = 4096;

// DECSET 1000: enable mouse button event tracking (scroll wheel + clicks).
// DECSET 1006: enable SGR extended mouse mode (structured escape sequences
// that are unambiguous and easy to parse, e.g. [<64;col;rowM for scroll up).
export const MOUSE_TRACKING_ENABLE = "\x1b[?1000h\x1b[?1006h";
export const MOUSE_TRACKING_DISABLE = "\x1b[?1006l\x1b[?1000l";

export const HOVER_BG = "#1e3a5f";

export const PROJECT_COLORS: Record<string, string> = {
  white: "#ffffff",
  cyan: "#06b6d4",
  green: "#4ade80",
  yellow: "#facc15",
  orange: "#fb923c",
  pink: "#f472b6",
};

export const PROJECT_COLOR_KEYS = Object.keys(PROJECT_COLORS) as Array<keyof typeof PROJECT_COLORS>;

// Entity theme colors - used for header action buttons and view accents
export const ENTITY_COLORS = {
  loop: "#38bdf8",    // cyan/blue
  task: "#a78bfa",    // purple
  project: "#34d399", // green
} as const;


export const WIZARD_LOOP_REQUIRED_STEPS = 3;
export const WIZARD_LOOP_TOTAL_STEPS = 7;
export const WIZARD_TASK_REQUIRED_STEPS = 2;
export const WIZARD_TASK_TOTAL_STEPS = 4;
export const WIZARD_PROJECT_REQUIRED_STEPS = 1;
export const WIZARD_PROJECT_TOTAL_STEPS = 2;


export const COMMAND_TIER_ACTION = "action";
export const COMMAND_TIER_CONFIRM = "confirm";
export const COMMAND_TIER_GLOBAL = "global";


export const COMMAND_CATEGORY_GLOBAL = "global";
export const COMMAND_CATEGORY_FILTERS = "filters";
export const COMMAND_CATEGORY_LOOP = "loop";
export const COMMAND_CATEGORY_TASK = "task";
export const COMMAND_CATEGORY_PROJECT = "project";


export const CONFIRM_YES = "yes";
export const CONFIRM_CANCEL = "cancel";


export const PANEL_LEFT = "left";
export const PANEL_RIGHT = "right";


export const COMMAND_TEMPLATES: { label: string; command: string; args: string }[] = [
  { label: "npm run", command: "npm", args: "run" },
  { label: "npm test", command: "npm", args: "test" },
  { label: "pnpm build", command: "pnpm", args: "build" },
  { label: "pnpm test", command: "pnpm", args: "test" },
  { label: "yarn build", command: "yarn", args: "build" },
  { label: "dotnet build", command: "dotnet", args: "build" },
  { label: "dotnet test", command: "dotnet", args: "test" },
  { label: "docker compose up", command: "docker", args: "compose up" },
  { label: "make", command: "make", args: "" },
  { label: "shell script", command: "bash", args: "./script.sh" },
];


export const COMMAND_INPUT_HEIGHT = 6;
export const COMMAND_INPUT_DROPDOWN_MAX_VISIBLE = 6;


export const HTTP_API_PORT = 8845;
export const HTTP_API_HOST = "127.0.0.1";


export const EXPORT_MAX_PREVIEW_LINES = 200;

export const CTRL_SHORTCUT_EDIT = "Ctrl+E";
export const CTRL_SHORTCUT_DELETE = "Ctrl+D";


export const CODE_EDITOR_MAX_VISIBLE = 2;
export const CODE_EDITOR_MODAL_HEIGHT = 40;
export const CODE_EDITOR_MODAL_WIDTH = 120;
export const CODE_EDITOR_WRAP_LENGTH = 80;
export const CODE_EDITOR_UNDO_LIMIT = 50;
export const CODE_EDITOR_SYNTAX_COLORS = {
  flag: "#38bdf8",
  string: "#4ade80",
  operator: "#facc15",
  word: "#e5e7eb",
} as const;
