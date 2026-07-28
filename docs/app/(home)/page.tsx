import {
  BookOpenIcon,
  CpuIcon,
  LinkIcon,
  PlugsConnectedIcon,
  ScrollIcon,
  TerminalWindowIcon,
} from '@phosphor-icons/react/dist/ssr'
import type { Icon } from '@phosphor-icons/react'
import Image from 'next/image'
import Link from 'next/link'
import { source } from '@/app/source'
import { InstallTabs } from '@/components/landing'
import { asset } from '@/lib/asset'

/**
 * The front door is a lobby, not a pitch: say what this is, give the one install
 * command, then route people into the docs.
 *
 * Card copy is read from each target page's frontmatter rather than written here,
 * so the landing cannot drift from the pages it describes. Built from the Platform
 * tokens only: elevation is a border plus a surface, and nothing casts a shadow,
 * which is why the previous glows, backdrop blur and scroll-reveal are gone.
 */

type Destination = {
  slug: string
  icon: Icon
  /** Used only if the page or its description goes missing, so the build never breaks. */
  fallback: { title: string; description: string }
}

const DESTINATIONS: Destination[] = [
  {
    slug: 'getting-started',
    icon: TerminalWindowIcon,
    fallback: {
      title: 'Getting Started',
      description: 'Install loop-task and create your first loop.',
    },
  },
  {
    slug: 'examples',
    icon: BookOpenIcon,
    fallback: { title: 'Examples', description: 'Real loops you can copy and adapt.' },
  },
  {
    slug: 'task-chaining',
    icon: LinkIcon,
    fallback: {
      title: 'Task Chaining',
      description: 'Chain tasks that pass context to each other.',
    },
  },
  {
    slug: 'agent-workflows',
    icon: CpuIcon,
    fallback: {
      title: 'Agent Workflows',
      description: 'Put an AI coding agent on a cadence.',
    },
  },
  {
    slug: 'cli-reference',
    icon: ScrollIcon,
    fallback: { title: 'CLI Reference', description: 'Every command and flag.' },
  },
  {
    slug: 'mcp-server',
    icon: PlugsConnectedIcon,
    fallback: {
      title: 'MCP Server',
      description: 'Connect agents and coding tools over MCP.',
    },
  },
]

function resolve(destination: Destination) {
  const page = source.getPage([destination.slug])
  const data = page?.data as { title?: string; description?: string } | undefined

  return {
    title: data?.title ?? destination.fallback.title,
    description: data?.description ?? destination.fallback.description,
    href: page?.url ?? `/docs/${destination.slug}`,
  }
}

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-20">
      <div className="w-full max-w-5xl">
        <section className="max-w-2xl">
          <h1 className="text-balance font-bold text-4xl tracking-tight sm:text-5xl">
            Run any command on a cadence
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            Give a shell command, or an AI agent, an interval. Then watch, pause and chain every loop
            from one keyboard-driven terminal board. No cron files, no systemd, no config syntax.
          </p>

          <div className="mt-8 flex w-full flex-col items-start gap-5">
            <InstallTabs />

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/docs/getting-started"
                className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Get started
              </Link>
              <Link
                href="/docs"
                className="rounded-lg border border-border px-5 py-2.5 font-semibold text-sm transition-colors duration-150 hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Read the docs
              </Link>
            </div>
          </div>
        </section>

        <nav aria-label="Documentation sections" className="mt-16">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {DESTINATIONS.map((destination) => {
              const { title, description, href } = resolve(destination)
              const Icon = destination.icon

              return (
                <li key={destination.slug}>
                  <Link
                    href={href}
                    className="flex h-full flex-col rounded-lg border border-border bg-card p-5 transition-colors duration-150 hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Icon aria-hidden size={20} className="text-primary" />
                    <span className="mt-3 font-semibold text-card-foreground">{title}</span>
                    <span className="mt-1 text-muted-foreground text-sm">{description}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* One showcase, the board itself. */}
        <section className="mt-20">
          <h2 className="font-semibold text-xl tracking-tight">The board</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Your control centre. Create loops, follow live logs, pause, and stop, without leaving the
            terminal.
          </p>

          <div className="mt-6 overflow-hidden rounded-lg border border-border">
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
        </section>
      </div>
    </main>
  )
}
