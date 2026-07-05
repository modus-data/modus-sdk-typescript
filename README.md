# @modus/sdk

Official TypeScript client for Modus (pre-release).

**Runtime:** Node.js 18+. Ships **ESM** and **CommonJS**. Not intended for browsers or edge runtimes (uses Node APIs such as `process.env`).

## Install (coming soon)

```bash
npm install @modus/sdk@beta
```

## Usage

### ESM (`import`)

```ts
import { Modus } from '@modus/sdk'
import { ModusManagement } from '@modus/sdk/management'

const client = new Modus({ apiKey: process.env.MODUS_API_KEY })
const mgmt = new ModusManagement({ apiKey: process.env.MODUS_API_KEY })

const scopes = await client.scopes.list()
const draft = await mgmt.scopes.create({ name: 'Analyst', model: 'claude-sonnet-5' })
```

### CommonJS (`require`)

```js
const { Modus } = require('@modus/sdk')
const { ModusManagement } = require('@modus/sdk/management')

const client = new Modus({ apiKey: process.env.MODUS_API_KEY })
```

## Examples

Runnable scripts (mirrored to the public GitHub repo):

- `examples/scripts/quickstart.ts` — list scopes and context (`Modus`)
- `examples/scripts/modus_chat.ts` — buffered and streaming Modus chat, context compose, conversations
- `examples/scripts/chat.ts` — buffered scope chat with thread follow-up
- `examples/scripts/manage_skill.ts` — create and deploy a scope (`ModusManagement`, `--write` optional)

```bash
export MODUS_API_KEY=modus_xxx
npx tsx examples/scripts/quickstart.ts
```

From the Modus monorepo (after build):

```bash
pnpm nx run modus-sdk-typescript:build
MODUS_API_KEY=modus_xxx node --import tsx distribution/clients/typescript/modus-sdk/examples/scripts/quickstart.ts
```

## Development

From the Modus monorepo root:

```bash
pnpm nx run modus-sdk-typescript:generate
pnpm nx run modus-sdk-typescript:build
pnpm nx run modus-sdk-typescript:test
```

See [`../dev-examples/`](../dev-examples/) for additional runnable scripts (monorepo only).

```bash
# Batch smoke (from repo root; uses .env for MODUS_API_KEY / MODUS_BASE_URL)
bash distribution/clients/typescript/dev-examples/run_all.sh
bash distribution/clients/typescript/dev-examples/run_all.sh --write
bash distribution/clients/typescript/dev-examples/run_all.sh --chat   # LLM credits; needs healthy agent backend
```

Shipped `chat.ts` accepts optional `MODUS_SCOPE_ID` to pick the scope. Chat may return `INTERNAL_ERROR` when the target environment's agent runtime is down — that is not an SDK bug.

See [CHANGELOG.md](./CHANGELOG.md) for release history.
