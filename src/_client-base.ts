import { createModusConfig, formatConfigForLog, type ModusOptions } from './_config.js'
import type { HttpClient } from './_http.js'
import { HttpClient as HttpClientImpl } from './_http.js'

/**
 * Shared client wiring for Modus and ModusManagement.
 * Resources attach in Phase 5.
 */
export abstract class ModusClientBase {
  protected readonly _config: ReturnType<typeof createModusConfig>
  protected readonly _http: HttpClient

  constructor(options: ModusOptions = {}) {
    this._config = createModusConfig(options)
    this._http = new HttpClientImpl(this._config)
  }

  get config(): Readonly<typeof this._config> {
    return this._config
  }

  /** @internal */
  get http(): HttpClient {
    return this._http
  }

  toString(): string {
    return formatConfigForLog(this._config)
  }
}
