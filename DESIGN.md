---
tokens:
  colors:
    # Primary colors - 4 entity accents that drive the entire palette
    brand:
      value: "#fbbf24"
      description: "App name, input bar accent, generic UI elements, modal borders, command palette highlights"
    brand_light:
      value: "#d97706"
      description: "Light theme brand variant"
    loop:
      value: "#38bdf8"
      description: "Loops tab: panel borders, selected row indicator, status dots, title text"
    loop_light:
      value: "#0284c7"
      description: "Light theme loop variant"
    task:
      value: "#a78bfa"
      description: "Tasks tab: panel borders, selected row indicator, chain editor accent"
    task_light:
      value: "#7c3aed"
      description: "Light theme task variant"
    project:
      value: "#34d399"
      description: "Projects tab: panel borders, selected row indicator, search mode accent"
    project_light:
      value: "#059669"
      description: "Light theme project variant"

    # Semantic colors - status-driven, not decorative
    semantic:
      success:
        value: "#4ade80"
        description: "Exit code 0, running status spinner, success toasts, streak indicators"
      success_light:
        value: "#16a34a"
      warning:
        value: "#facc15"
        description: "Paused status, warning toasts, debug panel border, last-failure indicator"
      warning_light:
        value: "#ca8a04"
      danger:
        value: "#f87171"
        description: "Exit code non-zero, stopped status, destructive actions, confirm mode accent bar, error toasts"
      danger_light:
        value: "#dc2626"
      idle:
        value: "#fb923c"
        description: "Idle loop status, pending action indicator"
      idle_light:
        value: "#ea580c"

    # Status-to-color mapping (derived from semantic palette)
    status:
      running:
        value: "#4ade80"
        description: "Maps to semantic.success"
      waiting:
        value: "#6b7280"
        description: "Maps to text.muted"
      paused:
        value: "#facc15"
        description: "Maps to semantic.warning"
      idle:
        value: "#fb923c"
        description: "Maps to semantic.idle"
      stopped:
        value: "#f87171"
        description: "Maps to semantic.danger"

    # Background scale - 6 tones from near-black to input surface
    bg:
      base:
        value: "#0a0e14"
        description: "Root application background"
      surface:
        value: "#111827"
        description: "Panel backgrounds, debug panel"
      elevated:
        value: "#1e293b"
        description: "Modal backgrounds, toast backgrounds, command browser"
      hover:
        value: "#1e3a5f"
        description: "Hover background overlay (defined, minimal usage)"
      active:
        value: "#1e3a8a"
        description: "Selected row background, focused button fill, dropdown focused row"
      input:
        value: "#0f172a"
        description: "Focused input field background"

    # Text scale - 4 tones from primary to inverse
    text:
      primary:
        value: "#e5e7eb"
        description: "Normal text content, field values, list items"
      secondary:
        value: "#9ca3af"
        description: "Labels, secondary descriptions"
      muted:
        value: "#6b7280"
        description: "Hints, placeholders, column headers, status bar labels, dot separators"
      inverse:
        value: "#ffffff"
        description: "Text on active/selected backgrounds (high contrast)"

    # Border scale - 2 tones
    border:
      default:
        value: "#1e293b"
        description: "Panel borders at rest, unfocused state"
      dim:
        value: "#374151"
        description: "Unfocused input/button borders, command input container border"

  # Spacing scale - character-width units for terminal layout
  spacing:
    xs:
      value: 1
      description: "Tight padding inside list items, between indicator and content"
    sm:
      value: 1
      description: "Padding left/right inside panels, gap between tab labels"
    md:
      value: 2
      description: "Modal padding, form field spacing"
    lg:
      value: 4
      description: "Welcome screen padding"
    xl:
      value: 4
      description: "Maximum spacing unit"

  # Layout dimensions
  layout:
    left_panel_width:
      value: "60%"
      description: "Left panel (list) width with flexShrink=0"
    right_panel_width:
      value: "40%"
      description: "Right panel (detail) width"
    debug_panel_width:
      value: "22%"
      description: "Debug panel width when debug mode is on"
    command_input_height:
      value: 6
      description: "Bottom command input total height in rows"
    dropdown_max_visible:
      value: 6
      description: "Maximum visible items in command autocomplete dropdown"
    modal_default_width:
      value: "60%"
      description: "Default modal width"
    log_modal_width:
      value: "95%"
      description: "Log viewer modal width"
    commands_browser_width:
      value: 56
      description: "Commands browser modal width in characters"

  # Typography
  typography:
    font_family:
      value: "monospace"
      description: "Terminal system default monospace font"
    heading:
      weight: "bold"
      description: "Tab labels, modal titles, app name, section headers"
    body:
      weight: "normal"
      description: "List items, field values, input text"
    hint:
      weight: "normal"
      fg: "#6b7280"
      description: "Placeholders, key hints, status labels"

  # Borders
  borders:
    panel:
      style: "single"
      description: "Single-line box drawing for LeftPanel, RightPanel, Navigator lists"
    modal:
      style: "round"
      description: "Rounded corners for modal dialogs, toast notifications"
    accent_bar:
      char: "│"
      description: "Left vertical accent bar in CommandInput (brand color for command mode, danger for confirm, project green for search)"

  # Elevation
  elevation:
    base:
      bg: "#0a0e14"
      description: "Root level"
    surface:
      bg: "#111827"
      description: "Panel level"
    elevated:
      bg: "#1e293b"
      description: "Modal overlay level"
    floating:
      position: "absolute"
      description: "Toasts (bottom-right) and command dropdown (above input) use absolute positioning to float over content"

  # Motion (terminal has no CSS animations; spinners are the only motion)
  motion:
    spinner:
      type: "dots"
      description: "ink-spinner dots animation for running loops inline in the list"
    spinner_color:
      value: "#4ade80"
      description: "Green semantic.success for running status spinner"
    toast_timeout:
      value: 3500
      unit: "ms"
      description: "Auto-dismiss duration for toast notifications"
    toast_max:
      value: 4
      description: "Maximum simultaneous visible toasts"
---

# Design System

## Design Philosophy

loop-task is a **command-first terminal application** built on Ink 7 + React 19. The design rejects the "web app in a terminal" metaphor in favor of CLI-native patterns: a persistent command input at the bottom, keyboard-only navigation, and inline information density.

Inspired by `lazygit`, Claude Code, and `gh`, the UI prioritizes:
- **Always-focused input** at the bottom where all actions begin
- **Tab-based context switching** (Loops / Tasks / Projects) with distinct accent colors
- **Two-panel layout** (list left, detail right) with Tab cycling between them
- **Floating elements** (toasts, dropdowns, modals) that overlay content without pushing layout
- **Minimal chrome** - one status line header, one hint line footer, no decorative borders

## Color Philosophy

The palette is intentionally limited to **4 primary colors + 4 semantic + grays**. No decorative colors exist outside this set.

- **Brand** (amber `#fbbf24`) is the generic accent for UI elements that don't belong to a specific entity: app name, input bar, modal borders, command palette highlights.
- **Loop** (blue `#38bdf8`), **Task** (purple `#a78bfa`), **Project** (green `#34d399`) are entity-specific. When the active tab changes, the panel borders, filter labels, and selected-row indicators all shift to the active entity's color via `tabAccentColor()`.
- **Semantic** colors (success/warning/danger/idle) are reserved for status communication - never decorative.
- **Grays** form a 6-tone background scale and 4-tone text scale. Selected rows use `bg.active` with `text.inverse` for maximum contrast.

## Layout Architecture

The board view is a vertical stack:

1. **Header** (3 rows): App name + tagline, daemon status + loop counts + tab bar, separator line
2. **Content area** (flexGrow, full terminal width): Wide terminals (`>=110` columns) use a LeftPanel (60%) + RightPanel (40%) row. Compact terminals (`70-109` columns) stack full-width panels. Minimal terminals (`<70` columns) show the full-width navigator only. DebugPanel follows the active layout direction.
3. **Command input** (6 rows): Bordered box with accent bar, input line with inline placeholder, and hint bar

### Panel Focus Model

Panels receive focus via the `isFocused` prop (not Ink's native `useFocus()`). When focused:
- Panel border shifts to the active tab's accent color
- Arrow keys navigate within that panel's list
- Tab/Shift+Tab toggles between left and right panels (never into header or input)

When any modal is open, `isFocused` is false for both panels - blocking all arrow key input from reaching the lists behind the modal.

## Command Input

The bottom input is the heart of the interaction model. It has three modes, each with a distinct accent bar color:

- **Command mode** (amber `│`): Fuzzy autocomplete via `ink-combobox` headless hooks. Dropdown floats above the input with `position="absolute"`. Placeholder: "Start typing an action or say help..."
- **Confirm mode** (red `│`): Destructive commands transition here. Shows the confirmation prompt, offers yes/cancel options. No text input - only navigation.
- **Search mode** (green `│`): Typing "search" + Enter transitions here. Filters the active list in real-time. Placeholder: "Write something to filter about..."

The input ignores all Ctrl key combos (`if (key.ctrl) return`) - these are handled by the global `useInput` in App.tsx for shortcuts like Ctrl+N (new), Ctrl+E (edit), Ctrl+D (delete), Ctrl+P (commands browser), Ctrl+Enter (panel action), Ctrl+Arrow (tab switching).

Only single printable ASCII characters (`input.length === 1 && input >= " " && input <= "~"`) are inserted as text - this prevents multi-char sequences like `\r\n` (VS Code Ctrl+Enter) from injecting newlines.

## Forms

- **Create**: `WizardForm` - one field per screen with breadcrumb progress. Ctrl+S skips optional fields. Esc goes back one step (or cancels from step 1). Uses `FocusableInput` for text steps and arrow-key select for suggestion steps.
- **Edit**: `PatchEditForm` - read-only labeled table of all current values. The command input suggests `change <field>` commands. Selecting one activates that row's inline input. Pending changes shown with a `●` indicator and count in the header. `save` commits, `cancel` discards.

## Floating Elements

- **Toasts**: `position="absolute" bottom={0} right={0}` - float over content in the bottom-right corner. Round border, elevated background, auto-dismiss after 3.5s. Max 4 visible.
- **Command dropdown**: `position="absolute" bottom={3}` - floats above the input row without pushing layout. Selected row uses `bg.active` highlight.
- **Modals**: `position="absolute"` centered overlays with `borderStyle="round"`. Escape to close. CommandsBrowserModal is centered with search + grouped command list.
- **DebugPanel**: Optional 22% right column (toggled via "debug" command). Shows last 12 keypresses with char codes and modifier flags. Warning-yellow border.

## Key Hints

The hint bar at the bottom of the command input shows contextual shortcuts:
- Left side: `······· esc cancel` (dots as visual separator)
- Right side: `tab panels  ctrl+p commands` (command mode), `enter confirm` (confirm mode), `enter apply` (search mode)

Key hints use bold for the key label and muted for the action description.

## Status Indicators

Loop status is communicated via color:
- Running loops show a green `ink-spinner` (dots animation) inline in the list row
- Status text in the list uses semantic colors (running=green, waiting=muted, paused=yellow, idle=orange, stopped=red)
- Run history sparkline uses blue bars with success/danger streak indicators
- Run exit codes use checkmark (`✓` green) or cross (`✗` red) icons

## Constraints

- **No mouse** - Ink has no mouse API. All interaction is keyboard.
- **No CSS animations** - Terminal rendering. The only motion is `ink-spinner`.
- **Terminal-width dependent** - Responsive breakpoints: wide (`>=110` columns) uses side-by-side panels; compact (`70-109`) stacks full-width navigator and inspector panels; minimal (`<70`) shows only the full-width navigator.
- **Color compatibility** - Uses 24-bit ANSI true color. Falls back gracefully on terminals without true color support via Ink's color handling.
