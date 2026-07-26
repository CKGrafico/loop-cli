## Context

The board uses Ink flex layout with three responsive breakpoints: wide (`>=110` columns), compact (`70-109`), and minimal (`<70`). Wide mode is a 60/40 row. Compact mode switches to a column, but its immediate content ancestors do not own an explicit width. Ink/Yoga can therefore resolve descendant percentage widths against content-sized parents, leaving panels narrower than the terminal. `RightPanel` also uses a viewport-derived fixed height that is appropriate beside the list, not below it.

## Goals / Non-Goals

**Goals:**
- Make every visible compact board panel span the board's terminal width.
- Preserve the current wide-mode 60/40 split and minimal-mode inspector omission.
- Prevent fixed right-panel height from creating avoidable stacked-layout overflow.
- Cover breakpoint layout behavior with deterministic Ink tests.

**Non-Goals:**
- Change breakpoint thresholds, board navigation, data content, or IPC contracts.
- Rework list virtualization, terminal scrolling, or the visual theme.

## Decisions

### Explicit board width at the layout boundary

The App-level content wrapper and board container will explicitly own `width="100%"` in board mode. Responsive children will use the width supplied by that known parent instead of relying on cross-axis stretch or an auto-sized percentage containing block.

Alternative: rely on Ink's default stretch behavior. Rejected because the reported rendering demonstrates that this is not stable for the nested percentage-width layout.

### Layout-aware panel sizing

LeftPanel and RightPanel will retain percentage widths only in wide mode. In compact and minimal modes, they will take the full width of the explicit board container. The right panel will not use its desktop viewport-derived height while stacked; its height will be content- or flex-allocation-driven. DebugPanel will use a full-width stacked presentation, or be constrained consistently with the board layout.

Alternative: duplicate compact panel components with fixed character widths. Rejected because it duplicates behavior and would fail on terminal resize.

### Rendered-layout regression tests

Tests will render the relevant board hierarchy inside a sized Ink container at representative compact and wide widths. They will assert full-width compact borders, retained wide split behavior, and absence of a second viewport-sized stacked panel.

Alternative: manual terminal-only verification. Rejected because resize regressions are easy to reintroduce and the failure is layout-specific.

## Risks / Trade-offs

- [Ink test renderer differs from user terminals] → Test explicit container constraints and retain manual visual evidence at representative dimensions.
- [Removing fixed compact height changes visible run-history density] → Preserve fixed sizing in wide mode and verify compact output remains navigable.
- [Debug output adds height in compact mode] → Apply the same stack sizing rule and verify its behavior explicitly.

## Migration Plan

1. Update composition and responsive panel sizing.
2. Add regression tests and run full quality gates.
3. Capture CLI/TUI evidence at compact and wide dimensions.

Rollback is a source-only revert; no stored data, API, or daemon migration is involved.

## Open Questions

- None. The screenshot and current layout tree identify a concrete containment and height-allocation defect.
