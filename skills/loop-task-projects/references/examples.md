# Project Examples

All examples use a conceptual YAML-like notation. **This is not a real configuration format.**

---

## Example 1: Microservice-Oriented Project Layout

```yaml
projects:
  - name: User Service
    color: "#3b82f6"
    directory: /services/user-service

  - name: Payment Service
    color: "#22c55e"
    directory: /services/payment-service

  - name: Notification Service
    color: "#8b5cf6"
    directory: /services/notification-service

loops:
  - purpose: Sync user data from upstream
    project: User Service
    cadence: Every 1h
    initial-task: sync-users

  - purpose: Process pending payments
    project: Payment Service
    cadence: Every 15m
    initial-task: process-payments

  - purpose: Send pending notifications
    project: Notification Service
    cadence: Every 5m
    initial-task: send-notifications
```

Each Project corresponds to one microservice. Its Loops operate on that service's resources.

---

## Example 2: Environment-Based Layout

```yaml
projects:
  - name: Production
    color: "#ef4444"
    directory: /envs/production

  - name: Staging
    color: "#eab308"
    directory: /envs/staging

loops:
  - purpose: Health check
    project: Production
    cadence: Every 5m
    initial-task: check-health

  - purpose: Health check
    project: Staging
    cadence: Every 15m
    initial-task: check-health
```

Both Loops reference the same Task (`check-health`) but operate in different directories. The Task's executable payload is the same; the working directory differs based on the Project.

---

## Example 3: Deletion and Reassignment

```yaml
before deletion:
  projects:
    - name: Legacy Pipeline
      color: "#6b7280"
      directory: /pipelines/legacy

  loops:
    - purpose: Run legacy ETL
      project: Legacy Pipeline
      cadence: Every 1d
      cwd: /pipelines/legacy/etl   # explicit cwd

    - purpose: Monitor legacy data
      project: Legacy Pipeline
      cadence: Every 20m
      # No explicit cwd - relies on Project's directory

after deleting "Legacy Pipeline":
  projects:
    - name: Default   # default project

  loops:
    - purpose: Run legacy ETL
      project: Default           # reassigned
      cwd: /pipelines/legacy/etl # preserved (was explicit)

    - purpose: Monitor legacy data
      project: Default           # reassigned
      # Falls back to Default's directory or process cwd - may break!
```

Loops with explicit `cwd` are safe. Loops that relied on the Project's `directory` may break.

---

## Example 4: Cross-Project Task Reuse

```yaml
projects:
  - name: Frontend
    color: "#3b82f6"
    directory: /apps/frontend

  - name: Backend
    color: "#22c55e"
    directory: /apps/backend

# The "notify-oncall" Task is referenced by Loops in both Projects
tasks:
  notify-oncall:
    purpose: Send an alert to the on-call team
    on-success: none
    on-failure: none

loops:
  - purpose: Health check frontend
    project: Frontend
    cadence: Every 5m
    initial-task: check-frontend-health

  - purpose: Health check backend
    project: Backend
    cadence: Every 5m
    initial-task: check-backend-health

  # Both health-check Tasks reference notify-oncall on failure:
  # check-frontend-health --onFailure--> notify-oncall
  # check-backend-health --onFailure--> notify-oncall
```

The `notify-oncall` Task is shared across Projects. It is not scoped to any Project.

---

## Example 5: Single-Product Multi-Loop Layout

```yaml
project:
  name: Product Delivery
  color: "#3b82f6"
  directory: /products/delivery

loops:
  - purpose: Refine issues
    project: Product Delivery
    cadence: Every 20m
    initial-task: find-refinement-candidate

  - purpose: Implement issues
    project: Product Delivery
    cadence: Every 1h
    maxRuns: 8
    initial-task: find-implementable-issue

  - purpose: Review pull requests
    project: Product Delivery
    cadence: Every 15m
    initial-task: find-reviewable-pr
```

All Loops are grouped under one Project. They run independently at different cadences. Their Tasks may share common Tasks while having distinct main workflows.

---

## Example 6: Default Project as Inbox

```yaml
# A user starts by creating Loops without a Project (assigned to Default):
loops:
  - purpose: Quick backup test
    project: Default
    cadence: manual
    initial-task: test-backup

# Later, the user creates a proper Project and moves the Loop:
projects:
  - name: Backup Operations
    color: "#f97316"
    directory: /ops/backups

# The Loop's projectId is updated from "default" to the new Project's id.
# The Loop now uses the Backup Operations directory as its working directory.
```

The default Project serves as a scratch space. As workflows mature, they move to dedicated Projects.
