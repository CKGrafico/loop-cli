## 1. Responsive Board Layout

- [x] 1.1 Give the board composition an explicit full-width layout boundary; preserve wide 60/40 columns, full-width compact/minimal panels, and responsive debug-panel sizing. <!-- agent: frontend-engineer.build, depends_on: [], touches: [src/app/App.tsx, src/widgets/left-panel/LeftPanel.tsx, src/widgets/right-panel/RightPanel.tsx, src/shared/ui/DebugPanel.tsx, DESIGN.md] -->
- [x] 1.2 Make the stacked inspector height content- or flex-allocation-driven while retaining the wide-layout height behavior. <!-- agent: frontend-engineer.build, depends_on: [1.1], touches: [src/widgets/right-panel/RightPanel.tsx] -->

## 2. Regression Coverage

- [x] 2.1 Add Ink layout regression coverage for compact full-width panels, stacked inspector height, minimal inspector omission, and wide 60/40 layout behavior. <!-- agent: frontend-engineer.build, depends_on: [1.1, 1.2], touches: [tests/tui-components.test.tsx] -->

## 3. Verification

- [ ] 3.1 Run typecheck, lint, tests, build, and visual evidence for the compact and wide board layouts. <!-- agent: frontend-engineer.fast, depends_on: [1.1, 1.2, 2.1], touches: [openspec/changes/fix-compact-board-width/evidence/**] -->
