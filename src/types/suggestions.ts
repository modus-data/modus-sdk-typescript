import type { components } from '../_generated/v1.js'

export type SuggestionQuestion = components['schemas']['SuggestionQuestionDto']
export type SuggestionEventType = components['schemas']['SuggestionEventType']
export type SuggestionEventSource = components['schemas']['SuggestionEventSource']

/** Request body for recording a suggestion event (camelCase, matches the wire). */
export type RecordSuggestionEventRequest = components['schemas']['RecordSuggestionEventDto']
