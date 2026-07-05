import { describe, expect, it } from 'vitest'
import { updateMaskQuery } from '../src/_query.js'
import {
  accessConfigWireForCreate,
  accessConfigWireForUpdate,
} from '../src/management/_access-config.js'

describe('updateMaskQuery', () => {
  it('returns query dict when mask provided', () => {
    expect(updateMaskQuery('name,description')).toEqual({ updateMask: 'name,description' })
  })

  it('rejects empty mask', () => {
    expect(() => updateMaskQuery('  ')).toThrow(/non-empty/)
  })
})

describe('access config helpers', () => {
  it('create wire includes guardrails', () => {
    const wire = accessConfigWireForCreate(['no-pii'])
    expect(wire.guardrails).toEqual(['no-pii'])
    expect(wire.visibility).toBe('shared')
  })

  it('update merges into existing', () => {
    const merged = accessConfigWireForUpdate({ visibility: 'shared', guardrails: [] }, ['x'])
    expect(merged.guardrails).toEqual(['x'])
    expect(merged.visibility).toBe('shared')
  })
})
