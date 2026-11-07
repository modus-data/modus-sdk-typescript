import { readFileSync } from 'node:fs'
import { defineConfig } from 'tsup'

const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string }

export default defineConfig({
  entry: ['src/index.ts', 'src/management/index.ts'],
  format: ['esm', 'cjs'],
  // One shared chunk for both entrypoints in CJS too: without it `management/index.cjs` bundles its own
  // copies of the error classes and `Page`, so `instanceof ModusError` fails across entrypoints.
  splitting: true,
  dts: true,
  clean: true,
  sourcemap: true,
  define: {
    __SDK_VERSION__: JSON.stringify(version),
  },
})
