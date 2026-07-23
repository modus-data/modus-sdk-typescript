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

const scope = await client.scopes.get('revenue-analysis')
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
export MODUS_API_KEY=modus_xxx
```

```ts
const client = new Modus({ apiKey: 'modus_xxx' })
```

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

const stream = client.modus.chatStream('Summarize this week', { model: MODEL })
for await (const chunk of stream.textStream()) {
  process.stdout.write(chunk)
}

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

const stream = client.scopes.chatStream(scopeId, 'Hi', { model: MODEL })
for await (const chunk of stream.textStream()) {
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

Workflow chat is not on the public PAT surface. Use `client.modus.chat()` for org-wide conversation or `client.scopes.chat()` for a published scope.

## Managing your org

```ts
import { ModusManagement } from '@getmodus/sdk/management'

const mgmt = new ModusManagement() // reads MODUS_API_KEY
const scope = await mgmt.scopes.create({ name: 'Analyst', model: 'claude-sonnet-5' })
await mgmt.scopes.deploy(scope.id)

// Create returns contextItemId (also available as .uid); list/get use .uid
const note = await mgmt.context.createNote('Title', 'Body')
console.log(note.contextItemId, note.uid) // same UUID
```

Requires a token with write access to scopes and workflows (same as the Modus UI).

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
  NotFoundError,
  AuthenticationError,
  RateLimitError,
  ModusError,
} from '@getmodus/sdk'

try {
  await client.scopes.get(999)
} catch (e) {
  if (e instanceof NotFoundError) {
    console.log('Scope not found')
  } else if (e instanceof AuthenticationError) {
    console.log('Check your MODUS_API_KEY')
  } else if (e instanceof RateLimitError) {
    console.log(`Rate limited. Retry after ${e.retryAfter}s`)
  } else if (e instanceof ModusError) {
    console.log(`API error ${e.statusCode}: ${e.message}`)
  } else {
    throw e
  }
}
```

## Examples

Runnable scripts ship in this repository:

- `examples/scripts/quickstart.ts` — list scopes and context (`Modus`)
- `examples/scripts/modus_chat.ts` — buffered and streaming Modus chat, context compose, conversations
- `examples/scripts/chat.ts` — buffered scope chat with thread follow-up
- `examples/scripts/manage_skill.ts` — create and deploy a scope (`ModusManagement`, `--write` optional)

```bash
export MODUS_API_KEY=modus_xxx
npx tsx examples/scripts/quickstart.ts
```

See [CHANGELOG.md](./CHANGELOG.md) for release history.
