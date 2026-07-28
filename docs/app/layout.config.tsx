import { RepeatIcon } from '@phosphor-icons/react/dist/ssr'
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared'
import { cliVersion, repoUrl, siteName } from '@/lib/site'

/** Shared nav/branding for every layout, as in Foundations' layout.config.tsx. */
export const baseOptions: BaseLayoutProps = {
  nav: {
    title: (
      <>
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-primary/30 bg-accent text-primary">
          <RepeatIcon size={13} weight="bold" />
        </span>
        <span className="font-semibold">{siteName}</span>
        {/* A trust signal, not decoration, so it stays plain and muted. */}
        <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          v{cliVersion}
        </span>
      </>
    ),
    url: '/',
  },
  // No `links`: the sidebar is the navigation. The navbar keeps search, the theme
  // toggle and the repo link, matching Foundations.
  githubUrl: repoUrl,
}
