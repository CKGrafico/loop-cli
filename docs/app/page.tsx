import Image from 'next/image';
import { asset } from '@/lib/asset';
import Link from 'next/link';
import {
  ArrowRightIcon,
  CheckIcon,
  FolderOpenIcon,
  GithubLogoIcon,
  GlobeIcon,
  HardDrivesIcon,
  RobotIcon,
  TimerIcon,
  TreeStructureIcon,
  X,
} from '@phosphor-icons/react/dist/ssr';
import { Navbar, Footer, InstallTabs, Reveal } from '@/components/landing';

/* ────────────────────────────────────────────
   Data
   ──────────────────────────────────────────── */

const rubric = [
  {
    word: 'Readable.',
    text: 'Intervals are written the way you say them: 30s, 5m, 1h, 1d. No cron expressions, no decoder ring.',
  },
  {
    word: 'Persistent.',
    text: 'A background daemon keeps loops running after you close the terminal. State survives reboots as plain JSON.',
  },
  {
    word: 'Chainable.',
    text: 'Tasks react to exit codes and chain into pipelines, on success or on failure, without glue scripts.',
  },
  {
    word: 'Controllable.',
    text: 'Every loop is live on the board: watch logs, check status, pause, stop, and chain, all from the keyboard.',
  },
];

const features = [
  {
    title: 'Background daemon',
    description:
      'Loops run in a background process that survives terminal exits. Start it once, close your laptop, come back tomorrow: your loops are still running.',
    icon: HardDrivesIcon,
    span: 'sm:col-span-2',
    accent: 'text-brand',
    badge: 'survives reboots',
  },
  {
    title: 'Task chaining',
    description:
      'Tasks can chain to other tasks on success or failure. Build pipelines that react to exit codes without wrapping everything in shell scripts.',
    icon: TreeStructureIcon,
    span: '',
    accent: 'text-task',
  },
  {
    title: 'Projects',
    description:
      'Organize loops into projects with colored labels. Switch context on the board with a single keypress.',
    icon: FolderOpenIcon,
    span: '',
    accent: 'text-project',
  },
  {
    title: 'Human intervals',
    description:
      'Write 30s, 5m, 1h, 1d, 1w. No cron expressions, no mental math. Intervals are just that: how long between runs.',
    icon: TimerIcon,
    span: '',
    accent: 'text-loop',
    badge: 'replaces crontab -e',
  },
  {
    title: 'HTTP API',
    description:
      'Every loop is queryable and controllable over HTTP. Build dashboards, wire up webhooks, or just curl the status endpoint.',
    icon: GlobeIcon,
    span: '',
    accent: 'text-warning',
  },
  {
    title: 'Agent-ready',
    description:
      'AI agents can create and manage loops through the CLI or API. Give an agent a cadence and let it iterate on a backlog, review PRs, or chase down flaky tests, all without babysitting.',
    icon: RobotIcon,
    span: 'sm:col-span-2',
    accent: 'text-idle',
  },
];

type Cell = { ok: boolean; note?: string };

const comparison: { label: string; loopTask: Cell; cron: Cell; os: Cell }[] = [
  {
    label: 'Human-readable intervals',
    loopTask: { ok: true, note: '30s, 5m, 1h' },
    cron: { ok: false, note: '*/5 * * * *' },
    os: { ok: false, note: 'XML / plist' },
  },
  {
    label: 'Cross-platform',
    loopTask: { ok: true, note: 'macOS, Linux, Windows' },
    cron: { ok: false, note: 'Unix only' },
    os: { ok: false, note: 'one per OS' },
  },
  {
    label: 'Interactive board (TUI)',
    loopTask: { ok: true },
    cron: { ok: false },
    os: { ok: false },
  },
  {
    label: 'Live control dashboard',
    loopTask: { ok: true, note: 'watch, pause, stop' },
    cron: { ok: false },
    os: { ok: false },
  },
  {
    label: 'Task chaining on exit codes',
    loopTask: { ok: true },
    cron: { ok: false },
    os: { ok: false, note: 'limited' },
  },
  {
    label: 'Run history & live logs',
    loopTask: { ok: true },
    cron: { ok: false, note: 'check your mail' },
    os: { ok: false, note: 'event viewer' },
  },
  {
    label: 'HTTP API',
    loopTask: { ok: true },
    cron: { ok: false },
    os: { ok: false },
  },
  {
    label: 'Setup',
    loopTask: { ok: true, note: 'one npm install' },
    cron: { ok: false, note: 'edit crontab' },
    os: { ok: false, note: 'GUI or config files' },
  },
];

const examples = [
  {
    label: 'Health check',
    cmd: 'loop-task new 10s -- curl -sf https://api.example.com/health',
  },
  {
    label: 'Test runner',
    cmd: 'loop-task new 5m -- npm test',
  },
  {
    label: 'Agent loop',
    cmd: 'loop-task new 30m -- opencode run "fix lint warnings, 5 max"',
  },
  {
    label: 'Data sync',
    cmd: 'loop-task new 1h --project etl -- ./scripts/sync.sh',
  },
  {
    label: 'Deploy poll',
    cmd: 'loop-task new 15s -- curl -sf https://app.example.com/deploy-status',
  },
  {
    label: 'Foreground run',
    cmd: 'loop-task run --now 5m -- npm run build',
  },
];

const references = [
  {
    title: 'Loop Engineering',
    source: 'Addy Osmani',
    href: 'https://addyosmani.com/blog/loop-engineering/',
  },
  {
    title: 'The Art of Loop Engineering',
    source: 'LangChain',
    href: 'https://www.langchain.com/blog/the-art-of-loop-engineering',
  },
  {
    title: 'What is Loop Engineering for AI Coding Agents?',
    source: 'MindStudio',
    href: 'https://www.mindstudio.ai/blog/what-is-loop-engineering-ai-coding-agents',
  },
  {
    title: 'The Rise of Loop Engineering',
    source: 'Quique Fdez Guerra',
    href: 'https://www.linkedin.com/pulse/we-stopped-working-alone-rise-loop-engineering-quique-fdez-guerra-a8qxe/',
  },
];

const commands = [
  { cmd: 'loop-task', desc: 'Open the interactive board' },
  { cmd: 'loop-task start', desc: 'Start the daemon, restore persisted loops' },
  { cmd: 'loop-task new <interval> -- <cmd>', desc: 'Create a background loop' },
  { cmd: 'loop-task run <interval> -- <cmd>', desc: 'Run a loop in the foreground' },
  { cmd: 'loop-task stop <id>', desc: 'Stop a loop and kill its child process' },
  { cmd: 'loop-task status [--json]', desc: 'Show status of all loops' },
  { cmd: 'loop-task api', desc: 'Show HTTP API endpoints' },
  { cmd: 'loop-task project list', desc: 'List all projects' },
];

/* ────────────────────────────────────────────
   Small helpers
   ──────────────────────────────────────────── */

function SectionKicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-brand">
      {children}
    </p>
  );
}

/* ────────────────────────────────────────────
   Page
   ──────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-base text-text">
      <Navbar />

      {/* ── Hero: split, copy left / live board right ── */}
      <section className="relative overflow-hidden">
        {/* Glow behind the board */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 right-[-10%] h-[500px] w-[700px] rounded-full bg-brand/[0.05] blur-[120px]"
        />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-12 lg:gap-10 lg:pb-24 lg:pt-24">
          {/* Copy */}
          <div className="flex flex-col items-start lg:col-span-5">
            <div className="animate-fade-up mb-6 inline-flex items-center rounded-full border border-border-dim bg-surface/80 px-3.5 py-1.5 font-mono text-xs text-text-sec">
              loop engineering, from your terminal
            </div>

            <h1
              className="animate-fade-up text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl"
              style={{ animationDelay: '60ms' }}
            >
              Run async loops.
              <br />
              <span className="text-brand">Control them all.</span>
            </h1>

            <p
              className="animate-fade-up mt-6 max-w-md text-lg leading-relaxed text-text-sec"
              style={{ animationDelay: '120ms' }}
            >
              Give any command, or an AI agent, a cadence. Then watch, pause,
              and chain every loop from one keyboard-driven terminal dashboard,
              on macOS, Linux, and Windows.
            </p>

            {/* Install + CTAs */}
            <div
              className="animate-fade-up mt-10 flex w-full flex-col items-start gap-4"
              style={{ animationDelay: '180ms' }}
            >
              <InstallTabs />

              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/docs/getting-started"
                  className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-brand-ink transition hover:bg-brand-soft active:translate-y-px"
                >
                  Get started
                  <ArrowRightIcon size={15} weight="bold" />
                </Link>
                <a
                  href="https://github.com/PlainConceptsPlatform/loop-task"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-border-dim bg-surface px-5 py-2.5 text-sm font-medium text-text-sec transition hover:text-text active:translate-y-px"
                >
                  <GithubLogoIcon size={15} />
                  Star on GitHub
                </a>
              </div>
            </div>
          </div>

          {/* The real board, bleeding off the right edge on desktop */}
          <div
            className="animate-fade-up relative lg:col-span-7"
            style={{ animationDelay: '240ms' }}
          >
            <div className="overflow-hidden rounded-xl border border-border-dim shadow-2xl shadow-[var(--shadow-tint)] lg:w-[54vw] lg:max-w-none">
              <Image
                src={asset('/demo.gif')}
                alt="Recording of the loop-task terminal board creating and monitoring loops"
                width={1610}
                height={930}
                unoptimized
                priority
                className="h-auto w-full"
              />
            </div>
            <p className="mt-3 font-mono text-xs text-text-muted">
              The board: your control center. Create, monitor live logs, pause,
              and stop every loop.
            </p>
          </div>
        </div>
      </section>

      {/* ── Rubric strip ── */}
      <section className="border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:grid-cols-3 sm:px-6">
          {rubric.map((r, i) => (
            <Reveal key={r.word} delay={i * 0.08}>
              <h2 className="font-mono text-xl font-bold text-brand">{r.word}</h2>
              <p className="mt-3 text-sm leading-relaxed text-text-sec">
                {r.text}
              </p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── What is loop engineering? ── */}
      <section id="loops" className="border-t border-border scroll-mt-14">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <SectionKicker>$ what is loop engineering?</SectionKicker>
          <h2 className="mb-3 max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">
            Design work that runs on a cadence, not on your attention
          </h2>
          <p className="mb-8 max-w-2xl text-text-sec">
            A <span className="text-text">loop</span> is a recurring goal: you
            define a purpose, give it an interval, and let it iterate. It scales
            from a 10-second health check to an AI agent chewing through a
            backlog, and you supervise every one of them from the same board.
          </p>

          <div className="mb-10">
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-text-muted">
              Further reading
            </p>
            <ul className="flex flex-col gap-2">
              {references.map((ref) => (
                <li key={ref.href}>
                  <a
                    href={ref.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center gap-2 text-sm text-text-sec transition-colors hover:text-brand"
                  >
                    <ArrowRightIcon
                      size={13}
                      weight="bold"
                      className="shrink-0 text-text-muted transition-colors group-hover:text-brand"
                    />
                    <span className="underline underline-offset-4">
                      {ref.title}
                    </span>
                    <span className="text-text-muted"> {ref.source}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <Reveal className="overflow-hidden rounded-xl border border-border-dim bg-input">
            <div className="divide-y divide-border-dim">
              {examples.slice(0, 5).map((ex) => (
                <div key={ex.label} className="flex items-center gap-4 px-5 py-3">
                  <code className="w-28 shrink-0 rounded-md bg-elevated px-2 py-0.5 text-center font-mono text-xs text-text-muted">
                    {ex.label}
                  </code>
                  <code className="truncate font-mono text-sm text-text-sec">
                    <span className="select-none text-text-muted">$ </span>
                    {ex.cmd}
                  </code>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Features: bento grid ── */}
      <section id="features" className="border-t border-border scroll-mt-14">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <SectionKicker>$ loop-task --features</SectionKicker>
          <h2 className="mb-10 text-2xl font-semibold tracking-tight sm:text-3xl">
            Built for cadence-driven work
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <Reveal
                  key={f.title}
                  delay={i * 0.05}
                  className={`group relative rounded-2xl border border-border bg-surface p-6 transition-colors hover:border-border-dim ${f.span}`}
                >
                  <div className="flex items-start justify-between">
                    <span
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border-dim bg-input ${f.accent}`}
                    >
                      <Icon size={18} />
                    </span>
                    {f.badge && (
                      <span className="rounded-full border border-border-dim bg-input px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                        {f.badge}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-sec">
                    {f.description}
                  </p>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Comparison ── */}
      <section id="compare" className="border-t border-border scroll-mt-14">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <SectionKicker>$ diff cron loop-task</SectionKicker>
          <h2 className="mb-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            You shouldn&apos;t need a decoder ring
          </h2>
          <p className="mb-10 max-w-xl text-text-sec">
            <code className="rounded bg-elevated px-1.5 py-0.5 font-mono text-sm text-danger">
              0 4 * * 2-5
            </code>{' '}
            means &ldquo;4 AM, Tuesday through Friday.&rdquo; Obviously.
          </p>

          <Reveal className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <th className="px-5 py-3.5 font-medium text-text-sec" />
                  <th className="px-5 py-3.5 font-mono font-semibold text-brand">
                    loop-task
                  </th>
                  <th className="px-5 py-3.5 font-mono font-medium text-text-sec">
                    cron
                  </th>
                  <th className="px-5 py-3.5 font-medium text-text-sec">
                    launchd / Task Scheduler
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {comparison.map((row) => (
                  <tr key={row.label} className="transition-colors hover:bg-surface/60">
                    <td className="px-5 py-3.5 font-medium text-text">
                      {row.label}
                    </td>
                    {[row.loopTask, row.cron, row.os].map((cell, i) => (
                      <td key={i} className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-2">
                          {cell.ok ? (
                            <CheckIcon size={15} weight="bold" className="shrink-0 text-success" />
                          ) : (
                            <X size={15} className="shrink-0 text-text-muted" />
                          )}
                          {cell.note && (
                            <span
                              className={`font-mono text-xs ${cell.ok ? 'text-text-sec' : 'text-text-muted'
                                }`}
                            >
                              {cell.note}
                            </span>
                          )}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>
        </div>
      </section>

      {/* ── Examples ── */}
      <section id="examples" className="border-t border-border scroll-mt-14">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="mb-10 text-2xl font-semibold tracking-tight sm:text-3xl">
            Practical loops for everyday work
          </h2>

          <Reveal className="overflow-hidden rounded-xl border border-border-dim bg-input">
            <div className="flex items-center gap-1.5 border-b border-border-dim px-4 py-2.5">
              <span className="h-3 w-3 rounded-full bg-danger/80" />
              <span className="h-3 w-3 rounded-full bg-warning/80" />
              <span className="h-3 w-3 rounded-full bg-success/80" />
              <span className="ml-3 font-mono text-xs text-text-muted">
                ~/work
              </span>
            </div>

            <div className="divide-y divide-border-dim">
              {examples.map((ex) => (
                <div key={ex.label} className="flex items-center gap-4 px-5 py-3">
                  <code className="w-28 shrink-0 rounded-md bg-elevated px-2 py-0.5 text-center font-mono text-xs text-text-muted">
                    {ex.label}
                  </code>
                  <code className="truncate font-mono text-sm text-text-sec">
                    <span className="select-none text-text-muted">$ </span>
                    {ex.cmd}
                  </code>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Commands preview ── */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="mb-10 text-2xl font-semibold tracking-tight sm:text-3xl">
            The commands you&apos;ll use
          </h2>

          <Reveal className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-border">
                {commands.map((c) => (
                  <tr key={c.cmd} className="transition-colors hover:bg-surface/60">
                    <td className="px-5 py-3">
                      <code className="font-mono text-xs text-brand-soft">
                        {c.cmd}
                      </code>
                    </td>
                    <td className="px-5 py-3 text-text-sec">{c.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>

          <p className="mt-4 text-sm text-text-muted">
            Full reference at{' '}
            <Link
              href="/docs/cli-reference"
              className="text-brand underline underline-offset-4 transition-colors hover:text-brand-soft"
            >
              CLI Reference
            </Link>
          </p>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative overflow-hidden border-t border-border">
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 left-1/2 h-[400px] w-[700px] -translate-x-1/2 rounded-full bg-brand/[0.05] blur-[100px]"
        />
        <div className="relative mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Start looping
          </h2>
          <p className="mt-4 text-text-sec">
            Install it, create your first loop, and let it run.
          </p>

          <div className="mt-8 flex flex-col items-center gap-4">
            <InstallTabs />

            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/docs/getting-started"
                className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-brand-ink transition hover:bg-brand-soft active:translate-y-px"
              >
                Get started
                <ArrowRightIcon size={15} weight="bold" />
              </Link>
              <a
                href="https://github.com/PlainConceptsPlatform/loop-task"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-border-dim bg-surface px-5 py-2.5 text-sm font-medium text-text-sec transition hover:text-text active:translate-y-px"
              >
                <GithubLogoIcon size={15} />
                Star on GitHub
              </a>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
