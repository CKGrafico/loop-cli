import type { MetadataRoute } from 'next'
import { source } from '@/app/source'
import { absoluteUrl } from '@/lib/site'

export const dynamic = 'force-static'

export default function sitemap(): MetadataRoute.Sitemap {
  // absoluteUrl, not new URL: siteUrl carries the Pages project subpath, and
  // new URL("/docs", base) silently drops it and emits root-level URLs.
  const pages = source.getPages().map((page) => ({
    url: absoluteUrl(page.url),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  return [
    { url: absoluteUrl('/'), changeFrequency: 'weekly' as const, priority: 1 },
    ...pages,
  ]
}
