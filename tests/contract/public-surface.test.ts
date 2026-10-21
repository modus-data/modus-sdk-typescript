import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { emitPublicSurface, walkPublicSurface } from '../../../scripts/emit-public-surface.mjs'

const TEST_DIR = dirname(fileURLToPath(import.meta.url))
const SNAPSHOT_PATH = join(TEST_DIR, '../snapshots/public-surface.json')
const FIXTURES_DIR = join(TEST_DIR, '../fixtures/public-surface')

const FIXTURE_COMPILER_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2020,
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  strict: true,
  skipLibCheck: true,
}

function fixtureProgram(fileNames: string[]): ts.Program {
  return ts.createProgram({
    rootNames: fileNames.map((name) => join(FIXTURES_DIR, name)),
    options: FIXTURE_COMPILER_OPTIONS,
  })
}

describe('public surface snapshot', () => {
  it('matches the committed snapshot', () => {
    const committed = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as Record<string, string>
    expect(emitPublicSurface()).toEqual(committed)
  })

  it('reaches bound sub-resources', () => {
    const keys = Object.keys(emitPublicSurface())
    expect(keys).toContain('ScopeMemoriesResource.list')
    expect(keys).toContain('ConnectionsResource.find')
  })

  it('leaks no absolute filesystem paths (deterministic across machines)', () => {
    const values = Object.values(emitPublicSurface())
    const leaked = values.filter((v) => /\/Users\/|\/home\/|[A-Za-z]:\\|import\("(?:\/|[A-Za-z]:[\\/])/.test(v))
    expect(leaked).toEqual([])
  })
})

describe('public surface walker — overloads and generic substitution', () => {
  it('serializes every overload, not just the first declaration', () => {
    const program = fixtureProgram(['generic-inheritance.ts'])
    const surface = walkPublicSurface(
      program,
      [{ file: join(FIXTURES_DIR, 'generic-inheritance.ts'), className: 'Modus' }],
      FIXTURES_DIR,
    )
    expect(surface['BoundResource.find']).toBe('(id: number): string\n(id: boolean): string')
  })

  it('substitutes an inherited generic member on the receiver type', () => {
    const program = fixtureProgram(['generic-inheritance.ts'])
    const surface = walkPublicSurface(
      program,
      [{ file: join(FIXTURES_DIR, 'generic-inheritance.ts'), className: 'Modus' }],
      FIXTURES_DIR,
    )
    // Resource<T>.get() is declared as `(): T`; BoundResource extends Resource<string>, so the
    // receiver-resolved signature must read `(): string`, not the generic base declaration's `T`.
    expect(surface['BoundResource.get']).toBe('(): string')
  })
})

describe('public surface walker — export resolution', () => {
  it('fails loudly when the entry class is not exported', () => {
    const file = join(FIXTURES_DIR, 'not-exported.ts')
    const program = fixtureProgram(['not-exported.ts'])
    expect(() =>
      walkPublicSurface(program, [{ file, className: 'Modus' }], FIXTURES_DIR),
    ).toThrow(/not exported/)
  })

  it('follows a re-exported alias to the real class', () => {
    const file = join(FIXTURES_DIR, 'reexport.ts')
    const program = fixtureProgram(['reexport.ts', 'reexport-source.ts'])
    const surface = walkPublicSurface(program, [{ file, className: 'Modus' }], FIXTURES_DIR)
    expect(surface['Modus.value']).toBe('string')
  })
})
