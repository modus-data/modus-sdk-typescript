import { defineConfig } from 'vitest/config'

export default defineConfig({
  define: {
    __SDK_VERSION__: JSON.stringify('0.0.0-dev'),
  },
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/integration/**'],
    setupFiles: ['./tests/vitest.setup.ts'],
  },
})
