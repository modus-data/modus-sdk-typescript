import { ScopesSupervisionResourceBase } from '../../_generated/resources/management/scopes/supervision.js'
import type { components } from '../../_generated/v1.js'

export type Supervision = components['schemas']['SupervisionDto']
export type SetSupervisionRequest = components['schemas']['SetSupervisionRequestDto']

export class ScopeSupervisionResource extends ScopesSupervisionResourceBase {}
