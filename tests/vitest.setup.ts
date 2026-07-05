/** Keep unit tests independent of repo-root .env MODUS_* exports. */
const MODUS_ENV_KEYS = [
  'MODUS_API_KEY',
  'MODUS_BASE_URL',
  'MODUS_TIMEOUT',
  'MODUS_MAX_RETRIES',
] as const

for (const key of MODUS_ENV_KEYS) {
  delete process.env[key]
}
