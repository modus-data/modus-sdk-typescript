import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const EXAMPLES_DIR = join(import.meta.dirname, '../examples/scripts')

const EXPECTED = ['quickstart.ts', 'modus_chat.ts', 'chat.ts', 'manage_skill.ts']

describe('shipped examples', () => {
  it('all expected example scripts exist', () => {
    const onDisk = readdirSync(EXAMPLES_DIR).filter((name) => name.endsWith('.ts'))
    expect(onDisk.sort()).toEqual([...EXPECTED].sort())
  })

  it.each(EXPECTED)('%s imports from @getmodus/sdk', (filename) => {
    const text = readFileSync(join(EXAMPLES_DIR, filename), 'utf8')
    expect(text).toMatch(/@getmodus\/sdk/)
  })
})
