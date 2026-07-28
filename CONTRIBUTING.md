# Contributing to loop-task

Thanks for your interest in contributing!

## Requirements

- **Node.js >= 20**, CLI and daemon runtime
- **Bun >= 1.2**, package manager and board runtime (OpenTUI requires Bun's native FFI)

Install Bun: `npm install -g bun`

## Getting started

```bash
git clone https://github.com/PlainConceptsPlatform/loop-task.git
cd loop-task
bun install
npm run build
```

## Development

```bash
bun run dev              # Run the board
bun run dev:watch        # Run the board with auto-reload
bun run test             # Run tests
bun run test:watch       # Run tests in watch mode
bun run test:coverage    # Run tests with coverage
bun run lint             # Lint source and tests
bun run typecheck        # Type check without emitting
npm run build            # Compile to dist/
```

## Commands

| Command | Description |
| ------- | ----------- |
| `loop-task` | Open the interactive board (requires Bun) |
| `loop-task start` | Start the daemon, restore persisted loops |
| `loop-task new <interval> -- <command>` | Create a background loop |
| `loop-task run <interval> -- <command>` | Run a loop in the foreground |

## Architecture

```
src/
├── cli.ts              Commander entry point (Node shebang)
├── entry.js            Node entry wrapper (registers ESM loader)
├── esm-loader.js       Custom Node ESM loader (fixes extensionless imports)
├── daemon/             Background daemon, IPC server, loop manager, state persistence
├── client/             IPC client used by CLI and board
├── board/              OpenTUI + React TUI board
├── core/               LoopController, command runner, log rotator, log parser
├── config/             Constants (POLL_MS, timeouts, etc.)
├── i18n/               User-facing strings (en.json, typed key union)
├── shared/             sleep(), tail(), writeFileAtomic, removeIfExists
└── types.ts            Shared types (LoopMeta, RunRecord, IpcRequest, etc.)
```

The daemon IPC server supports: `start`, `update`, `list`, `status`, `pause`, `resume`, `trigger`, `delete`, `attach`, `logs`, `run-log`, and `shutdown`. The board drives these operations; the CLI only exposes `new` and `run`.

## Product direction

`loop-task` is board-first:

- `loop-task` opens the interactive board
- `loop-task new ...` creates background loops for scripts and shell workflows
- `loop-task run ...` runs a loop in the foreground
- `loop-task start` starts the daemon and restores persisted loops

Loop management actions should prefer the board over adding more CLI commands.

## Running locally

```bash
bun run dev                                            # open the board
node dist/entry.js new --now 30m -- npm test          # background loop
node dist/entry.js run --now --max-runs 1 30s -- echo hello  # foreground
```

Set `LOOP_CLI_HOME` to an alternate directory to isolate daemon state (used by the test suite).

## Code style

- TypeScript strict mode, ESM only
- No comments unless necessary
- Follow existing conventions
- Prefer the board-first command model when changing product behavior
- User-facing strings go through `i18n/en.json` with typed key union

## Pull requests

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Ensure `bun run typecheck`, `bun run lint`, `bun run test`, and `npm run build` pass
5. Open a PR
