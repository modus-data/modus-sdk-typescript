import path from 'node:path'
import { defineConfig } from 'vitest/config'
import { ciReporterExperimental, ciReporters } from '../../../../packages/testing/src/vitest-ci-reporters.js'
import { repoSpecGlob } from '../../../../vitest.repo-specs.js'

export default defineConfig({
  define: {
    __SDK_VERSION__: JSON.stringify('0.0.0-dev'),
  },
  test: {
    name: 'modus-sdk-typescript',
    clearMocks: false,
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/integration/**', repoSpecGlob],
    setupFiles: ['./tests/vitest.setup.ts'],
    // `tsconfig.json` covers src only; type-level tests (`*.test-d.ts`) need their own.
    typecheck: {
      enabled: true,
      include: ['tests/**/*.test-d.ts'],
      tsconfig: './tests/tsconfig.typecheck.json',
    },
    reporters: ciReporters(path.resolve(import.meta.dirname, '../../../..')),
    experimental: ciReporterExperimental,
  },
})
