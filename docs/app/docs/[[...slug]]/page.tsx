import type { Metadata } from 'next'
import { source } from '@/app/source'
import { DocsPage, DocsBody, DocsDescription, DocsTitle } from 'fumadocs-ui/page'
import { notFound } from 'next/navigation'
import { useMDXComponents } from '@/mdx-components'
import { absoluteUrl } from '@/lib/site'

export default async function Page({
  params,
}: {
  params: Promise<{ slug?: string[] }>
}) {
  const { slug } = await params
  const page = source.getPage(slug)

  if (!page) {
    notFound()
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const MDX = (page.data as any).body
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toc = (page.data as any).toc as undefined | any[]
  const components = useMDXComponents({})

  return (
    <DocsPage toc={toc}>
      <DocsTitle>{page.data.title}</DocsTitle>
      {page.data.description && (
        <DocsDescription>{page.data.description}</DocsDescription>
      )}
      <DocsBody>
        <MDX components={components} />
      </DocsBody>
    </DocsPage>
  )
}

export async function generateStaticParams() {
  return source.generateParams().map((param) => ({
    slug: param.slug,
  }))
}

/**
 * Without this every docs page shipped the site's default title and description,
 * so all 14 shared one <title> and one social preview. The root layout defines a
 * "%s · loop-task" template, which `title` here fills in.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>
}): Promise<Metadata> {
  const { slug } = await params
  const page = source.getPage(slug)

  if (!page) notFound()

  const url = absoluteUrl(page.url)

  return {
    title: page.data.title,
    description: page.data.description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      title: page.data.title,
      description: page.data.description,
      url,
    },
    twitter: {
      card: 'summary_large_image',
      title: page.data.title,
      description: page.data.description,
    },
  }
}
