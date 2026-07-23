/**
 * Manage scopes with ModusManagement().
 *
 * Read-only by default. Pass --write to create, update, and deploy a sample scope;
 * add --delete to remove it at the end of the run.
 *
 *   export MODUS_API_KEY=modus_xxx
 *   npx tsx examples/scripts/manage_skill.ts
 *   npx tsx examples/scripts/manage_skill.ts --write
 *   npx tsx examples/scripts/manage_skill.ts --write --delete
 */
import { Modus } from '@getmodus/sdk'
import { ModusManagement } from '@getmodus/sdk/management'

const EXAMPLE_PREFIX = '[SDK Example]'

function exampleName(): string {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
  return `${EXAMPLE_PREFIX} Revenue Analysis ${stamp}`
}

function toolsetForExample(): Record<string, unknown> {
  const sqlSelector = process.env.MODUS_SQL_SELECTOR
  if (sqlSelector) {
    return {
      sql_runner: { enabled: true, selectors: [sqlSelector] },
      memory: { enabled: true },
    }
  }
  return { memory: { enabled: true } }
}

const write = process.argv.includes('--write')
const del = process.argv.includes('--delete')

if (!process.env.MODUS_API_KEY) {
  console.error('Export MODUS_API_KEY before running:\n  export MODUS_API_KEY=modus_xxx')
  process.exit(1)
}
if (del && !write) {
  console.error('--delete requires --write.')
  process.exit(1)
}

const read = new Modus()
console.log('=== Scopes ===')
const scopes: Awaited<ReturnType<typeof read.scopes.list>>['items'] = []
for await (const scope of (await read.scopes.list()).autoPagingIter()) {
  scopes.push(scope)
}
for (const scope of scopes) {
  const status = scope.status === 'active' ? 'active' : 'draft'
  const marker = scope.name.startsWith(EXAMPLE_PREFIX) ? '  <- example' : ''
  console.log(`  [${status}] ${scope.name}  id=${scope.id}${marker}`)
}

if (!write) {
  console.log('\nRead-only. Pass --write to create + deploy a sample scope.')
  process.exit(0)
}

const mgmt = new ModusManagement()
const name = exampleName()
console.log(`\n=== Creating scope: ${JSON.stringify(name)} ===`)
const created = await mgmt.scopes.create({
  name,
  description:
    'Sample revenue & ARR analyst scope from manage_skill.ts. Safe to delete.',
  instructions: [
    'You are a revenue analyst. Answer questions about ARR, revenue, and growth using org context and connected data.',
    'Cite the tables or queries you rely on when possible.',
  ],
  model: 'claude-sonnet-5',
  toolset: toolsetForExample(),
  guardrails: ['no-pii'],
})
const scopeId = created.id
console.log(`  id=${scopeId}  status=${created.status}`)

console.log('\n=== Deploying scope ===')
const deployed = await mgmt.scopes.deploy(scopeId)
console.log(`  status=${deployed.status}`)

if (del) {
  console.log('\n=== Deleting scope ===')
  await mgmt.scopes.delete(scopeId)
  console.log(`  deleted id=${scopeId}`)
} else {
  console.log('\nScope left in place. Re-run with --write --delete to clean up.')
}
