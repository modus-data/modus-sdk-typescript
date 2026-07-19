/**
 * Scope chat: ask a revenue / ARR question, then follow up on the same thread.
 *
 * For org-wide Modus chat (home-page assistant), see modus_chat.ts.
 *
 * Uses API credits. Requires a token with scopes:invoke.
 * Optional: MODUS_SCOPE_ID to target a specific active scope.
 *
 *   export MODUS_API_KEY=modus_xxx
 *   npx tsx examples/scripts/chat.ts
 */
import type { Skill } from '@getmodus/sdk'
import { Modus } from '@getmodus/sdk'

const MODEL = 'claude-sonnet-5'
const FIRST_MESSAGE =
  'What is our current ARR and how has it trended over the last four quarters?'
const FOLLOW_UP = 'Which customer segments contributed most to that growth?'

function scopeIdMatches(scopeId: number, raw: string): boolean {
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? scopeId === parsed : String(scopeId) === raw
}

function pickScopeForChat(scopes: Skill[]): Skill {
  const override = process.env.MODUS_SCOPE_ID
  if (override) {
    const match = scopes.find((scope) => scopeIdMatches(scope.id, override))
    if (!match) {
      console.error(`MODUS_SCOPE_ID=${override} not found in listed scopes.`)
      process.exit(1)
    }
    if (match.status !== 'active') {
      console.error(`MODUS_SCOPE_ID=${override} found, but the scope is not active.`)
      process.exit(1)
    }
    return match
  }

  const stable = scopes.filter(
    (scope) => scope.status === 'active' && !scope.hasUnpublishedChanges,
  )
  if (stable.length > 0) {
    return stable[0]
  }

  const active = scopes.find((scope) => scope.status === 'active')
  if (active) {
    return active
  }

  console.error('No active scopes found — deploy a scope first.')
  process.exit(1)
}

if (!process.env.MODUS_API_KEY) {
  console.error('Export MODUS_API_KEY before running:\n  export MODUS_API_KEY=modus_xxx')
  process.exit(1)
}

const client = new Modus()
const scopes: Skill[] = []
for await (const scope of (await client.scopes.list()).autoPagingIter()) {
  scopes.push(scope)
}
if (scopes.length === 0) {
  console.error('No scopes found — create and deploy one in the Modus app first.')
  process.exit(1)
}

const scope = pickScopeForChat(scopes)
console.log(`Scope: ${scope.name} (id=${scope.id})`)

const result = await client.scopes.chat(scope.id, FIRST_MESSAGE, { model: MODEL })
console.log(`\nQuestion: ${FIRST_MESSAGE}`)
console.log(`Answer: ${result.content}`)
console.log(`  threadId=${result.threadId}`)

const followUp = await client.scopes.chat(scope.id, FOLLOW_UP, {
  model: MODEL,
  threadId: result.threadId,
})
console.log(`\nFollow-up: ${FOLLOW_UP}`)
console.log(`Answer: ${followUp.content}`)
console.log(`  threadId=${followUp.threadId}`)
