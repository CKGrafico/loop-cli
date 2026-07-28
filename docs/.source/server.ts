// @ts-nocheck
import * as __fd_glob_14 from "../content/docs/troubleshooting.mdx?collection=docs"
import * as __fd_glob_13 from "../content/docs/task-chaining.mdx?collection=docs"
import * as __fd_glob_12 from "../content/docs/recipe-loops.mdx?collection=docs"
import * as __fd_glob_11 from "../content/docs/opentelemetry.mdx?collection=docs"
import * as __fd_glob_10 from "../content/docs/mcp-server.mdx?collection=docs"
import * as __fd_glob_9 from "../content/docs/index.mdx?collection=docs"
import * as __fd_glob_8 from "../content/docs/http-api.mdx?collection=docs"
import * as __fd_glob_7 from "../content/docs/getting-started.mdx?collection=docs"
import * as __fd_glob_6 from "../content/docs/examples.mdx?collection=docs"
import * as __fd_glob_5 from "../content/docs/docker.mdx?collection=docs"
import * as __fd_glob_4 from "../content/docs/configuration.mdx?collection=docs"
import * as __fd_glob_3 from "../content/docs/cli-reference.mdx?collection=docs"
import * as __fd_glob_2 from "../content/docs/architecture.mdx?collection=docs"
import * as __fd_glob_1 from "../content/docs/agent-workflows.mdx?collection=docs"
import { default as __fd_glob_0 } from "../content/docs/meta.yaml?collection=docs"
import { fromConfig } from 'fumadocs-mdx/runtime/server';
import type * as Config from '../source.config';

const create = fromConfig<typeof Config>();

export const docs = await create.docs("docs", "content/docs", {"meta.yaml": __fd_glob_0, }, {"agent-workflows.mdx": __fd_glob_1, "architecture.mdx": __fd_glob_2, "cli-reference.mdx": __fd_glob_3, "configuration.mdx": __fd_glob_4, "docker.mdx": __fd_glob_5, "examples.mdx": __fd_glob_6, "getting-started.mdx": __fd_glob_7, "http-api.mdx": __fd_glob_8, "index.mdx": __fd_glob_9, "mcp-server.mdx": __fd_glob_10, "opentelemetry.mdx": __fd_glob_11, "recipe-loops.mdx": __fd_glob_12, "task-chaining.mdx": __fd_glob_13, "troubleshooting.mdx": __fd_glob_14, });