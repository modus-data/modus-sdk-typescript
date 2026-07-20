import { defineConfig } from 'vitest/config'

/** Live staging smoke — does not wipe MODUS_* env (unlike unit vitest.setup). */
export default defineConfig({
  define: {
    __SDK_VERSION__: JSON.stringify('0.0.0-dev'),
  },
  test: {
    include: ['tests/integration/**/*.test.ts'],
    testTimeout: 180_000,
    hookTimeout: 60_000,
  },
})
