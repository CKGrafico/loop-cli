# Loop Lifecycle Reference

## State-Transition Diagram

```
                    ┌──────────────────────────────┐
                    │                              │
                    ▼                              │
              ┌──────────┐    execution completes    │
              │ running   │─────────────────────────┤
              └──────────┘                          │
               │  │  │                              │
        pause  │  │  │ stop                         │
               │  │  │                              ▼
               │  │  └───────────────────────▶ ┌────────┐
               │  │                            │  idle   │
               │  │                            └────────┘
               │  │                               │  ▲
               │  │                    play        │  │
               │  │                 (fresh sched)  │  │
               │  ▼                               │  │
               │  ┌──────────┐                    │  │
               │  │  paused   │──────── stop ──────┘  │
               │  └──────────┘                        │
               │     │                                │
               │     │ resume                         │
               │     │ (continues remaining delay)    │
               │     ▼                                │
               │  ┌──────────┐                        │
               └─▶│ waiting  │──────── stop ──────────┘
                  └──────────┘
                   │       ▲
          delay    │       │
          expires  │       │ trigger / cadence cycle
                   ▼       │
                  ┌──────────┐
                  │ running   │ (new iteration)
                  └──────────┘

        maxRuns reached (from running):
          running ──▶ paused (with maxRunsReached=true)
```

## Iteration Lifecycle

### 1. Eligibility check

Before starting an iteration, the Loop checks whether `maxRuns` has been reached. If `runCount >= maxRuns`, the Loop sets `maxRunsReached = true` and enters **paused**. No further iterations start until the flag is cleared.

### 2. Delay and scheduling

- **First iteration, immediate = true**: starts immediately. No delay.
- **First iteration, immediate = false**: computes a phase delay using `computePhase(loopId, cadence)` and waits.
- **First iteration, restored nextRunAt**: waits until that time.
- **Subsequent iterations**: scheduled at `runStartedAtMs + cadence`. Missed points counted in `skippedCount` and skipped.

### 3. Context creation

```
chainContext = { ...task.context, ...loop.context }
```

Task context first, Loop context second (overrides overlapping keys). Not shared with other Loops or iterations.

### 4. Initial Task execution

The initial Task (or inline payload) executes within the resolved working directory.

### 5. Chain execution

If the initial Task defines a successor, the chain continues. See the `loop-task-tasks` skill.

### 6. Iteration recording

Recorded in run history: run number, start time, exit code, duration, log size. Chain steps grouped by `chainGroupId`.

### 7. maxRuns recheck

After recording, the Loop checks again whether `maxRuns` has been reached. If so, it enters **paused**.

### 8. Next scheduling cycle

The Loop calculates the next cadence point and enters **waiting**. The chunked sleep mechanism (200ms granularity) allows responsive pause, trigger, and stop during the wait.

## Pause Semantics

- Pause preserves `remainingDelayMs`. On resume, the delay continues from that point.
- Schedule continues from the original timeline - resuming does not reset.
- `pause(true)` also interrupts a running Task by aborting its subprocess. `pause(false)` lets the current iteration complete before pausing.

## Stop Semantics

Stop clears the schedule: `nextRunAt` and `remainingDelayMs` set to null, `sessionStartedAt` cleared. Status set to `idle`. The loop promise terminates and the running Task is interrupted.

## Play Semantics (from idle)

Play creates a fresh schedule from the current time. `sessionStartedAt` set to now. A new phase delay is computed. `maxRuns` is respected - `playLoop` returns false if `maxRunsReached` is true. Differs from resume, which continues from the interrupted point.

## Trigger Semantics

Trigger forces an immediate iteration regardless of the current delay. If idle, starts a one-shot iteration and returns to idle. If waiting, interrupts the delay and starts immediately. If running, returns false. The remaining delay is saved and restored after the triggered iteration. Triggered iterations count toward `maxRuns`.

## Restoration After Interruption

### What persists

Loop properties (cadence, Task reference, Project, immediate, maxRuns, etc.) and runtime state (status, runCount, maxRunsReached, nextRunAt, remainingDelayMs, runHistory, skippedCount).

### What is lost

The iteration context (always in-memory), any running Task's live output stream, and the running Task itself (interrupted Tasks marked as `completed` in the run history).

### Restoration behaviour

Loops with status `running` or `waiting` are auto-started. Loops that were `paused` or `idle` are restored in that state. Preserved `nextRunAt` and `remainingDelayMs` resume the delay. Running Loops restart fresh (the interrupted Task cannot be resumed mid-execution).

## Manual-Only Loops (intervalHuman = "0")

- Start immediately enters `idle`. No auto-scheduling.
- Each trigger executes one iteration, then returns to `idle`.
- `playLoop` returns false. Manual Loops can only be triggered.
- The `immediate` flag is ignored.
