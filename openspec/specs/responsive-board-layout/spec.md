# responsive-board-layout Specification

## Purpose
TBD - created by archiving change fix-compact-board-width. Update Purpose after archive.
## Requirements
### Requirement: Compact board panels fill the terminal width
The board SHALL render every visible primary panel at the full available board width when the terminal is in the compact breakpoint (70 through 109 columns).

#### Scenario: Compact loop board
- **WHEN** the board renders at a width from 70 through 109 columns
- **THEN** the loop navigator panel SHALL span the full board width
- **AND** the inspector panel SHALL span the full board width when it is visible

#### Scenario: Compact debug panel
- **WHEN** debug mode is enabled at a compact terminal width
- **THEN** the debug panel SHALL follow the stacked board width rule
- **AND** it SHALL NOT constrain the width of adjacent primary panels

### Requirement: Responsive panel sizing preserves supported layouts
The board SHALL preserve its 60/40 side-by-side layout at wide widths and its inspector omission at minimal widths.

#### Scenario: Wide board
- **WHEN** the board renders at 110 columns or wider
- **THEN** the navigator and inspector SHALL render side-by-side at their configured 60/40 proportions

#### Scenario: Minimal board
- **WHEN** the board renders below 70 columns
- **THEN** the navigator SHALL occupy the available board width
- **AND** the inspector SHALL NOT render

### Requirement: Stacked panels fit their allocated board area
The board SHALL NOT apply the wide-layout viewport-derived right-panel height to the compact stacked layout.

#### Scenario: Compact stacked content
- **WHEN** the board renders in compact mode
- **THEN** the inspector height SHALL be content- or flex-allocation-driven
- **AND** it SHALL NOT reserve a second full viewport of vertical space

