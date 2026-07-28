import { Accordion, Accordions } from 'fumadocs-ui/components/accordion'
import { Callout } from 'fumadocs-ui/components/callout'
import { File, Files, Folder } from 'fumadocs-ui/components/files'
import { Step, Steps } from 'fumadocs-ui/components/steps'
import { Tab, Tabs } from 'fumadocs-ui/components/tabs'
import { TypeTable } from 'fumadocs-ui/components/type-table'
import defaultMdxComponents from 'fumadocs-ui/mdx'
import type { MDXComponents } from 'mdx/types'
import { CodeBlock } from '@/components/docs'

/**
 * Registers the Fumadocs vocabulary globally, as Foundations does, so content can
 * use it without a per-page import block.
 *
 * The bespoke Callout, Steps and Tabs that used to live in components/docs are
 * gone: they reimplemented what Fumadocs already ships, and only Callout was ever
 * used. Keeping the framework's versions means one less thing to maintain and
 * consistent behaviour with the other Platform docs sites.
 */
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    Accordion,
    Accordions,
    Callout,
    CodeBlock,
    File,
    Files,
    Folder,
    Step,
    Steps,
    Tab,
    Tabs,
    TypeTable,
    ...components,
  }
}
