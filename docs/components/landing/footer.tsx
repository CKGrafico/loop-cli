import { RepeatIcon } from '@phosphor-icons/react/dist/ssr';
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-border bg-base">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-8 sm:flex-row sm:justify-between sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md border border-brand/30 bg-brand/10 text-brand">
            <RepeatIcon size={12} weight="bold" />
          </span>
          <span className="font-mono text-sm font-medium text-text">loop-task</span>
        </div>

        {/* Copyright */}
        <p className="text-text-muted text-xs">
          MIT &copy;{' '}
          <a
            href="https://github.com/PlainConceptsPlatform"
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-sec hover:text-text transition-colors"
          >
            Plain Concepts
          </a>
        </p>

        {/* Links */}
        <div className="flex items-center gap-4 text-xs text-text-sec">
          <Link href="/docs" className="hover:text-text transition-colors">
            Docs
          </Link>
          <a
            href="https://github.com/PlainConceptsPlatform/loop-task"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-text transition-colors"
          >
            GitHub
          </a>
          <a
            href="https://www.npmjs.com/package/loop-task"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-text transition-colors"
          >
            npm
          </a>
        </div>
      </div>
    </footer>
  );
}
