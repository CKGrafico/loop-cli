## Why

At compact terminal widths, the board stacks its panels but some panels shrink to their intrinsic content width instead of filling the terminal. This leaves unused space and makes the board harder to scan. The issue is visible now that the three-tier responsive layout is in use.

## What Changes

- Give the board content hierarchy an explicit full-width constraint in stacked layouts.
- Make left, right, and debug panels use responsive width and height rules that fit a stacked board without overflow.
- Add regression coverage for compact and wide terminal layouts.
- Document the three-tier responsive board contract.

## Non-goals

- Changing loop, task, project, IPC, or persistence behavior.
- Redesigning the board's content density, navigation, or breakpoint thresholds.
- Adding mouse interaction or changing terminal color behavior.

## Capabilities

### New Capabilities
- `responsive-board-layout`: Reliable full-width panel layout across wide, compact, and minimal terminal breakpoints.

### Modified Capabilities

- None.

## Impact

- Affects Ink board composition and panel widgets under `src/app/`, `src/widgets/`, and `src/shared/ui/`.
- Adds TUI layout tests and updates `DESIGN.md`.
- No IPC contract, persisted state, dependency, or Windows named-pipe behavior changes.
