import type { ModusConfig } from '../../_config.js'
import type { HttpClient } from '../../_http.js'
import { CustomContextItemsResource } from './custom-items.js'
import { ContextItemsResource } from './items.js'

/** Read access to the Modus knowledge base. */
export class ContextResource {
  readonly items: ContextItemsResource
  readonly customItems: CustomContextItemsResource

  constructor(http: HttpClient, config: ModusConfig) {
    this.items = new ContextItemsResource(http, config)
    this.customItems = new CustomContextItemsResource(http, config)
  }
}
