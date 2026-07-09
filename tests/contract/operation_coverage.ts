/**
 * Single source of truth: which OpenAPI operations the SDK exposes.
 *
 * Every operation in openapi/v1.json must appear here with a note on where the
 * SDK method lives. Each mapped operation makes a real HTTP call.
 */

/** operationId → short note on where/how the SDK exposes it. */
export const OPERATIONS: Record<string, string> = {
  // --- Scopes (/api/v1/scopes) ---
  ScopesController_list: 'client.scopes.list() / mgmt.scopes.list()',
  ScopesController_create: 'mgmt.scopes.create()',
  ScopesController_get: 'client.scopes.get() / mgmt.scopes.get()',
  ScopesController_update: 'mgmt.scopes.update()',
  ScopesController_delete: 'mgmt.scopes.delete()',
  ScopesController_deploy: 'mgmt.scopes.deploy()',
  ScopesController_restore: 'mgmt.scopes.restore()',
  ScopesController_getVariation: 'mgmt.scopes.getVariation()',
  ScopesController_patchMcpConfig: 'mgmt.scopes.patchMcpConfig()',
  ScopesController_requestOwnershipTransfer: 'mgmt.scopes.requestOwnershipTransfer()',
  ScopesController_cancelOwnershipTransfer: 'mgmt.scopes.cancelOwnershipTransfer()',
  ScopesController_acceptOwnershipTransfer: 'mgmt.scopes.acceptOwnershipTransfer()',
  ScopeChatController_chat: 'client.scopes.chat() / client.scopes.chatStream()',
  ScopeChatController_chatContinue: 'client.scopes.chat({ threadId })',
  ScopeContextController_compose: 'client.scopes.getContext()',
  ScopeConversationsController_list: 'client.scopes.conversations(id).list()',
  ScopeConversationsController_get: 'client.scopes.conversations(id).get()',
  ScopeMemoriesController_list: 'mgmt.scopes.memories(id).list()',
  ScopeMemoriesController_search: 'mgmt.scopes.memories(id).search()',
  ScopeMemoriesController_update: 'mgmt.scopes.memories(id).update()',
  ScopeMemoriesController_delete: 'mgmt.scopes.memories(id).delete()',
  EvaluationsController_getConfig: 'mgmt.scopes.evaluations(id).getConfig()',
  EvaluationsController_updateConfig: 'mgmt.scopes.evaluations(id).updateConfig()',
  EvaluationsController_triggerRun: 'mgmt.scopes.evaluations(id).triggerRun()',
  EvaluationsController_listRuns: 'mgmt.scopes.evaluations(id).listRuns()',
  EvaluationsController_getRun: 'mgmt.scopes.evaluations(id).getRun(runId)',
  ScopeRunsController_create: 'client.workflows.runs.createScope(scopeId, body)',
  // --- Modus ---
  ModusChatController_chat: 'client.modus.chat() / client.modus.chatStream()',
  ModusChatController_chatContinue: 'client.modus.chat({ threadId })',
  ModusContextController_compose: 'client.modus.getContext()',
  ModusConversationsController_list: 'client.modus.conversations.list()',
  ModusConversationsController_get: 'client.modus.conversations.get()',
  // --- Workflows (/api/v1/workflows) ---
  WorkflowsController_list: 'client.workflows.list() / mgmt.workflows.list()',
  WorkflowsController_create: 'mgmt.workflows.create()',
  WorkflowsController_get: 'client.workflows.get() / mgmt.workflows.get()',
  WorkflowsController_update: 'mgmt.workflows.update()',
  WorkflowsController_delete: 'mgmt.workflows.delete()',
  WorkflowsController_deploy: 'mgmt.workflows.deploy()',
  WorkflowsController_restore: 'mgmt.workflows.restore()',
  WorkflowsController_requestOwnershipTransfer: 'mgmt.workflows.requestOwnershipTransfer()',
  WorkflowsController_cancelOwnershipTransfer: 'mgmt.workflows.cancelOwnershipTransfer()',
  WorkflowsController_acceptOwnershipTransfer: 'mgmt.workflows.acceptOwnershipTransfer()',
  WorkflowRunsController_list: 'client.workflows.runs.list()',
  WorkflowRunsController_get: 'client.workflows.runs.get()',
  WorkflowRunsController_create: 'client.workflows.runs.create(workflowId, body)',
  ModusRunsController_create: 'client.workflows.runs.createModus(body)',
  ResumeRunsController_create: 'client.workflows.runs.resume(runId, body)',
  RunLifecycleController_active: 'client.workflows.runs.active()',
  RunLifecycleController_activeBySession: 'client.workflows.runs.activeBySession(sessionIds)',
  RunLifecycleController_cancel: 'client.workflows.runs.cancel()',
  RunLifecycleController_events: 'client.workflows.runs.events()',
  RunLifecycleController_interrupt: 'client.workflows.runs.interrupt()',
  RunLifecycleController_editQueued: 'client.workflows.runs.editQueued()',
  RunLifecycleController_stream: 'client.workflows.runs.stream()',
  WorkflowActionsController_execute: 'client.workflows.workflowActions.execute()',
  WorkflowActionsController_cancel: 'client.workflows.workflowActions.cancel()',
  // --- Context ---
  ContextItemsController_list: 'client.context.items.list() / mgmt.context.items.list()',
  ContextItemsController_get: 'client.context.items.get() / mgmt.context.items.get()',
  ContextItemsController_update:
    'mgmt.context.items.update(); convenience: updateNote, updateLink, updateSavedQuery',
  ContextItemsController_delete: 'mgmt.context.items.delete()',
  ContextItemsController_lookup: 'client.context.items.lookup()',
  ContextItemsController_listValues: 'client.context.items.listValues() / listValuesFor()',
  ContextCreatorsController_createNote: 'mgmt.context.createNote()',
  ContextCreatorsController_createSavedQuery: 'mgmt.context.createSavedQuery()',
  ContextCreatorsController_createLink: 'mgmt.context.createLink()',
  // --- Connections ---
  ConnectionsController_list: 'client.connections.list()',
  // --- Suggestions ---
  SuggestionsController_listApproved: 'client.suggestions.list()',
  SuggestionsController_recordEvent: 'client.suggestions.recordEvent()',
  // --- Usage ---
  UsageController_list: 'mgmt.usage.list()',
  // --- Organization ---
  OrganizationController_deleteOrganization: 'mgmt.organization.delete()',
}
