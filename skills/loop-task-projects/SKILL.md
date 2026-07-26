---
name: loop-task-projects
version: 1.1.0
description: >
  Design Loop Task Projects: organisational scope for Loops, default-project
  semantics, membership, colour branding, deletion with reassignment, and
  multi-tenant automation patterns. Load when creating, reviewing, or modifying
  Projects or reasoning about how Loops are grouped.
---

# Loop Task Projects

A Project is an organisational **scope** for Loops. It groups related Loops together and provides a working directory, a visual identity, and a namespace. It has no effect on execution semantics.

## What a Project Owns

| Property | Meaning |
|---|---|
| name | Human-readable label |
| color | Visual identifier (hex from predefined palette) |
| directory | Default working directory for the Project's Loops' Tasks |
| isSystem | Whether this is a system-managed Project (cannot be renamed or deleted) |

For every property, see [references/domain-reference.md](references/domain-reference.md).

## The Default Project

Every installation has exactly one default Project (`id: "default"`, `color: "#ffffff"`, `isSystem: true`). It cannot be renamed, recoloured, or deleted. It receives orphaned Loops when their Project is deleted, and serves as the initial home for Loops created without a Project.

## Membership

Each Loop belongs to exactly one Project. Tasks are global - not scoped to any Project. The same Task can be the initial Task of Loops in different Projects.

### Working directory resolution

1. Loop's `cwd` (if set) - highest priority.
2. Project's `directory`.
3. Process working directory.

Resolution happens at Task execution time. Changing a Project's `directory` affects all Loops in that Project that lack an explicit `cwd`.

## What a Project Does Not Control

Project membership provides **no isolation**:

- File system: all Loops' Tasks can access the same filesystem.
- Environment: all Loops share the same process environment.
- External state: Loops in different Projects can modify the same resources.
- Concurrency: Loops in different Projects execute independently and concurrently.

There is no per-Project access control, no per-Project variables, no per-Project credentials, and no Project hierarchy. Projects are flat organisational groupings.

## Deletion

When a non-system Project is deleted:

1. Its Loops are reassigned to the default Project (preserving all properties including `cwd`).
2. Loops that relied on the Project's `directory` (without explicit `cwd`) now fall back to the default Project's directory or process cwd.
3. Tasks are unaffected (global, not scoped to Projects).
4. Run history is preserved on reassigned Loops.

## Design Patterns

Group Loops by domain (Backend API, Frontend App, Data Pipeline), by environment (Production, Staging, Development), by team (SRE, Platform), or by product (User Auth, Billing). Each pattern is a different lens for the same organisational grouping.

For concrete examples of each pattern, see [references/examples.md](references/examples.md).

## Antipatterns

- Over-fragmentation (a Project for every single Loop adds overhead without benefit).
- Using Projects as a security boundary (no isolation exists - use separate installations).
- Relying on the default Project for production Loops (it is for prototyping).
- Deleting a Project without considering working directory fallout.
- Expecting Project-scoped isolation of side effects.

## Cross-Skill References

- For Loop cadence and iteration scheduling, load **`loop-task-loops`**.
- For Task execution, chaining, and context, load **`loop-task-tasks`**.
- For generating the ASCII art `diagram:` field in recipe files, load **`loop-task-diagram`** after writing the recipe.
