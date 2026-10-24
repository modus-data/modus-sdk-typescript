import { defineConfig } from 'vitest/config'
import { repoSpecGlob } from '../../../../vitest.repo-specs.js'

export default defineConfig({
  define: {
    __SDK_VERSION__: JSON.stringify('0.0.0-dev'),
  },
  test: {
    clearMocks: false,
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/integration/**', repoSpecGlob],
    setupFiles: ['./tests/vitest.setup.ts'],
  },
})
