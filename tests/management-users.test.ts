import { describe, expect, it, vi } from 'vitest'
import { ModusManagement } from '../src/management/index.js'
import type { MemberGroup } from '../src/management/users.js'

const TEST_KEY = 'modus_test_key_mgmt'
const BASE = 'https://api.getmodus.com'

describe('MemberGroup type contract', () => {
  it('member_ids is optional — compiles without it as long as member_count is present', () => {
    // Compile-time assertion: this object literal only type-checks against `MemberGroup`
    // because `member_ids` is optional — if a future regen ever re-widened it back to
    // required, this assignment would fail to compile. That's only exercised when a
    // developer runs `tsc` against this file by hand: the SDK's tsconfig excludes
    // `tests/`, and `vitest run` transpiles this file without type-checking it, so no
    // CI gate currently enforces this assertion. Pre-existing repo gap, not fixed here.
    const directoryRow: MemberGroup = {
      uid: 'grp_directory_1',
      name: 'Engineering',
      description: 'Synced from Okta',
      created_at: '2026-01-02T00:00:00.000Z',
      updated_at: '2026-01-02T00:00:00.000Z',
      source: 'directory',
      member_count: 42,
    }
    expect(directoryRow.member_ids).toBeUndefined()
    expect(directoryRow.member_count).toBe(42)
  })
})

describe('ModusManagement.users', () => {
  it('listMemberGroups returns native rows with member_ids and directory rows without it', async () => {
    const nativeRow = {
      uid: 'grp_native_1',
      name: 'Everyone',
      description: 'All org members',
      member_ids: ['user_1', 'user_2'],
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      source: 'native',
    }
    const directoryRow = {
      uid: 'grp_directory_1',
      name: 'Engineering',
      description: 'Synced from Okta',
      created_at: '2026-01-02T00:00:00.000Z',
      updated_at: '2026-01-02T00:00:00.000Z',
      source: 'directory',
      member_count: 42,
    }
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ groups: [nativeRow, directoryRow], nextPageToken: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const mgmt = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    const groups = await mgmt.users.listMemberGroups()

    expect(groups).toHaveLength(2)
    const [native, directory] = groups

    expect(native?.uid).toBe('grp_native_1')
    expect(native?.member_ids).toEqual(['user_1', 'user_2'])
    expect(native?.member_count).toBeUndefined()

    expect(directory?.uid).toBe('grp_directory_1')
    expect(directory?.member_ids).toBeUndefined()
    expect(directory?.member_count).toBe(42)

    expect(String(fetch.mock.calls[0]?.[0])).toContain('/api/v1/users/member-groups')
  })
})
