import { HomeLayout } from 'fumadocs-ui/layouts/home'
import { baseOptions } from '@/app/layout.config'

/**
 * Wraps the landing in Fumadocs' HomeLayout so it shares the docs navbar: search,
 * the theme toggle and the repo link. Before this the landing shipped its own
 * bespoke navbar and footer, which meant two different chromes on one site.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <HomeLayout {...baseOptions}>{children}</HomeLayout>
}
