'use client';

import { GithubLogoIcon, RepeatIcon } from '@phosphor-icons/react/dist/ssr';
import { ThemeToggle } from 'fumadocs-ui/components/layout/theme-toggle';
import Link from 'next/link';

const LINKS = [
  { href: '/#loops', label: 'Loop engineering' },
  { href: '/#features', label: 'Features' },
  { href: '/#compare', label: 'Crons' },
  { href: '/#examples', label: 'Examples' },
  { href: '/docs', label: 'See Docs' },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-base/85 backdrop-blur-xl">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-brand/30 bg-brand/10 text-brand transition-colors group-hover:bg-brand/20">
            <RepeatIcon size={15} weight="bold" />
          </span>
          <span className="font-mono text-sm font-semibold tracking-tight text-text">
            loop-task
          </span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-4 text-sm sm:gap-6">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`text-text-sec transition-colors hover:text-text ${l.href === '/docs' ? '' : 'hidden sm:inline'}`}
            >
              {l.href === '/docs' ? 'Docs' : l.label}
            </Link>
          ))}
          <span className="hidden h-4 w-px bg-border-dim sm:inline" aria-hidden />
          <a
            href="https://github.com/PlainConceptsPlatform/loop-task"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub repository"
            className="text-text-sec transition-colors hover:text-text"
          >
            <GithubLogoIcon size={18} />
          </a>
          <ThemeToggle mode="light-dark" className="border-0 bg-transparent p-1.5" />
        </div>
      </nav>
    </header>
  );
}
