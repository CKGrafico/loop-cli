// @ts-nocheck
import { fromConfig } from 'fumadocs-mdx/runtime/browser';
import type * as Config from '../source.config';

const create = fromConfig<typeof Config>();
const browserCollections = {
  docs: create.doc("docs", {"agent-workflows.mdx": () => import("../content/docs/agent-workflows.mdx?collection=docs"), "architecture.mdx": () => import("../content/docs/architecture.mdx?collection=docs"), "cli-reference.mdx": () => import("../content/docs/cli-reference.mdx?collection=docs"), "configuration.mdx": () => import("../content/docs/configuration.mdx?collection=docs"), "docker.mdx": () => import("../content/docs/docker.mdx?collection=docs"), "examples.mdx": () => import("../content/docs/examples.mdx?collection=docs"), "getting-started.mdx": () => import("../content/docs/getting-started.mdx?collection=docs"), "http-api.mdx": () => import("../content/docs/http-api.mdx?collection=docs"), "index.mdx": () => import("../content/docs/index.mdx?collection=docs"), "mcp-server.mdx": () => import("../content/docs/mcp-server.mdx?collection=docs"), "opentelemetry.mdx": () => import("../content/docs/opentelemetry.mdx?collection=docs"), "recipe-loops.mdx": () => import("../content/docs/recipe-loops.mdx?collection=docs"), "task-chaining.mdx": () => import("../content/docs/task-chaining.mdx?collection=docs"), "troubleshooting.mdx": () => import("../content/docs/troubleshooting.mdx?collection=docs"), }),
};
export default browserCollections;