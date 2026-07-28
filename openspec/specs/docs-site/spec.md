## ADDED Requirements

### Requirement: Fumadocs documentation site
The system SHALL provide a Fumadocs-based documentation site under `docs/` using Next.js 15 static export, React 19, and Tailwind CSS 4, replacing the previous static HTML landing page.

#### Scenario: Static export builds successfully
- **WHEN** `pnpm --filter docs build` is run in CI
- **THEN** Next.js produces a static export in `docs/out/` containing HTML, CSS, JS, and assets

#### Scenario: Served from a GitHub Pages project site
- **WHEN** the docs site is deployed
- **THEN** it is served from `https://plainconceptsplatform.github.io/loop-task/` with no custom domain and therefore no `CNAME` file
- **AND** `next.config.mjs` sets `basePath` and `trailingSlash` so routes and assets resolve under the `/loop-task` subpath

### Requirement: Platform Foundations theme with the loop-task accent
The documentation site SHALL be themed by the published `@plainconceptsplatform/ui-theme` package (the Platform Foundations styleguide), using the Platform neutral ramp, the Outfit typeface, and the Platform radius scale, with the loop-task amber bound to `--primary` as the only product-specific signal.

#### Scenario: Theme comes from the shared package
- **WHEN** `docs/app/global.css` is loaded
- **THEN** it imports `@plainconceptsplatform/ui-theme/theme.css` and `@plainconceptsplatform/ui-theme/base.css` after the Fumadocs `neutral` and `preset` stylesheets
- **AND** Fumadocs `--color-fd-*` variables are mapped onto the Platform semantic tokens

#### Scenario: Light and dark both supported
- **WHEN** any page (landing or docs) is viewed
- **THEN** both a light and a dark palette are available, defaulting to the visitor's system preference, and a theme toggle is reachable from the landing navbar and the docs chrome

#### Scenario: Accent meets contrast requirements in both modes
- **WHEN** the amber accent is used for text or as a button fill
- **THEN** it meets WCAG 2.2 AA contrast, using a darkened amber (#a16207) in light mode and #fbbf24 in dark mode

#### Scenario: Product token names remain valid
- **WHEN** existing markup uses product utilities such as `bg-base`, `text-brand`, `text-text-sec` or `border-border-dim`
- **THEN** those names resolve through `@theme inline` aliases onto Platform semantic tokens, so they flip correctly between light and dark

### Requirement: Redesigned landing page
The landing page SHALL replace the AI-generated uniform card grid with a premium, non-templated design featuring asymmetric layout, composition variety, confident hero (no typewriter animation), and humanized copy.

#### Scenario: No uniform card grid
- **WHEN** the landing page features section is rendered
- **THEN** feature blocks use varying sizes, scales, and positions (not a uniform grid of identical cards)

#### Scenario: No typewriter animation
- **WHEN** the landing page hero section is rendered
- **THEN** there is no character-by-character typewriter animation effect

#### Scenario: Humanized copy
- **WHEN** the landing page text content is read
- **THEN** copy sounds natural and human-written, free of generic marketing phrases

### Requirement: Documentation content in Diátaxis structure
The docs site SHALL include MDX documentation pages organized into the four Diátaxis quadrants: tutorials, how-to guides, reference, and explanation.

#### Scenario: Tutorial pages exist
- **WHEN** a user navigates to the docs
- **THEN** tutorial pages (getting-started) are available covering installation and first loop creation

#### Scenario: Reference pages exist
- **WHEN** a user navigates to the docs
- **THEN** reference pages (cli-reference, http-api, configuration) are available with complete command and endpoint listings

#### Scenario: How-to guide pages exist
- **WHEN** a user navigates to the docs
- **THEN** how-to guide pages (task-chaining, agent-workflows, docker) are available with step-by-step instructions

#### Scenario: Explanation pages exist
- **WHEN** a user navigates to the docs
- **THEN** explanation pages (architecture, troubleshooting) are available covering internal design and common issues

### Requirement: Content accuracy from codebase
All documentation content SHALL be derived from the actual codebase (CLI commands, HTTP API endpoints, architecture, configuration) ensuring factual accuracy.

#### Scenario: CLI reference matches actual commands
- **WHEN** a user reads the CLI reference page
- **THEN** all 15 CLI commands and their flags match the implementation in `src/cli.ts`

#### Scenario: HTTP API reference matches actual endpoints
- **WHEN** a user reads the HTTP API reference page
- **THEN** all REST endpoints and SSE streams match the implementation in `src/daemon/http/`

### Requirement: GitHub Actions workflow update
The GitHub Actions workflow SHALL build the Fumadocs static export and deploy it to GitHub Pages.

#### Scenario: CI builds docs
- **WHEN** a push to `main` touches `docs/**` or the workflow file
- **THEN** the workflow installs pnpm, builds the Next.js static export, and deploys `docs/out/` to GitHub Pages

#### Scenario: Workflow uses pnpm
- **WHEN** the CI workflow runs
- **THEN** it uses pnpm (not npm or yarn) for installation and build, consistent with the project's package manager

### Requirement: Docs as pnpm workspace
The `docs/` directory SHALL be a self-contained pnpm workspace with its own `package.json`, keeping Next.js and Fumadocs dependencies separate from the main application.

#### Scenario: Independent dependencies
- **WHEN** `pnpm install` is run at the root
- **THEN** docs dependencies (next, fumadocs, tailwind) are installed in the docs workspace without polluting the main app's `node_modules`
