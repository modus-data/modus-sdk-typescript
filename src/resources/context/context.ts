import type { ModusConfig } from '../../_config.js'
import type { HttpClient } from '../../_http.js'
import { CustomContextItemsResource } from './custom-items.js'
import { ContextItemsResource } from './items.js'

/**
 * Read access to the Modus knowledge base.
 *
 * - {@link ContextItemsResource items} — list and look up indexed knowledge-base items.
 * - {@link CustomContextItemsResource customItems} — create and manage custom context items.
 *
 * Call path: `client.context` after `new Modus(...)`.
 */
export class ContextResource {
  readonly items: ContextItemsResource
  readonly customItems: CustomContextItemsResource

  /** @internal */
  constructor(http: HttpClient, config: ModusConfig) {
    this.items = new ContextItemsResource(http, config)
    this.customItems = new CustomContextItemsResource(http, config)
  }
}
