import type { components } from '../_generated/v1.js'

export type SuggestionQuestion = components['schemas']['SuggestionQuestionDto']
export type SuggestionEventType = components['schemas']['SuggestionEventType']
export type SuggestionEventSource = components['schemas']['SuggestionEventSource']

/** Wire format (snake_case) plus camelCase aliases for DX. */
export type RecordSuggestionEventRequest = components['schemas']['RecordSuggestionEventDto'] & {
  eventType?: components['schemas']['SuggestionEventType']
  skillId?: number
  threadId?: string
}

/** Normalize to the OpenAPI allowlist keys (`event_type`, not `eventType`). */
export function normalizeRecordSuggestionEvent(
  event: RecordSuggestionEventRequest,
): components['schemas']['RecordSuggestionEventDto'] {
  const eventType = event.event_type ?? event.eventType
  if (eventType === undefined) {
    throw new Error('recordEvent requires event_type (or eventType)')
  }
  const body: components['schemas']['RecordSuggestionEventDto'] = {
    event_type: eventType,
    source: event.source,
  }
  const skillId = event.skill_id ?? event.skillId
  if (skillId !== undefined) body.skill_id = skillId
  const threadId = event.thread_id ?? event.threadId
  if (threadId !== undefined) body.thread_id = threadId
  if (event.metadata !== undefined) body.metadata = event.metadata
  return body
}
