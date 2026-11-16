# Changelog

Published versions come from the `sdk-typescript/v*` tags; the current release is
whatever [npm](https://www.npmjs.com/package/@getmodus/sdk) is serving. This file
records what changed, not which version is live.

Record concise, customer-visible release notes under `[Unreleased]` for every SDK
release, including pre-1.0 (`0.x`) releases.

## [Unreleased]

### Added

- **`email` run source.** `RunSource` and `SupplementalContextSource` include `email`, for runs started by an email sent to a workflow's address; the conversation list's `source` filter accepts it. Only the email trigger records it: an API-token run asking for it still records its server-owned source (`api`, or `modus_api` for Modus runs), and `supplementalContext.source: 'email'` is refused with 400.
- **`attachments` and `origin` on a workflow run.** `workflows.runs.get()` (the run detail) includes `attachments`, the files the run was started with by name, with MIME type and size when known (a file the trigger left out carries `skipped.reason`, `too_large` or `too_many`), and `origin`, where the run came from (`source`, such as `api` or `schedule`; `unknown` for a run that did not record it). An email-started run will also carry `from`, `fromName` and `subject` when the email has them. Both fields can be absent on responses from older servers. File contents are not returned.

### Removed

- **Breaking (pre-1.0): a scope read returns one `connectionSet` entry per connection.** `variation.connectionSet` is `{ connection_id: string; preferences?: Record<string, unknown> }[]`: `path` (one row per included path) and `context_enabled` are removed, so a connection appears once, with its `preferences`. `preferences` is absent only on the entry of a deleted connection, whose `connection_id` is a placeholder and which grants nothing. An entry with `preferences` can be sent back unchanged in `scopes.update()`; drop one without `preferences` first, or the write fails with 400 `legacy_entry`. Migration: read what a connection selects from its `preferences` instead of `path`.
- **Breaking (pre-1.0): `context_enabled` and `contextEnabled` are removed from scope writes.** A `connectionSet` entry in `scopes.create()` and `scopes.update()` is `{ connection_id, preferences }`, and a `setConnectionPreferences` op in `applySelectionOps()` is `{ op, connectionId, preferences }`. A scope reads context from every connection it lists. Sending `false` fails with 400 (`info.reason` `legacy_entry` on a `connectionSet` entry); `true` is ignored.

## [0.11.0] — 2026-11-14

### Added

- **`includeOrgLearnings` on `scopes.create`.** The org-wide learnings path is added to a new scope's selections unless `includeOrgLearnings: false`, or `contextSelections` already mention learnings or are context filters without a rule-based query; the scope reads the entries the caller can see. They are a learnings path in the scope's context selections (`auto_generated:org`), so they can be removed or added later like the scope's own learnings; `includeOrgLearnings: false` only skips adding the path, and selections that already name it still read them.
- **Move into a folder path.** `mgmt.context.items.move(uid, { destinationFolderPath })` moves a file or folder to a root-relative path such as `reports/2026`; missing folders on the path are created with the move, and existing ones are reused. `{ destinationFolderUid }` is unchanged.
- **`model` on a conversation.** Conversation reads include `model` (`string | null`), the identifier of the model the conversation's most recent turn ran on. `null` when no turn recorded a model; absent when it could not be read.
- **`context.items.query({ sql, maxRows? })`.** Runs one read-only SQL statement over the `context_items` table and returns `{ rows, rowCount, truncated }`. The query sees only the items you can read. At most 1,000 rows come back (`maxRows` lowers it); `truncated` says when there were more. A query that is not read-only or not valid fails with 400, and one that runs past 20 s with 422. Off by default per organization; ask Modus to enable it. `ContextItemsQuery` and `ContextItemsQueryResult` import from `@getmodus/sdk`.
- Context item access updates now support organization learnings, with the same user and group sharing controls as notes.
- **`generatedDescription` on a scope.** Scope reads include `generatedDescription` (`string | null`), the summary written for the scope so a caller can choose it. Null when none has been written.
- **Breaking (pre-1.0): `SupervisionView`.** `mgmt.scopes.supervision(id).get({ view })` takes `SupervisionView` (`'active' | 'draft'`). `published` is not a supervision view. `VariationView` now also allows `'published'`, so a value typed as `VariationView` no longer type-checks there. Migration: type it as `SupervisionView`. Runtime values are unchanged.
- **`view: 'published'` on scope and workflow list and get.** Returns the published version you can use. A scope or workflow that is only a draft, deleted, or that you can manage but not use is left out. For workflows it is also type workflow only; a task is left out. `active` and `draft` are unchanged.
- **`scopes.applySelectionOps()`.** Apply selection changes to a scope. Pass `{ validateOnly: true }` to run the same checks and return the scope that would be saved, without writing. A preview result carries `validateOnly: true`; a committed one does not, and every other field keeps its stored value, so a preview still needs a second call to save. Set a connection with `setConnectionPreferences` and remove it with `removeConnection`.
- **`claude-haiku-5.5` model.** Anthropic's Claude Haiku 5.5 is an accepted chat model id.
- **`gemini-3.8-flash` model.** Google's generally available Gemini 3.8 Flash is an accepted chat
  model id.
- **`mgmt.scopes.mcpExposureCatalog(scopeId, request)`.** Lists the tools a scope can expose to MCP clients. A field you send replaces the current draft for this call; a field you omit stays as stored. Nothing is saved. Rows you cannot access are left out, and stored selections on them are counted. `McpExposureCatalogRequest` and `McpExposureCatalog` import from `@getmodus/sdk/management`.
- **Every type a public method takes or returns is exported.** The resource classes (`WorkflowRunsResource`, `ManagementScopesResource`, …), `ModusConfig`, the custom context item inputs and results (`CreateCustomContextItemInput`, `CreatedCustomContextItem`, …), and the evaluation, usage, interface, supervision and user types import from `@getmodus/sdk` or `@getmodus/sdk/management`, so a variable that holds a result can be annotated.
- **`access` on custom context item creates.** `context.customItems.create()` and `batchCreate()` inputs take `access` (`scope`, `groupIds`, `userIds`), which the endpoint already accepted. Omitted, everyone in the organization can see the item; to change it, delete and re-create the item.
- **A trace id for every call.** Each request sends a W3C `traceparent` (a new trace per call, kept across its retries, each re-send also carrying `X-Modus-Retry-Attempt`), and every `ModusError` from an HTTP call carries it as `traceId`. Quote `traceId` with `requestId` to support: it also names a call that never reached Modus. A `traceparent` you set in `defaultHeaders` is sent as is.
- **`access` on file finalize and URL uploads.** `FinalizeUploadDto`, each `BulkFinalizeItemDto`, `UploadFromUrlDto` and each `BulkUploadFromUrlItemDto` take an optional `access` (visibility, group permissions, shared-with) that applies only when the file is first created; omitted, the file is shared with everyone with you as owner. A service-account token cannot set it.
- **Access on notes, saved queries, links and uploaded files.** `mgmt.context.items.updateAccess(uid, { visibility, groupPermissions, sharedWith })` replaces who can view and manage one of these items; an item with no owner becomes yours. `ContextItem` reads of these types carry `access` and `canManage`.
- **Resume a dropped run stream.** Every run event, `approval_required` included, carries `id`, its SSE event id (`RunEventBase`), when the server sends one, so `runs.stream(runId, { lastEventId: event.id })` resumes after that event instead of replaying the run from the start.
- **`ErrorEvent.requestId`.** A run that fails after it started ends with an `error` event that carries the id to quote to support; a chat stream throws `ModusError` with it as `requestId`.
- **`client.workflows.chat()`.** Send a published workflow a message and stream its node output; `await` it for the workflow's final output.
- **`AssistantContentResetEvent.subAgent`** marks a correction to a sub-agent's output; a reset without it corrects the assistant's own reply.
- **Approvals on chat.** A run that stops for a write approval returns `result.approval`; `chat.resume({ decision: 'approve' | 'deny' })` continues the same conversation.
- **Connection selection preferences on scopes.** A `connectionSet` entry on create and update takes
  `preferences` (`mode` `all` or `manual`, `include` / `exclude` rules of id steps); reads return
  `preferences` on the connection's first row.
- **`deepseek-v4.1-flash-1017` model.** The October 17, 2026 snapshot of DeepSeek V4.1 Flash is an
  accepted chat model id.
- **`BadRequestError`** for HTTP 400 (a schema or parse failure), a `ModusError` subclass, so
  existing `catch (e instanceof ModusError)` code is unaffected.
- **`ModusError.info`** carries the error envelope's structured detail, for example
  `info.missing` (the token scopes a 403 lacks) or `info.violations` on a 422.
- **`ModusError.retryable`** says whether the SDK's retry rule allowed re-sending the failed call.
- **`Retry-After` as an HTTP date, and `retry-after-ms`,** fill `RateLimitError.retryAfter`.
- **An organization owner can give an ownerless scope an owner.** A scope created with a service-account token has no owner. `scopes.requestOwnershipTransfer(id, { newOwnerUserId })` by an organization owner now assigns one: naming yourself takes effect at once, naming another member waits for them to accept. `scopes.cancelOwnershipTransfer(id)` lets the organization owner withdraw that request.

### Changed

- **Breaking (pre-1.0): MCP tool exposure keys name a connection (CU-z93r0b9hub).** In `mcpToolExposure.allowedIntegrationKeys`, `toolset:<connectionId>` exposes every tool granted on that connection, now and later, and never another connection's; `toolset_action:<platform>:<connectionId>:<action>` exposes one tool, a SQL connection's query tool included (`toolset_action:postgresql:<connectionId>:query`). `toolset:<platform>`, `data_connection:<connectionId>` and `data_connection_tool:` keys are retired: a stored `toolset:<platform>` key became the `toolset:<connectionId>` key of each connection the scope grants on that platform, a stored `data_connection:` key on a SQL connection became that connection's `toolset:<connectionId>`, and a retired key naming no such connection was removed, and a write adding one returns 422. `mcpExposureCatalog` lists one row per connection, and `McpExposureFamily` no longer has `data_connection`.
- **`workflows.runs.events()` returns `RunEventsPollResponse`** instead of `unknown`: `events` (each with its stream `id` and `type`), `cursor`, `status` and `done`. The response is unchanged.
- **A numeric id that is not a whole number throws `ValidationError` before any request.** `1.5`, `NaN` or `Infinity` as a scope, workflow or other numeric id was sent, and the server answered 400.
- **Breaking (pre-1.0): the `access` body on note, saved-query and link creates is dashboard-shaped.** The generated `CreateNoteDto`, `CreateSavedQueryDto` and `CreateLinkDto` types now take `access` as `UpdateContextItemAccessDto` (`visibility`, `groupPermissions`, `sharedWith`, the body `mgmt.context.items.updateAccess` takes) instead of `AccessPolicyDto` (`scope`, `groupIds`, `userIds`); the old shape is rejected with 400. Omitting `access` shares the item with everyone in the organization, with you as owner. `createNote`, `createSavedQuery` and `createLink` send no `access` and are unchanged.
- **Context compose no longer fails at 30 seconds.** `scopes.getContext()` and `modus.getContext()` now call `POST /agent/v1/scopes/{id}/context` and `POST /agent/v1/modus/context` on the agent host, the host `chat()` uses. The old routes sat behind a 30-second gateway limit, so a slower compose came back as a bare 503 and was retried up to twice more while the first one was still running. Same arguments and result; a compose may now run for up to 90 seconds, and one still running then fails with `UPSTREAM_TIMEOUT` (504). Keep `timeoutMs` above 90 seconds (the default is 300). The agent host is derived the same way as for chat: `agentHost` (or `MODUS_AGENT_HOST`), else from `baseUrl`; with a custom `baseUrl` and neither set, compose throws `ModusError` before sending anything, as chat does. If your network allows only the API host, allow the agent host too.
- **A resume with nothing to answer raises `ConflictError`.** `runs.resume` on a conversation with no write approval or connection request pending now fails with HTTP 409 (`code` `CONFLICT`) before any event, and the conversation stays usable. It used to yield one error event and leave every later turn on that conversation failing.
- **A refused run raises before any event.** When the agent host refuses a run (an empty turn, a scope you cannot see, a conflicting `Idempotency-Key`, a full conversation queue), `runs.create*`, `runs.resume` and `workflowActions` streams now raise the typed error for the HTTP status (`NotFoundError`, `PermissionDeniedError`, `ConflictError`, `RateLimitError`, or `ModusError` with `statusCode` 400) with the server's `code` and message, instead of yielding one `error` event. No SDK code changed: the host now answers with the real status. An `error` event still ends a run that fails after it started.
- **Evaluation types are now accurate (were `Record<string, never>`).** `EvaluationRun` `finishedAt` and `avgScore`, and the result fields `actualOutput`, `passed`, `score`, `reasoning` and `wasPassingBefore`, are `string | null`, `number | null` or `boolean | null`, so they no longer need a cast. An evaluation recipient's `name` is `string | null`, and `slackUserIdByRecipient` is a string-keyed map. `startedAt` and `finishedAt` are ISO 8601 strings (the server sent a JavaScript date string before).
- **Run request types document the API-token rules.** `message` notes the 32,000-character limit the server holds API tokens to, and `config.model` lists the models an API token may send.
- **Breaking (pre-1.0): scope `connectionSet` rows have one shape.** `scopes.create` and `scopes.update` accept each entry only as `{ connection_id, path, preferences?, context_enabled? }`, where `path` is an array of strings, `preferences` an object and `context_enabled` a boolean. An empty path selects the whole connection. Any other field, a non-string path segment or an empty or null `connection_id` is rejected with 400; a null `connectionSet` clears the list. `variation.connectionSet` is now `{ connection_id: string; path: string[]; preferences?: Record<string, unknown>; context_enabled?: boolean }` instead of `Record<string, unknown>[]`.
- **Breaking (pre-1.0): workflow `guardrails` removed.** `workflows.create` and `workflows.update` no longer take `guardrails`. The workflow access configuration has no guardrails, so every call that set it failed with 400 and changed nothing. Scope `guardrails` are unchanged.
- **Breaking (pre-1.0): `scopes.memories(id).update()` returns `Promise<void>`.** The server answers 204 with no body; the method returned `null` typed as `Memory`.
- **Breaking (pre-1.0): `managerId` is `number | null`.** `scopes.update({ managerId })` takes the numeric id of the manager scope, or `null` to detach. It was typed `string`, which the server rejects with 400.
- **Breaking (pre-1.0): evaluation runs `pageSize` is checked.** `scopes.evaluations(id).listRuns()` rejects a `pageSize` outside 1..100 with 400, like every other list (it was clamped above 100).
- **Breaking (pre-1.0): a POST that fails after being sent now throws instead of being
  re-sent.** Retries depend on the method: GET, PUT, PATCH and DELETE retry 408, 429, 500, 502,
  503, 504, dropped connections and timeouts. A POST retries only on 429 or a connection that
  never opened, except the POSTs that only read or set a state (context compose, item lookup, memory search, active-run lookup, run cancel, run interrupt, workflow-action cancel, workflow toggle, ingested-data upload), which retry like
  a GET. Before, a `scopes.create` that hit a gateway 502 or a timeout was sent again and could
  create a second scope; now it throws and you decide whether to re-create.
- **A `Retry-After` over 60 s throws `RateLimitError` at once** (with `retryAfter` set)
  instead of sleeping that long. Up to 60 s is still waited out.
- **Reading a workflow needs use or manage permission, not manage alone.** `workflows.get(id)` returns a workflow you can run or change; `canUse` and `canManage` say which. A workflow you cannot access is a 404 `NotFoundError` instead of a 403. `workflows.interfaces(id).list()` still needs manage permission (403), and is a 404 when you cannot access the workflow.
- **Deploying a scheduled workflow with no owner is a 409.** `workflows.deploy(id)` no longer reports an ownerless scheduled workflow as enabled when no schedule could be created.
- **A non-UUID interface id is a 400.** `workflows.interfaces(id).update()` and `.delete()` with an id that is not a UUID return 400 instead of a retried 500.
- **Dashboard and element titles must contain a non-whitespace character.** A blank title on `context.dashboards.create`, `.updateDraft`, and `.elements(id).create` / `.update` returns 400.
- **Delete docs match the server.** Deleting a workflow or scope that is already deleted returns 404; deleting a memory that no longer exists returns 404 (it returned 422). Neither is a no-op.
- **Custom context item writes are documented as opt-in.** `customItems` writes
  reject with `PermissionDeniedError` ("Custom context item writes are not
  enabled") until Modus enables them for the organization.
- **Breaking (pre-1.0): `runs.interrupt` and `runs.editQueued` take the turn to send.** `runs.interrupt(runId, nextRun, { lastSeenEventId? })` and `runs.editQueued(runId, nextRun)` send `nextRun` (`message` and `sessionId`, the run's conversation id) and return the admitted run as `RunAdmission` (`{ runId, status }`). For `interrupt`, that is the new run that carries the follow-up turn; stream it with `runs.stream(runId)`. The old signatures sent an empty body, which the server always rejected, so no working call changes behaviour. `interrupt` sets `nextRun.runId` when you omit it, so a retried request returns the same run instead of starting a second turn. On a run that has already finished, `interrupt` starts a follow-up turn.
- **`runs.resume` sends no message.** The documented example now sends only `decision` and `sessionId`; a non-empty `message` is rejected by the server. A blank `sessionId` is refused before any request instead of being replaced by a new random conversation.
- **Breaking (pre-1.0): `chat()` streams from the agent host.** `client.scopes.chat()`, `client.modus.chat()` and `client.workflows.chat()` return a `ChatSession`. Iterate `textStream()` / `eventStream()` for the reply as it arrives, or `await` it (or `.then` / `.catch` / `.finally`) for `{ content, threadId, runId }` as before; an invalid model or id still rejects rather than throwing. The request is sent when you first iterate or await the session. Runs are no longer cut off after 30 seconds, and `content` is the server's final answer: interim narration and sub-agent output are left out. A session sends one request; iterating it again replays what arrived. A session that reaches `done` releases its connection; call `close()` if you stop reading before then. Iterating `textStream()` after the run applies the server's mid-run corrections (`assistant_content_reset`), so the text matches what `content` was built from.
- **Workflow streams show their output.** Node tokens are unwrapped, `workflow_done` carries the workflow's final output, and a workflow that fails or is cancelled throws instead of ending the stream silently.
- **Streams time out on silence, not length.** `timeoutMs` now bounds the gap between chunks of a stream, so a run that keeps streaming is never cut off.
- **Breaking (pre-1.0): a custom `baseUrl` needs `agentHost` to chat.** When the agent host cannot be derived from `baseUrl` (anything other than `api.<env>.getmodus.com`), chat and runs throw instead of sending your key to the production agent host. Pass `agentHost` or set `MODUS_AGENT_HOST`; a blank value counts as unset.

### Removed

- **Breaking (pre-1.0): scope writes send a connection's selection only as `preferences`.** Each `connectionSet` entry `scopes.create()` and `scopes.update()` send is `{ connection_id, preferences, context_enabled? }`: `path` is removed from the request and `preferences` is required. An entry with `path` or without `preferences` is rejected with 400 and `info.reason` `legacy_entry`. `applySelectionOps()` no longer takes `selectRoot`, `deselectRoot` or `setRootDeepRules`, nor their `path`, `includes` and `excludes` fields: set a connection with `setConnectionPreferences` and remove it with the new `removeConnection`. Reads still return one row per included path, with `path`, so turn a read into one entry per connection before you write it back.
- **Breaking (pre-1.0): `chatStream()`, `ChatStream` and `ChatRequest`.** Use `chat()`, which streams. `getFinalResult()` is replaced by `await`ing the session.
- **Breaking (pre-1.0): `version: 'draft'` on scope chat.** API tokens run published scopes only.

### Deprecated

- **`api-skill-<scopeId>-…` thread ids.** Continuing a conversation with the id an earlier `scopes.chat()` returned still works: the server reads it as the `agent_<scopeId>_…` thread it named. Store the `agent_<scopeId>_…` id the response now returns; the old form is accepted only by the chat continuation call and goes away with it.

### Fixed

- **`EvaluationConfig.cadence.frequency` can be `null`.** The API returns `null` for a schedule without a frequency, but the type did not allow it.
- **`@getmodus/sdk/management` resolves under `moduleResolution: "node"`.** A `typesVersions` entry points the subpath at its types, so a tsconfig on the older `node` (node10) resolution no longer fails with TS2307. `node16`, `nodenext` and `bundler` are unchanged.
- **README.** It shows how to reach staging or a self-hosted API (`baseUrl` / `MODUS_BASE_URL`, `agentHost` / `MODUS_AGENT_HOST`); the error-handling example handles a client-side `ValidationError`, which has no `statusCode`, `code` or `requestId`; tokens are shown as `modus_pat_…`; and the example scripts are said to live in the GitHub repository, not the npm package. `agentHost` is documented as a public option.
- **`workflows.runs.create()`, `createScope()` and `createModus()` accept a body without `sessionId`.** The types required it, so the documented examples did not compile; the SDK already starts a new conversation when it is omitted. `resume`, `interrupt` and `editQueued` still require it.
- **Errors from `@getmodus/sdk/management` are `instanceof` the root error classes under CommonJS.** Each CommonJS entrypoint bundled its own copy of `ModusError` and the other classes, so `err instanceof ModusError` was `false` for a `ModusManagement` error under `require`. ESM was not affected.
- **The `context.items.lookup()` and `scopes.conversations(id).get()` examples compile.**
- **Server: `conversations.list({ kind })` filters.** `kind: 'modus'` returns only Modus threads and `kind: 'scopes'` only scope threads; before, both returned every conversation.
- **Server: resuming a finished run ends at once.** `runs.stream(runId, { lastEventId })` with the id of the run's final `done`/`error`/`cancelled` event now ends with no events, instead of waiting forever.
- **Server: errors use Scope and Workflow.** A missing scope is `Scope not found` with `info.scopeId` (was `Skill not found`, `info.skillId`); a missing workflow is `Workflow not found` with `info.workflowId` (was `Agent not found`, `info.agentId`). Code that read `info.skillId` or `info.agentId` must read the new key.
- **Every rejected argument now throws `ValidationError`.** An invalid page size, chat model, `kind`, blank
  `runId` or `sessionId`, empty `updateMask`, a `beforeMessageIndex` without `messageLimit`, too many
  `sessionIds`, a bad `waitUntil`, `concurrency` or upload path (including one that does not exist or runs through a regular file), and `getNextPage()` on the last page threw a
  plain `Error` before any request; they now throw `ValidationError`, a `ModusError` subclass, as the Python
  SDK does. Code that catches `Error` still catches it. The CLI now exits 3 on these, not 1.
- **A path id of `'..'` could target the parent resource, e.g. delete the scope.** `scopes.memories(7).delete('..')` sent `DELETE /scopes/7`. Every path id that is blank, `'.'` or `'..'` now raises `ValidationError` before any request; a blank id no longer returns the list page as one item.
- **Paging no longer skips items.** `scopes.list()`, `workflows.list()`, `connections.list()` and their auto-paging iterators return every item: a page boundary no longer drops items created in the same millisecond, and `connections.list()` no longer drops a connection or ends early when other members' connections are hidden from you.
- **Numeric ids above 2147483647 return 404.** Such a scope or workflow id now throws `NotFoundError` instead of a 500 that was retried three times.
- **Evaluation runs page in a stable order.** Runs that started at the same time are no longer repeated or skipped across pages.
- **A run started while you page evaluation runs is not repeated.** The `listRuns` page token is now an opaque position in the list, not a row offset, so a run that starts between two pages no longer shows up again on the next page (and a deleted one no longer makes the next page skip a run). A numeric page token from before this release is rejected with 400 (`BadRequestError`); restart from the first page.
- **`updateConfig` returns what it stored.** The first `scopes.evaluations(id).updateConfig({ judgeModel })` on a scope returned `judgeModel: null` (and the defaults for every other field), although the value was saved; a later partial update could also turn `enabled` back off. The server now reads the configuration it just wrote.
- **`scopes.chat()` returns the conversation's thread id.** `threadId` is now `agent_<scopeId>_…`, the id `scopes.conversations(id).list()` shows, so `get(threadId)` accepts it. It was `api-skill-<scopeId>-…`, which those calls answered with 404.
- **`context.createLink()` on a page that cannot be read throws `UnprocessableError` (422), not a 500.** An unreachable or empty page names the URL in the message.
- **`updateMask` clears the fields it names.** A field named in `updateMask` and left unset is sent as `null`, so the server clears it, on `scopes.update`, `workflows.update`, `context.items.update`, and both `interfaces(id).update`. Before, it was dropped from the body and nothing was cleared.
- **`suggestions.list({ scopeIds: [] })` throws `ValidationError`** before any request. It sent `scopeIds=`, which the server rejects with 400.
- **Clearing a masked field no longer fails with 500.** `scopes.update` with `updateMask` naming `description` or `expectedOutput` (or `workflows.update` naming `description`) and the field left unset raised `InternalServerError` three times. A cleared field now takes its empty value: text `''`; a list `[]`; a map `{}`; a context item's `userFeedback` `neutral`; and a memory's `metadata` `{}`. A field with no empty value throws `BadRequestError` saying it cannot be cleared. These are `name`, `accessConfig`, a workflow's `type` and `workflowStructure`, a context item's `content` and `contextType`, a memory's `memory`, and an interface's `name` and `config`.
- **Updating or deleting a memory that does not exist throws `NotFoundError`.** `scopes.memories(id).update()` and `.delete()` resolved as if they had succeeded when memory is off for the organization.
- **Docs: ids are numeric.** The getting-started example took a slug (`scopes.get('revenue-analysis')`), which the server rejects with 400; it now takes an id from `list()`. Docs no longer say "id or slug". `type: 'task'` is documented as a deprecated alias on create; `workflows.update` accepts only `workflow`.
- **`requestId` is set on every API error.** It was always `undefined`, because the API sends
  it in the error body, not in an `x-request-id` header. The header is still used when the body
  has none.
- **A 2xx response that is not JSON** throws a `ModusError` naming the status, content type and
  the first 200 characters, after one request. It was an `APIConnectionError` ("check
  connectivity") retried three times.
- **`UnprocessableError` documentation:** 422 is a business-rule failure; schema failures are
  400 (`BadRequestError`).
- **Breaking (pre-1.0): `context.items.listValues` pages one item's array.** The
  server used to ignore the uid and return one row per item of the context type,
  with each item's whole `content`. It now reads only the item named by `uid`
  (not found when it is missing, unreadable, or of another context type) and pages
  the elements of the array at `contentKeyPath`. `ContextValueRow` is
  `{ index, value }`: the element's 0-based position and the element itself.
- **Conversation messages carry text.** `conversations.get` returns `content` as a
  string for every message, as typed; tool calls stay in `toolCalls`.
- **Oversized request bodies say so.** A request body over an operation's size
  limit fails with HTTP 413 and error code `PAYLOAD_TOO_LARGE` instead of
  `BAD_REQUEST`. Dashboards, a custom context item and a note now accept up to
  1 MiB, and `customItems.batchCreate` up to 8 MiB.

### Deprecated

- **`connectionSet[].path`.** Send `preferences` instead; `path` is derived from it on reads.
- **`connectionSet[].context_enabled`.** A scope always reads context from its connections; omit the field.
  `false` is accepted only when the connection is already stored with `false`.

## [0.9.0] — 2026-10-24

### Added

- **List selectable units.** `client.connections.listSelections(connectionId)` and
  `iterSelections(connectionId)` page the units a scope can select on a connection
  (`GET /connections/{id}/selections`). `client.connections.list()` items may include
  `selectionModel`.
- **Evaluation case methods.** `scopes.evaluations(id).addCase()`, `.updateCase(caseId)`, and `.deleteCase(caseId)` add, change, or remove one evaluation case. Omit `id` on add and the client assigns one, so a retry sends the same id. A retry whose id is already stored returns a conflict; an identical body is not treated as success. An empty `task` is allowed. An update with neither field is rejected.

### Changed

- **MCP config is checked on write.** `scopes.create`, `scopes.update`, and `PATCH /scopes/{id}/mcp-config` return the effective core tools and tool exposure. A changed value must use true or false for each core tool, and version 1 with mode subset or discovery for tool exposure. A newly added exposure key must be one the scope can expose. A key already stored can be sent again or removed.
- **Breaking (pre-1.0): typed evaluation cases.** `scopes.update` `evaluations` items are `{ id?, task, expectedOutput }`. `task` and `expectedOutput` are required, and any other key, such as `createdAt` or `updatedAt`, is rejected with 400. Omit `id` on a new case and one is assigned. A repeated `id` is rejected. An empty `task` is allowed.
- **Breaking (pre-1.0): scope `interfaces` have one shape.** `scopes.create` and `scopes.update` (`POST /api/v1/scopes` and `PATCH /api/v1/scopes/{id}`) accept only MCP interface rows. `type` must be `mcp`. Each row has an optional id and name and a config of core tools and exposed integrations. A row without an id or name is assigned one. Responses return only id, type, name, and config; extra stored keys such as `enabled` are no longer returned.
- **Workflow responses declare their shapes.** `Workflow` variation fields `trigger`, `workflowStructure`, and `agentSelection` are `WorkflowTriggerResponseDto`, `WorkflowStructureResponseDto`, and `AgentSelectionResponseDto` instead of open objects. A non-schedule trigger has `schedule: null`, and a schedule leaves unused cadence fields null. A workflow interface `config` describes Slack and Teams (`accessMode`, `allowedEmails`, `availableChannelIds`) and an empty object for MCP.
- **Scope create and update describe `connectionSet`.** An entry selects a whole connection (`path: []`) or one selectable unit of it, never anything below. Lists replace the stored list.
- **Scope `connectionSet` rows must be a selectable unit.** `scopes.create` and `scopes.update` reject a new row whose path is neither the whole connection nor one selectable unit of it, with 422 `root.not_a_root`. A row already stored can stay, and removing it still succeeds.
- **Workflow interface config.** Slack and Teams `config` on a workflow interface is `accessMode` (`all`, `allow-list`, or `allow-org`), `allowedEmails`, and `availableChannelIds`. An MCP interface accepts no config keys. An unknown key or invalid value in a changed config returns 422 with violations; `config: null` returns 400. Unchanged stored values are accepted.
- **`searchQuery` documents word search.** `context.customItems.list({ searchQuery })` (`GET /context/custom-items`) describes
  word search: it returns rows that contain every word of the query, case-insensitive.
- **Known toolset values are validated by the API.** Integration entries require per-connection grants (see **Removed** below).
  General tools retain their formats: `file_publish` takes `{ actions: string[], rules?: { nameMode: "any" | "restricted", allowedNames: string[] } }`;
  Coding tools take an array of `{ connectionUid, repoOwner, repoName, branch }`.
  Invalid nonintegration values return `422` with rule `toolset.bad_value`; unknown keys use `toolset.unknown_key`.
  Unchanged stored nonintegration values can still be resent or removed.

### Removed

- **Breaking (MAJOR), CU-z93r0b8wwz: implicit integration toolset binding and retired layouts.**
  Use `{ <platform>: { byConnection: { <lowercase connection UUID>: { actions: [...], rules? } } } }`.
  SQL grants use the SQL platform key (for example `postgresql`) with `actions: ['query']`.
  Flat `{ actions }`, integration action arrays, `scope`/personal encodings, action suffixes,
  `sql_runner`, `looker_bi`, `langfuse_observability` and `*_analytics` are rejected with
  `UnprocessableError` (422), including unchanged stored entries. General tools, MCP, Pipedream
  and Coding are unchanged. `PlatformToolsetEntry`, `ToolsetSlot` and `ToolsetRules` are
  exported from `@getmodus/sdk/management`; `ToolsetInput` remains an open map.
  The SQL example now takes `MODUS_SQL_PLATFORM` and `MODUS_SQL_CONNECTION_ID`, not `MODUS_SQL_SELECTOR`.
- **Breaking: `ToolsetDto` and `ToolsetToolDto`.** Both are removed from `components["schemas"]`. Scope create and update `toolset` is a map of tool key to its configuration; type it with `ToolsetInput` from `@getmodus/sdk/management`. The generated `{ tools: [{ id, enabled, config }] }` models are gone. Unknown keys are rejected.
- **Breaking (pre-1.0): evaluation case timestamps.** Scope evaluation cases no longer include `createdAt` or `updatedAt`.

## [0.8.0] — 2026-10-18

### Removed

- **Breaking: evaluation Slack `nangoConnectionId`.** Send `connectionId`, the
  Slack connection's Modus UUID, in notification settings instead. The generated
  `EvaluationSlackChannelDto` type uses `connectionId`. No deprecation window;
  requires a major release.

### Added

- **`includeOwnLearnings` on `scopes.create`.** A new scope reads what is taught while
  using it by default; pass `false` to create it without its own learnings.
- **`defaultHeaders` client option.** `Modus` and `ModusManagement` accept headers to
  send on every request. They override the SDK's own defaults, except `Authorization`,
  which always comes from `apiKey`.
- **`X-Modus-Client: sdk` request header.** Every request names the SDK as the client.
- **`gpt-6-luna` model.** The chat request `model` union accepts the new
  OpenAI model.
- **`gpt-5.6-luna` model.** The chat request `model` union accepts the new
  OpenAI model.
- **Move Files items.** `mgmt.context.items.move(uid, { destinationFolderUid })`
  relocates a live file or folder. Pass `null` for the Files root.
- **Generic context item browse.** `client.context.items.list()` and
  `mgmt.context.items.list()` accept optional `connectionIds`, `parentUids`,
  and `ancestorUids` arrays. Omit a filter to leave it unrestricted; pass `[]`
  for the known-empty / match-none forms (`parentUids: []` is the Files root).
- **Upload destinations.** Upload helpers accept an optional `folderPath`
  prefix for single files, batches, and directories.

### Changed

- **Scope context file handling.** `scopes.getContext()` returns bounded inline
  previews for large bodies; full file content is not available through this REST method.
- **Connected-integration toolset entries bind to a connection.** A scope toolset entry
  given as `{ actions: [...], rules }` is bound on create/update to the organization's
  newest workspace connection of that integration and returned as
  `{ byConnection: { <connection id>: {...} } }`. A create or update whose entry has no
  workspace connection to bind to returns `422`; re-sending an entry already stored
  unchanged is accepted.
- Deleting a Files folder through context items also deletes its contained files,
  subfolders, and parsed file items.

## [0.7.0] — 2026-09-30

### Added

- **Scope Slack/Teams interfaces.** `scopes.interfaces(scopeId)` lists, adds, updates and
  removes the Slack and Microsoft Teams interfaces of a scope.
- **`claude-sonnet-5.5` model.** The chat request `model` union accepts the new
  Anthropic model.
- **`deepseek-v4-pro`, `deepseek-v4-flash-latest`, and `kimi-k3` models.** The
  chat request `model` union accepts these models.
- **Optional `ancestry` on context items.** List, get, lookup, and custom-item
  responses may include ordered ancestors (`uid`, `display_name`, `type`). The
  field is omitted on older responses, `null` when stored ancestry is unknown,
  and `[]` when the item has no ancestors.
- **`contextItemUids` on composed context.** `POST /modus/context` and
  `POST /scopes/{id}/context` now return the UIDs of the context items the composer
  kept, in selection order. Previously the response reported `selectedCount` with no
  way to learn which items it counted — `contextItems` has been an empty array for
  some time and remains deprecated.
- **`claude-opus-5.5` and `grok-4.7` models.** The chat request `model` union
  accepts the two new models.

### Removed

- **`RunConfigDto.strategies`.** The run API no longer publishes context-composer
  strategy IDs, so the generated `RunConfigDto` type no longer carries
  `strategies`. These IDs are the composer's internal vocabulary and get renamed,
  so a pinned value could silently stop doing anything. Strategy selection is
  chosen by the service.

### Added

- **Dashboard documents.** `mgmt.context.dashboards` document operations: list, get, create,
  updateDraft, publish, delete, versions, draft snapshots, access, ownership transfer
  (`list()`, `get()`, `create()`, `updateDraft()`, `publish()`, `delete()`,
  `listVersions()`, `getVersion()`, `restoreVersion()`, `listDraftSnapshots()`,
  `updateAccess()`, `requestOwnershipTransfer()`, `acceptOwnershipTransfer()`,
  `cancelOwnershipTransfer()`). New types `DashboardVersion`, `DashboardDraftSnapshot`,
  `DashboardPublishResult` and `DashboardView`, and the input types `CreateDashboardInput`,
  `UpdateDashboardDraftInput`, `PublishDashboardInput`, `UpdateDashboardAccessInput` and
  `TransferDashboardOwnershipInput`; version definitions are returned as stored, so older versions
  may lack newer fields.

- **Dashboard draft elements and layout.** `mgmt.context.dashboards.elements(dashboardId)`
  lists, reads, creates and updates the tiles and filters of a dashboard draft
  (`list()`, `get()`, `create()`, `update()`), and `mgmt.context.dashboards.updateLayout()`
  moves or resizes several of them in one change. Every write takes the `expectedRevision`
  it is based on and throws `ConflictError` when the draft changed.

- Ingested-data uploads accept an optional source HTTP `response.status` from 100 through 599.

- **File uploads: optional `folderPath`.** `uploadFromUrl`, `finalize`, and directory
  uploads now accept an optional relative folder label that is stored with the file and
  returned on the file resource. `uploadDir` sets it automatically from each file's path
  relative to the upload root, so directory structure is preserved.

- **Conversation lists: optional `source` and `sourceRef` filters.** `client.modus.conversations.list`
  and `client.scopes.conversations(scopeId).list` now accept `source` to restrict results to
  one UI surface (e.g. `"context_chat"`, `"dashboard_copilot"`, `"slack"`) and `sourceRef` to
  narrow `source` to one instance of that surface — for `dashboard_copilot`, a dashboard id.
  `sourceRef` requires `source`; sent on its own it is rejected with a 422. Conversations
  recorded before the filter shipped carry no instance key and do not match it.

### Changed

- **Scope MCP: Get Answer works alone.** `management.scopes.patchMcpConfig` now
  rejects a config that turns `coreTools.chat` (`get_answer`) on together with
  `getContext`, `teachModus` or any tool exposure, with HTTP 422. The call replaces the
  whole config and omitted keys take their defaults: `chat` off, `getContext` on,
  `teachModus` off, every tool exposed. To turn Get Answer on, send `chat: true`,
  `getContext: false` and an empty `subset` exposure in one call.

- **Breaking (pre-1.0):** Ingested-data upload results now contain only `checksum`;
  object keys are internal storage details.

- **Breaking (pre-1.0):** Directory-managed member groups no longer include member IDs.
  Use the member count to determine their size. Native member groups are unchanged.

## [0.6.0] — 2026-08-15

### Changed

- Public OpenAPI updates from production release.

## [0.5.0] — 2026-08-08

### Changed

- Public OpenAPI updates from production release.

## [0.4.0] — 2026-08-01

### Changed

- Public OpenAPI updates from production release.

## [0.3.0] — 2026-07-26
