import { randomUUID } from 'node:crypto'
import { ScopesEvaluationsResourceBase } from '../../_generated/resources/management/scopes/evaluations.js'
import { invokeWithRetry, omitUndefined } from '../../_request.js'
import { validateId } from '../../_validation.js'
import type { AddEvaluationCase, EvaluationCase, UpdateEvaluationCase } from '../types/evaluations.js'

/** Scheduled and manual scope evaluations. */
export class ScopeEvaluationsResource extends ScopesEvaluationsResourceBase {
  /**
   * Add one evaluation case and return the stored case.
   *
   * @param input.task - What the scope should do. An empty string is allowed.
   * @param input.expectedOutput - What a correct result looks like. An empty string is allowed.
   * @param input.id - Stable id. Omit it and the client assigns one before the request, so a retry sends the same id.
   * @returns The stored evaluation case, including its id.
   * @throws ConflictError An evaluation case with this id already exists. A retry after the case was stored returns this error. An identical body is not treated as success.
   * @example
   * ```ts
   * const mgmt = new ModusManagement()
   * const added = await mgmt.scopes.evaluations(42).addCase({
   *   task: "Summarize last quarter's revenue",
   *   expectedOutput: 'A one-paragraph summary with the total',
   * })
   * console.log(added.id)
   * ```
   */
  async addCase(input: AddEvaluationCase): Promise<EvaluationCase> {
    validateId(this.scopeId, 'scope_id')
    const id = input.id ?? randomUUID()
    validateId(id, 'id')
    return await invokeWithRetry(this.config, this.http, 'ScopesController_addEvaluationCase', {
      pathParams: { id: this.scopeId },
      jsonBody: omitUndefined({ ...input, id }),
    }) as EvaluationCase
  }

  /**
   * Change the task, the expected output, or both, for one evaluation case.
   *
   * @param caseId - Id of the case to change.
   * @param patch.task - Replacement task. Omit to leave it unchanged.
   * @param patch.expectedOutput - Replacement expected output. Omit to leave it unchanged.
   * @returns The evaluation case after the change.
   * @example
   * ```ts
   * const mgmt = new ModusManagement()
   * const updated = await mgmt.scopes.evaluations(42).updateCase('CASE_ID', {
   *   task: 'Summarize revenue in two sentences',
   * })
   * console.log(updated.task)
   * ```
   */
  async updateCase(caseId: string, patch: UpdateEvaluationCase): Promise<EvaluationCase> {
    validateId(this.scopeId, 'scope_id')
    validateId(caseId, 'case_id')
    return await invokeWithRetry(this.config, this.http, 'ScopesController_updateEvaluationCase', {
      pathParams: { id: this.scopeId, caseId },
      jsonBody: omitUndefined(patch),
    }) as EvaluationCase
  }

  /**
   * Remove one evaluation case. The other cases stay as they are.
   *
   * @param caseId - Id of the case to remove.
   * @example
   * ```ts
   * const mgmt = new ModusManagement()
   * await mgmt.scopes.evaluations(42).deleteCase('CASE_ID')
   * ```
   */
  async deleteCase(caseId: string): Promise<void> {
    validateId(this.scopeId, 'scope_id')
    validateId(caseId, 'case_id')
    await invokeWithRetry(this.config, this.http, 'ScopesController_deleteEvaluationCase', {
      pathParams: { id: this.scopeId, caseId },
    })
  }
}
