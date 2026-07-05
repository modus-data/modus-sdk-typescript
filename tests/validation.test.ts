import { describe, expect, it } from 'vitest'
import { ValidationError } from '../src/_exceptions.js'
import { assertWriteBodyKeys, validateId, validatePageSize } from '../src/_validation.js'

describe('validation', () => {
  it('validatePageSize rejects invalid values', () => {
    expect(() => validatePageSize(0)).toThrow(/positive int/)
    expect(() => validatePageSize(201, 200)).toThrow(/<= 200/)
    expect(() => validatePageSize(25)).not.toThrow()
  })

  it('validateId rejects blank strings', () => {
    expect(() => validateId('  ', 'scope_id')).toThrow(/scope_id/)
    expect(() => validateId('abc')).not.toThrow()
    expect(() => validateId(42)).not.toThrow()
  })

  it('assertWriteBodyKeys rejects unknown fields', () => {
    expect(() =>
      assertWriteBodyKeys('ScopesController_create', { name: 'x', title: 'bad' }),
    ).toThrow(ValidationError)
    expect(() => assertWriteBodyKeys('ScopesController_create', { name: 'x' })).not.toThrow()
    expect(() => assertWriteBodyKeys('ScopesController_delete', { extra: 1 })).not.toThrow()
  })
})
