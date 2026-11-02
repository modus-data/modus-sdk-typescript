import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

describe('SupervisionView', () => {
  it('is what supervision get accepts', () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../src/_generated/resources/management/scopes/supervision.ts'),
      'utf8',
    )
    expect(source).toContain('view?: SupervisionView')
    expect(source).not.toContain('VariationView')
  })
})
