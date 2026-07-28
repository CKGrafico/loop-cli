import { HomeLayout } from 'fumadocs-ui/layouts/home'
import Link from 'next/link'
import { baseOptions } from '@/app/layout.config'

const LINKS = [
  { href: '/docs/getting-started', label: 'Getting started' },
  { href: '/docs/cli-reference', label: 'CLI reference' },
  { href: '/docs/examples', label: 'Examples' },
]

export default function NotFound() {
  return (
    <HomeLayout {...baseOptions}>
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <p className="font-semibold text-primary text-sm">404</p>
        <h1 className="mt-3 font-bold text-3xl tracking-tight">This page does not exist</h1>
        <p className="mt-3 max-w-md text-muted-foreground">
          The page may have been renamed or moved. Search from the navigation bar, or start from one
          of these.
        </p>

        <ul className="mt-8 flex flex-wrap justify-center gap-3">
          {LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="inline-block rounded-lg border border-border px-4 py-2 font-semibold text-sm transition-colors duration-150 hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </HomeLayout>
  )
}
