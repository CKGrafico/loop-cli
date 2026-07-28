import type { MetadataRoute } from 'next'
import { absoluteUrl } from '@/lib/site'

export const dynamic = 'force-static'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    // absoluteUrl, not new URL: siteUrl carries the Pages project subpath and an
    // absolute-path input to new URL() would replace it.
    sitemap: absoluteUrl('/sitemap.xml'),
  }
}
