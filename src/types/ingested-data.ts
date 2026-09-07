import type { components } from '../_generated/v1.js'

export type SqlIngestedDataRequest = components['schemas']['SqlIngestedDataRequestDto']
export type HttpIngestedDataRequest = components['schemas']['HttpIngestedDataRequestDto']
export type IngestedDataRequest = components['schemas']['CreateIngestedDataDto']['request']
export type IngestedDataResponseFormat = components['schemas']['IngestedDataResponseFormat']
export type IngestedDataResponse = components['schemas']['IngestedDataResponseDto']

/** Complete content used to identify an immutable ingested-data upload. */
export interface UploadIngestedDataOptions {
  integrationType: string
  request: IngestedDataRequest
  response: IngestedDataResponse
}

/** Location and identity of a newly stored ingested-data envelope. */
export type IngestedDataUploadResult = components['schemas']['CreatedIngestedDataResponseDto']
