/**
 * Single source of truth for site-level identity, mirroring Foundations'
 * lib/site.ts.
 *
 * Unlike Foundations this has a real default: the site is a static export to a
 * known GitHub Pages project URL, and `metadataBase` has to be absolute at build
 * time. Override with NEXT_PUBLIC_SITE_URL if it ever moves.
 */
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://plainconceptsplatform.github.io/loop-task'

export const siteName = 'loop-task'

/** Kept in sync with content/docs/index.mdx frontmatter. */
export const siteDescription =
  'Run any command on a cadence. Create loops in the background, manage them from an interactive board, or chain tasks that pass context to each other.'

/** The npm package users install. The `bin` it exposes is still `loop-task`. */
export const packageName = '@plainconceptsplatform/loop-task'

export const npmUrl = `https://www.npmjs.com/package/${packageName}`

export const repoUrl = 'https://github.com/PlainConceptsPlatform/loop-task'

/**
 * The version currently published on npm, resolved at build time by
 * next.config.mjs from the registry (not the repo manifest), so the nav badge
 * shows what people can actually install.
 */
export const cliVersion: string = process.env.NEXT_PUBLIC_CLI_VERSION ?? '0.0.0'

/**
 * Join a route onto `siteUrl`.
 *
 * `new URL("/docs", siteUrl)` cannot be used here: siteUrl carries the GitHub
 * Pages project subpath, and an absolute-path input replaces the whole path,
 * silently emitting root-level URLs. Concatenation keeps the subpath.
 */
export function absoluteUrl(path: string): string {
  const base = siteUrl.replace(/\/$/, '')
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}
