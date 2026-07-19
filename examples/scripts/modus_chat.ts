/**
 * Modus chat: revenue / ARR questions with buffered, streaming, and context compose.
 *
 * Uses API credits. Requires a token with scopes:invoke.
 *
 *   export MODUS_API_KEY=modus_xxx
 *   npx tsx examples/scripts/modus_chat.ts
 */
import { Modus } from '@getmodus/sdk'

const MODEL = 'claude-sonnet-5'
const FIRST_MESSAGE = 'What were our top revenue drivers last quarter?'
const FOLLOW_UP = 'Break that down by region.'
const STREAM_MESSAGE = 'Summarize ARR growth trends in three bullet points.'
const CONTEXT_INTENT =
  'What tables, dashboards, and saved queries describe revenue and ARR?'

if (!process.env.MODUS_API_KEY) {
  console.error('Export MODUS_API_KEY before running:\n  export MODUS_API_KEY=modus_xxx')
  process.exit(1)
}

const client = new Modus()

const result = await client.modus.chat(FIRST_MESSAGE, { model: MODEL })
console.log(`Question: ${FIRST_MESSAGE}`)
console.log(`Answer: ${result.content}`)
console.log(`  threadId=${result.threadId}  runId=${result.runId}`)

const followUp = await client.modus.chat(FOLLOW_UP, {
  model: MODEL,
  threadId: result.threadId,
})
console.log(`\nFollow-up: ${FOLLOW_UP}`)
console.log(`Answer: ${followUp.content}`)
console.log(`  threadId=${followUp.threadId}`)

console.log(`\nStreaming (${STREAM_MESSAGE}):`)
const stream = client.modus.chatStream(STREAM_MESSAGE, { model: MODEL })
for await (const chunk of stream.textStream()) {
  process.stdout.write(chunk)
}
console.log()

const ctx = await client.modus.getContext(CONTEXT_INTENT, { limit: 5 })
console.log(
  `\nContext compose: ${ctx.originalCount} item(s) considered, ` +
    `${ctx.context.length} chars, sessionId=${ctx.sessionId}`,
)

const page = await client.modus.conversations.list({ kind: 'modus', pageSize: 5 })
console.log(`\nModus conversations (page): ${page.items.length} row(s)`)
for (const row of page) {
  const preview = (row.firstMessage ?? '').slice(0, 60)
  console.log(`  ${row.threadId}: ${JSON.stringify(preview)}`)
}
