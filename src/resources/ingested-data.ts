import type { ModusConfig } from '../_config.js'
import type { HttpClient } from '../_http.js'
import { invokeWithRetry } from '../_request.js'
import type {
  IngestedDataUploadResult,
  UploadIngestedDataOptions,
} from '../types/ingested-data.js'

/** Store exact integration requests and responses as immutable ingested data. */
export class IngestedDataResource {
  /** @internal */
  constructor(
    private readonly http: HttpClient,
    private readonly config: ModusConfig,
  ) {}

  /**
   * Store a complete SQL or HTTP request and response exactly once.
   *
   * Identity covers the complete organization, integration, request, and response
   * content. A duplicate raises `ConflictError`, which means the identical payload
   * is already stored and may be treated as a safe retry outcome.
   *
   * @param options.integrationType - Canonical Modus integration identifier.
   * @param options.request - Exact SQL or HTTP request that produced the response.
   * @param options.response - Response format, optional source HTTP status, and exact string content. SQL requires CSV.
   * @returns The checksum of the stored envelope.
   * @throws {ConflictError} When the complete payload is already stored.
   *
   * @example
   * ```ts
   * const stored = await client.ingestedData.upload({
   *   integrationType: 'generic',
   *   request: { type: 'sql', query: 'SELECT id, total FROM orders' },
   *   response: { format: 'csv', content: 'id,total\n1,42.00\n' },
   * })
   * console.log(stored.checksum)
   * ```
   */
  async upload(options: UploadIngestedDataOptions): Promise<IngestedDataUploadResult> {
    const data = await invokeWithRetry(this.config, this.http, 'IngestedDataController_upload', {
      jsonBody: {
        integration_type: options.integrationType,
        request: options.request,
        response: options.response,
      },
    })
    return data as IngestedDataUploadResult
  }
}
