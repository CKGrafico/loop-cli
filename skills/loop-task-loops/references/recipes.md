# Loop Recipes - Pipeline and Label State Machine Vocabulary

> **Interface-specific reference.** This file contains real executable syntax (gh, az, git, opencode, claude). It is the ONLY file in the skills with interface-specific content. Use these as vocabulary when composing multi-loop pipelines - do not copy them verbatim. Adapt the syntax to the user's tooling answers from the pre-design questionnaire.

This file provides patterns for label-based state machines and multi-loop pipeline coordination. The agent reads these to learn how loops coordinate through shared labels, then composes a unique pipeline.

## Label State Machines

Loop Task has no persistent per-item state. Labels on the work items serve as the state machine. Each label represents a stage. Selection Tasks query for a label; finalization/recovery Tasks transition it.

### Standard Lifecycle (pick → doing → pr → done)

```
code:pick ──(selection)──▶ code:doing ──(finalization)──▶ code:pr ──(PR merge)──▶ code:done
                               │
                               └──(recovery)──▶ code:pick (reverted, eligible again)
```

| Stage | Label | Meaning | Who transitions it |
|---|---|---|---|
| Selection | `code:pick` | Eligible for processing | Reservation Task removes, adds `code:doing` |
| In progress | `code:doing` | Claimed, work happening | Finalization Task removes, adds `code:pr` |
| PR open | `code:pr` | PR created, awaiting merge | PR closure Task removes, adds `code:done` |
| Done | `code:done` | Completed | Terminal state |
| Recovery | `code:doing` → `code:pick` | Work failed, reverted | Recovery Task transitions back |

### Simple Lifecycle (pick → doing → done)

```
code:pick ──▶ code:doing ──▶ code:done
                 │
                 └──▶ code:pick (reverted)
```

No PR stage. Useful when work does not produce a PR (e.g., refinement, notification, audit).

### GitHub Issues Label Transitions

```
gh issue edit {{number}} --add-label "code:doing" --remove-label "code:pick"
gh issue edit {{number}} --add-label "code:pr" --remove-label "code:doing"
gh issue edit {{number}} --add-label "code:done" --remove-label "code:pr"
gh issue edit {{number}} --add-label "code:pick" --remove-label "code:doing"  # recovery
```

### Azure DevOps Label Transitions

```
az boards work-item update {{number}} --fields "System.Tags=code:doing" --output json
az boards work-item update {{number}} --fields "System.Tags=code:pr" --output json
az boards work-item update {{number}} --fields "System.Tags=code:done" --output json
az boards work-item update {{number}} --fields "System.Tags=code:pick" --output json  # recovery
```

## Refinement Label State Machine

A separate label namespace for refinement loops. Items are refined before they become implementable.

```
refine:pick ──▶ refine:doing ──▶ refine:questions ──(user answers)──▶ refine:answers
                    │                    ↘
                    │               refine:done ←──(no more questions)
                    │
                    └──▶ refine:redoing ──▶ refine:questions or refine:done
```

### GitHub Issues (Refinement)

```
gh issue edit {{number}} --add-label "refine:doing" --remove-label "refine:pick"
gh issue edit {{number}} --add-label "refine:questions" --remove-label "refine:doing"
gh issue edit {{number}} --add-label "refine:answers" --remove-label "refine:questions"
gh issue edit {{number}} --add-label "refine:redoing" --remove-label "refine:answers"
gh issue edit {{number}} --add-label "refine:done" --remove-label "refine:redoing"
```

## Multi-Loop Pipelines

Loops coordinate through shared labels. One Loop's finalization label is another Loop's selection label. Each Loop runs independently at its own cadence.

### Pipeline: Refine → Implement

```
┌──────────────────┐                     ┌──────────────────┐
│   Refine Loop    │                     │  Implement Loop  │
│  (every 20m)    │                     │   (every 1d)     │
│                  │                     │                  │
│  select          │                     │  select           │
│  refine:pick     │                     │  code:pick        │
│      │           │                     │      │            │
│      ▼           │   finalization      │      ▼            │
│  AI refine       │  adds code:pick ───▶│  AI implement     │
│      │           │                     │      │            │
│      ▼           │                     │      ▼            │
│  finalize        │                     │  finalize         │
│  adds refine:done│                     │  adds code:done   │
└──────────────────┘                     └──────────────────┘
```

The refine Loop's AI Task rewrites the issue and adds the `code:pick` label. The implement Loop's selection Task queries for `code:pick`. They never communicate directly - they coordinate at the label boundary.

### Pipeline: Improvements → Refine → Implement

Three loops forming a production line:

```
Improvements Loop (every 6h)
  │  opencode run "Audit code, create issues with code:pick"
  │  (no chain - single AI task)
  │
  ▼  produces issues with code:pick / refine:pick
  
Refine Loop (every 20m)
  │  selects refine:pick, refines with AI, adds code:pick
  │
  ▼  produces issues with code:pick
  
Implement Loop (Every 1h)
     selects code:pick, implements with AI, creates PR, adds code:done
```

The improvements Loop creates raw work items. The refine Loop turns them into detailed, implementable specifications. The implement Loop turns those into code and PRs. Each runs independently.

### Pipeline with Question Loop (Refinement Re-entry)

When the refine AI has questions, it labels the issue `refine:questions`. The user answers in a comment. A separate re-refine Loop watches for `refine:answers` and re-runs the AI:

```
┌────────────────┐     ┌────────────────┐     ┌────────────────┐
│  Refine Loop   │     │  User answers  │     │ Re-refine Loop │
│  (every 20m)   │     │  (manual)       │     │  (every 10s)   │
│                │     │                │     │                │
│ select         │     │                │     │ select         │
│ refine:pick    │     │                │     │ refine:answers │
│     │          │     │                │     │     │          │
│     ▼          │     │                │     │     ▼          │
│ AI refine      │     │                │     │ AI re-refine   │
│     │          │     │                │     │     │          │
│     ▼          │     │                │     │     ▼          │
│ adds           │     │ removes        │     │ adds           │
│ refine:answers │────▶│ refine:answers ├────▶│ refine:done    │
│ or refine:done │     │ adds comment   │     │ or refine:     │
│                │     │                │     │   questions    │
└────────────────┘     └────────────────┘     └────────────────┘
```

The user transitions the label from `refine:questions` to `refine:answers` by adding a comment and changing the label (manual or via a Task). The re-refine Loop picks it up, reads the comments, and either finalizes or asks more questions.

## Label Transition Table (Quick Reference)

### GitHub Issues (pick → doing → pr → done)

| Transition | Command |
|---|---|
| pick → doing | `gh issue edit {{number}} --add-label "code:doing" --remove-label "code:pick"` |
| doing → pr | `gh issue edit {{number}} --add-label "code:pr" --remove-label "code:doing"` |
| pr → done | `gh issue edit {{number}} --add-label "code:done" --remove-label "code:pr"` |
| doing → pick (recovery) | `gh issue edit {{number}} --add-label "code:pick" --remove-label "code:doing"` |

### Azure DevOps (pick → doing → pr → done)

| Transition | Command |
|---|---|
| pick → doing | `az boards work-item update {{number}} --fields "System.Tags=code:doing" --output json` |
| doing → pr | `az boards work-item update {{number}} --fields "System.Tags=code:pr" --output json` |
| pr → done | `az boards work-item update {{number}} --fields "System.Tags=code:done" --output json` |
| doing → pick (recovery) | `az boards work-item update {{number}} --fields "System.Tags=code:pick" --output json` |

## Composition Principles

1. **Read the questionnaire answers** to determine which executable syntax (gh, az, custom) and which AI runner (opencode, claude, aider) to use.
2. **Read the task recipes** in `loop-task-tasks/references/recipes.md` for the syntax of individual task positions (selection, reservation, AI work, finalization, recovery).
3. **Compose** a unique chain based on the user's label scheme, token efficiency priority, and pipeline structure. Do not copy these recipes verbatim.
4. **The label boundary is the coordination point.** Loops do not communicate directly - they coordinate through shared labels on work items.
5. **Token efficiency determines chain granularity.** Critical = many small concrete tasks. Moderate = hybrid chain. Low = one big AI task.
