import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ts from 'typescript'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// A consumer project with the package laid out as npm installs it (package.json + dist,
// which the test target builds first), type-checked under each moduleResolution a
// customer tsconfig may still use. `node` (node10) ignores `exports`, so the
// `/management` subpath resolves only through `typesVersions`.
const PACKAGE_ROOT = join(import.meta.dirname, '..')
let project: string

beforeAll(() => {
  project = mkdtempSync(join(tmpdir(), 'modus-sdk-consumer-'))
  const installed = join(project, 'node_modules/@getmodus/sdk')
  mkdirSync(installed, { recursive: true })
  cpSync(join(PACKAGE_ROOT, 'package.json'), join(installed, 'package.json'))
  cpSync(join(PACKAGE_ROOT, 'dist'), join(installed, 'dist'), { recursive: true })
  writeFileSync(
    join(project, 'index.ts'),
    [
      "import { Modus } from '@getmodus/sdk'",
      "import { ModusManagement } from '@getmodus/sdk/management'",
      'export const clients: [Modus, ModusManagement] | undefined = undefined',
      '',
    ].join('\n'),
  )
})

afterAll(() => {
  rmSync(project, { recursive: true, force: true })
})

const RESOLUTIONS: Array<[string, ts.CompilerOptions]> = [
  [
    'node',
    {
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      ignoreDeprecations: '6.0',
    },
  ],
  ['node16', { module: ts.ModuleKind.Node16, moduleResolution: ts.ModuleResolutionKind.Node16 }],
  ['nodenext', { module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext }],
  ['bundler', { module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler }],
]

describe('installed package type resolution', () => {
  it.each(RESOLUTIONS)('resolves both entry points under moduleResolution %s', (_name, options) => {
    const program = ts.createProgram([join(project, 'index.ts')], {
      ...options,
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      types: [],
    })
    const errors = ts
      .getPreEmitDiagnostics(program)
      .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))
    expect(errors).toEqual([])
  }, 60_000)
})
