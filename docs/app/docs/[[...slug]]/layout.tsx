import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { source } from '@/app/source'
import { RepeatIcon } from '@phosphor-icons/react/dist/ssr'

export default function DocsLayoutWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <DocsLayout
      tree={source.pageTree}
      githubUrl="https://github.com/PlainConceptsPlatform/loop-task"
      nav={{
        title: (
          <span className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md border border-brand/30 bg-brand/10 text-brand">
              <RepeatIcon size={13} weight="bold" />
            </span>
            <span className="font-mono text-sm font-semibold">loop-task</span>
          </span>
        ),
        enabled: true,
      }}
    >
      {children}
    </DocsLayout>
  )
}
