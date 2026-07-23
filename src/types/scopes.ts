import type { components } from '../_generated/v1.js'

/** Canonical public type for a Modus scope (OpenAPI `ScopeDto`). */
export type Scope = components['schemas']['ScopeDto']
export type ScopeStatus = Scope['status']
export type ScopeVariation = components['schemas']['SkillVariationDto']

/** @deprecated Use `Scope` instead. */
export type Skill = Scope
/** @deprecated Use `ScopeStatus` instead. */
export type SkillStatus = ScopeStatus
/** @deprecated Use `ScopeVariation` instead. */
export type SkillVariation = ScopeVariation
