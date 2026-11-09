<p align="center">
  <img
    src="https://raw.githubusercontent.com/modus-data/modus-sdk-typescript/main/assets/modus-logo.png"
    alt="Modus"
    width="280"
  />
</p>

# Modus TypeScript SDK

[![npm](https://img.shields.io/npm/v/@getmodus/sdk)](https://www.npmjs.com/package/@getmodus/sdk)
[![Node.js](https://img.shields.io/node/v/@getmodus/sdk)](https://www.npmjs.com/package/@getmodus/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Official TypeScript / JavaScript client for Modus — your organization's context layer for AI.

**Runtime:** Node.js 18+. Ships **ESM** and **CommonJS**. Not intended for browsers or edge runtimes (uses Node APIs such as `process.env`).

## What is Modus?

Modus is your organization's context layer: it connects assistants to curated knowledge about your data, systems, and workflows so answers use org-specific context instead of generic guesses.

- **Modus** — your org-wide assistant (same capability as the Modus home page)
- **Scopes** — published assistants you chat with, each with its own context and tools
- **Workflows** — automations that run on a schedule or trigger
- **Context items** — curated knowledge Modus composes at runtime when answering

## Two clients in one package

**`Modus`** is what most people need. Use it to chat with Modus, run scopes, browse context, and inspect workflow runs — the same things you do in the Modus app day to day.

**`ModusManagement`** (`@getmodus/sdk/management`) is for org setup: create, update, and deploy scopes, workflows, and context — the CRUD operations you would use in the Modus UI as an admin.

If you are getting started, use `Modus` only. Reach for `ModusManagement` when you are automating configuration.

## Installation

```bash
npm install @getmodus/sdk
```

## Getting started

```ts
import { Modus } from '@getmodus/sdk'

// Reads MODUS_API_KEY from the environment, or pass apiKey explicitly
const client = new Modus()

for await (const scope of (await client.scopes.list()).autoPagingIter()) {
  console.log(scope.name, scope.status)
}

// Ids are numeric: take one from list()
const [first] = (await client.scopes.list()).items
const scope = await client.scopes.get(first.id)
console.log(scope.name, scope.description)

for await (const item of (await client.context.items.list()).autoPagingIter()) {
  console.log(item.uid, item.contextType, item.description ?? item.uid)
}
```

### CommonJS (`require`)

```js
const { Modus } = require('@getmodus/sdk')
const client = new Modus({ apiKey: process.env.MODUS_API_KEY })
```

## Authentication

Create an API token in the Modus app (**Settings → API Tokens** on your Modus home page). Prefer an environment variable over hardcoding keys in source:

```bash
export MODUS_API_KEY=modus_pat_xxx
```

```ts
const client = new Modus({ apiKey: 'modus_pat_xxx' })
```

### Staging and custom hosts

The client talks to `https://api.getmodus.com` by default. Chat, runs and context compose
(`modus.getContext()`, `scopes.getContext()`) go to the agent host, which for a Modus API origin
is derived from it (`api.getmodus.com` → `agent.getmodus.com`, `api.staging.getmodus.com` →
`agent.staging.getmodus.com`). Any other `baseUrl` needs `agentHost` for those calls. Point the
client elsewhere with options or environment variables:

| Option | Environment variable | Default |
|--------|----------------------|---------|
| `baseUrl` | `MODUS_BASE_URL` | `https://api.getmodus.com` |
| `agentHost` | `MODUS_AGENT_HOST` | derived from `baseUrl`: `api.getmodus.com` → `agent.getmodus.com`, `api.<env>.getmodus.com` → `agent.<env>.getmodus.com`; none for any other host |

```ts
const staging = new Modus({ baseUrl: 'https://api.staging.getmodus.com' })

// A host that is not api.getmodus.com or api.<env>.getmodus.com needs its agent host too,
// or chat, runs and getContext() throw
const selfHosted = new Modus({
  baseUrl: 'https://modus-api.internal.example.com',
  agentHost: 'https://modus-agent.internal.example.com',
})
```

An option wins over its environment variable. `ModusManagement` takes the same options.

## Using Modus

### Modus vs scopes

| Surface | SDK | Use when |
|---------|-----|----------|
| **Modus** (org-wide) | `client.modus.*` | Full-environment assistant — same as the Modus home page |
| **Scope** | `client.scopes.*` | A specific published scope and its configured context/tools |

Use `client.modus.chat()` for native Modus — not a scope-id shortcut.

### Org-wide Modus assistant

```ts
const MODEL = 'claude-sonnet-5'

const result = await client.modus.chat('What were our top revenue drivers last quarter?', {
  model: MODEL,
})
console.log(result.content, result.threadId)

const followUp = await client.modus.chat('Break that down by region.', {
  model: MODEL,
  threadId: result.threadId,
})
console.log(followUp.content)

// Every chat streams live from the agent host; iterate it to print tokens as they arrive.
const live = client.modus.chat('Summarize this week', { model: MODEL })
for await (const chunk of live.textStream()) {
  process.stdout.write(chunk)
}
const { threadId } = await live

const ctx = await client.modus.getContext('What tables describe customer churn?', { limit: 10 })
console.log(ctx.originalCount, ctx.sessionId)

for await (const row of (
  await client.modus.conversations.list({ kind: 'modus', pageSize: 10 })
).autoPagingIter()) {
  console.log(row.threadId, row.firstMessage)
}
```

### Scopes

```ts
const MODEL = 'claude-sonnet-5'

const result = await client.scopes.chat(scopeId, 'Hello', { model: MODEL })
console.log(result.content, result.threadId)

const live = client.scopes.chat(scopeId, 'Hi', { model: MODEL, threadId: result.threadId })
for await (const chunk of live.textStream()) {
  process.stdout.write(chunk)
}
```

### Context

```ts
for await (const item of (await client.context.items.list()).autoPagingIter()) {
  console.log(item.uid, item.description ?? item.uid)
}
```

### Workflows

```ts
const workflow = await client.workflows.get(workflowId)
for await (const run of (await client.workflows.runs.list(workflowId, { pageSize: 20 })).autoPagingIter()) {
  console.log(run.id, run.status)
}
```

```ts
const { content } = await client.workflows.chat(workflowId, 'Run this week\'s digest', { model: 'claude-sonnet-5' })
```

`client.workflows.runs.stream(runId)` follows a run's events. Each event carries an `id` when the server sends one. If the connection drops, call `stream` again with `lastEventId` set to the last `id` you handled: the stream resumes after it instead of replaying the run from the start. Without an `id` it can only replay from the start. The stream ends after a `done`, `error` or `cancelled` event; only `done` is a completed run.

```ts
import { APIConnectionError, type RunEvent } from '@getmodus/sdk'

async function followRun(runId: string, handle: (event: RunEvent) => void): Promise<void> {
  let lastEventId: string | undefined
  for (;;) {
    const events = client.workflows.runs.stream(runId, { lastEventId })[Symbol.asyncIterator]()
    for (;;) {
      let next: IteratorResult<RunEvent>
      try {
        next = await events.next()
      } catch (error) {
        if (error instanceof APIConnectionError) break // dropped: resume after lastEventId
        throw error
      }
      if (next.done) break // ended without a final event: resume
      const event = next.value
      handle(event) // a handler error propagates; it is not a disconnect
      lastEventId = event.id ?? lastEventId
      if (event.type === 'done') return
      // A `stream_timeout` event is followed by an `error` event.
      if (event.type === 'error' || event.type === 'cancelled') {
        throw new Error(`Run ${runId} ended with ${event.type}`)
      }
    }
  }
}
```

### Approvals

A run that needs approval for a write stops with `result.approval` set. Continue it with `resume`:

```ts
const chat = client.modus.chat('Fix the typo in the accounts table', { model: 'claude-sonnet-5' })
const first = await chat
if (first.approval) {
  const done = await chat.resume({ decision: 'approve' })
  console.log(done.content)
}
```

## Managing your org

```ts
import { ModusManagement } from '@getmodus/sdk/management'

const mgmt = new ModusManagement() // reads MODUS_API_KEY
const scope = await mgmt.scopes.create({ name: 'Analyst', model: 'claude-sonnet-5' })
await mgmt.scopes.deploy(scope.id)

// Create returns contextItemId (also available as .uid); list/get use .uid
const note = await mgmt.context.createNote('Title', 'Body')
console.log(note.contextItemId, note.uid) // same UUID

// Context file upload (presign → PUT → finalize; polls until processing by default)
const upload = await mgmt.context.files.upload('report.pdf', { folderPath: 'reports/2026' })
console.log(upload.uploadId, upload.status)

// Directory / many files — bulk uploadUrls + finalize (chunks of 100)
const batch = await mgmt.context.files.uploadDir('./reports', { folderPath: 'archive' })
console.log(batch.uploaded.length, batch.failed.length)

const file = await mgmt.context.files.get(upload.uploadId)
const files = await mgmt.context.files.list()
console.log(file.status, files.items.length)

const rootFolders = await mgmt.context.items.list({
  connectionIds: ['files'],
  contextType: 'file_folder_metadata',
  parentUids: [],
})
console.log(rootFolders.items.length)

const destination = rootFolders.items[0]
if (destination) {
  const moved = await mgmt.context.items.move(upload.uploadId, {
    destinationFolderUid: destination.uid,
  })
  console.log(moved.movedItems)
}

// Who can view and manage a note, saved query, link or uploaded file; all three settings replace the current ones.
const access = await mgmt.context.items.updateAccess(note.uid, {
  visibility: 'private',
  groupPermissions: {},
  // Replace with the email of a member of your organization; anyone else is a 422
  sharedWith: [{ email: 'ana@example.com', permission: 'use' }],
})
console.log(access.canManage)
```

Requires a token with write access to scopes and workflows (same as the Modus UI). Context file upload/finalize also needs `context:write`; polling status and listing context items need `context:read`.

Updating a scope replaces whole lists such as `connectionSet`, `contextSelections`, and `evaluations`. Add or change one evaluation case with `scopes.evaluations(id).addCase`, `updateCase`, or `deleteCase`. Change one connection's selection with `applySelectionOps` (`validateOnly: true` previews and does not write). Each `connectionSet` entry is `{ connection_id, preferences }`; remove a connection with the `removeConnection` op.
### Connection-specific toolsets

Use the catalog platform key and an explicit lowercase connection UUID. SQL platforms
(such as `postgresql`, `snowflake` or `bigquery`) grant `query`:

```ts
import type { PlatformToolsetEntry, ToolsetInput } from '@getmodus/sdk/management'

const toolset: ToolsetInput = {
  postgresql: {
    byConnection: {
      '11111111-1111-4111-8111-111111111111': { actions: ['query'] },
    },
  } satisfies PlatformToolsetEntry,
  slack: {
    byConnection: {
      '22222222-2222-4222-8222-222222222222': {
        actions: ['SendMessage'],
        rules: { allowedChannelIds: ['C123'], allowedChannelNames: { C123: 'support' } },
      },
    },
  } satisfies PlatformToolsetEntry,
  memory: { enabled: true },
}
await mgmt.scopes.update(scope.id, { toolset })
```

Replace the example UUIDs with your chosen connections and use action IDs from
`mgmt.tools.list()`. Each connection has its own grants; connections are never merged
or substituted. Empty slots/maps are valid. Actions are trimmed operation names without
`:` suffixes. The API rejects flat `{ actions }` entries, integration action arrays,
`scope`/personal encodings and unknown keys (including the retired `sql_runner`, `looker_bi`,
`langfuse_observability` and `*_analytics`) with a typed `UnprocessableError` (422), even when
resending a stored value. General tools, MCP, Pipedream and Coding formats are unchanged.

## Pagination

List endpoints return a `Page<T>`. Iterate the current page, or use `.autoPagingIter()` for all pages:

```ts
for await (const scope of (await client.scopes.list()).autoPagingIter()) {
  console.log(scope.name)
}
```

`client.modus.conversations.list()` accepts `kind: 'modus' | 'skills' | 'all'` (default `'all'`).

## Error handling

```ts
import {
  Modus,
  BadRequestError,
  NotFoundError,
  AuthenticationError,
  PermissionDeniedError,
  RateLimitError,
  ValidationError,
  ModusError,
} from '@getmodus/sdk'

try {
  await client.scopes.get(999)
} catch (e) {
  if (e instanceof NotFoundError) {
    console.log('Scope not found')
  } else if (e instanceof BadRequestError) {
    console.log(`Invalid request: ${e.message}`)
  } else if (e instanceof AuthenticationError) {
    console.log('Check your MODUS_API_KEY')
  } else if (e instanceof PermissionDeniedError) {
    console.log('Token is missing scopes:', e.info?.missing)
  } else if (e instanceof RateLimitError) {
    console.log(`Rate limited. Retry after ${e.retryAfter}s`)
  } else if (e instanceof ValidationError) {
    // Rejected by the SDK before any request was sent, so there is no status or requestId
    console.log(`Invalid argument: ${e.message}`)
  } else if (e instanceof ModusError) {
    console.log(`API error ${e.statusCode} ${e.code}: ${e.message} (request ${e.requestId}, trace ${e.traceId})`)
  } else {
    throw e
  }
}
```

Every error the server returns carries `statusCode`, `code` (for example `NOT_FOUND`),
`requestId` and `traceId` (quote both to support) and, when the server sends one, `info` with
structured detail. An `APIConnectionError` (no response was received) carries only
`traceId`, which names the call; the request may still have reached Modus and run, so check
before repeating a create. A `ValidationError` (for
example an unsupported chat model) is raised by the SDK before a request is sent, so it has none
of these. A request that fails schema
validation is a `BadRequestError` (400); one that is well-formed but breaks a business rule
is an `UnprocessableError` (422), with the rule in `info`.

## Retries

A failed request is re-sent up to `maxRetries` times (default 2, with exponential backoff),
but only when sending it twice cannot do the work twice:

- **429**, for every method. A `Retry-After` (or `retry-after-ms`) of up to 60 s is waited
  out; a longer one throws `RateLimitError` at once with `retryAfter` set.
- **A connection that never opened** (refused, DNS failure, connect timeout), for every method.
- **408, 500, 502, 503, 504, a dropped connection or a timeout**, for GET, PUT, PATCH and
  DELETE, and for the POSTs that only read or set a state (context compose, item lookup,
  memory search, active-run lookup, run cancel, run interrupt, workflow-action cancel, workflow toggle,
  ingested-data upload).

Any other POST (a create, an add, an evaluation run) may already have run on the server, so
it throws instead of being re-sent: check whether the resource exists before creating it
again. `e.retryable` tells you whether the SDK considered the failure safe to re-send.
Pass `maxRetries: 0` to turn retries off.

## Examples

Runnable scripts live in the [GitHub repository](https://github.com/modus-data/modus-sdk-typescript/tree/main/examples/scripts),
not in the npm package. Each imports `@getmodus/sdk`, so run it from an ES-module project with the
SDK installed:

- `examples/scripts/quickstart.ts` — list scopes and context (`Modus`)
- `examples/scripts/modus_chat.ts` — awaited and streamed Modus chat, context compose, conversations
- `examples/scripts/chat.ts` — scope chat with thread follow-up
- `examples/scripts/manage_skill.ts` — create and deploy a scope (`ModusManagement`, `--write` optional)

```bash
mkdir modus-examples && cd modus-examples
npm init -y && npm pkg set type=module
npm install @getmodus/sdk tsx
curl -fsSLO https://raw.githubusercontent.com/modus-data/modus-sdk-typescript/main/examples/scripts/quickstart.ts
export MODUS_API_KEY=modus_pat_xxx
npx tsx quickstart.ts
```

For SQL in `manage_skill.ts`, set both `MODUS_SQL_PLATFORM` (for example `postgresql`)
and `MODUS_SQL_CONNECTION_ID` to a connection you can access; SQL is omitted otherwise.

See [CHANGELOG.md](./CHANGELOG.md) for release history.

## Docs

Full guides: [docs.getmodus.com/guides/sdk](https://docs.getmodus.com/guides/sdk) (TypeScript page: [sdk-typescript](https://docs.getmodus.com/guides/sdk-typescript)).
