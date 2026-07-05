/**
 * Quickstart: list scopes and org context with Modus().
 *
 * Modus is your organization's context layer — curated knowledge about your
 * data, metrics, and workflows (warehouses, dashboards, saved queries) that
 * scopes and workflows use when answering questions about revenue, ARR, and more.
 *
 * For a full analyst-style conversation, run modus_chat.ts next.
 *
 *   export MODUS_API_KEY=modus_xxx
 *   npx tsx examples/scripts/quickstart.ts
 */
import { Modus } from '@modus/sdk'

if (!process.env.MODUS_API_KEY) {
  console.error('Export MODUS_API_KEY before running:\n  export MODUS_API_KEY=modus_xxx')
  process.exit(1)
}

const client = new Modus()

console.log('=== Scopes ===')
for await (const scope of (await client.scopes.list()).autoPagingIter()) {
  console.log(`  ${scope.name}  (${scope.status})`)
}

console.log('\n=== Context (sample) ===')
console.log('  (tables, metrics, and notes Modus can compose for revenue / ARR questions)')
const page = await client.context.items.list({ pageSize: 5 })
if (page.items.length === 0) {
  console.log('  No context items yet.')
  process.exit(0)
}
for (const item of page) {
  const label = item.description ?? item.uid
  console.log(`  [${item.contextType}] ${label}`)
}
