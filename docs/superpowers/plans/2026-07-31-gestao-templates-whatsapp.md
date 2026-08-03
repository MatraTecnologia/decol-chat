# WhatsApp Template Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete WhatsApp template catalog with local drafts and revisions, Meta approval submission and synchronization, full component editing, and approved-template sending from existing conversations and new conversations.

**Architecture:** A shared Zod contract describes template definitions and RBAC. Fastify persists a local catalog plus immutable submitted revisions, while a focused Graph API adapter synchronizes remote state and submits payloads. The Next.js dashboard consumes generated OpenAPI hooks for a catalog, visual/JSON editor, history, and one reusable approved-template parameter form used by both sending flows.

**Tech Stack:** Node 24, TypeScript 6, Zod 4, Fastify 5, Prisma 7/PostgreSQL, Meta Graph API v25.0, R2/S3 signed uploads, Next.js 16, React 19, React Hook Form 7, React Query 5, shadcn/ui, generated hey-api client.

## Global Constraints

- Admin and manager may create, edit, duplicate, submit, synchronize, and delete templates.
- Agent may consult templates and send approved templates; viewer may consult only.
- The initial UI uses the active WhatsApp account; every persisted record remains scoped by `whatsAppAccountId`.
- Local draft state and Meta remote state must remain separate.
- A submitted revision is immutable; editing afterward creates a new draft revision.
- Meta access tokens remain backend-only and must never appear in API responses or logs.
- Synchronization must never overwrite or delete local drafts.
- Remote deletion and local draft deletion are distinct confirmed operations.
- The existing Graph API version remains centralized as `v25.0`.
- The editor supports standard, authentication, catalog/product, Flow, carousel, limited-time offer, and forward-compatible advanced JSON components.
- Existing user changes in `apps/api/package.json` must not be staged or rewritten.

---

### Task 1: Shared template contract and role policy

**Files:**
- Create: `packages/shared/src/whatsapp-templates.ts`
- Create: `packages/shared/src/whatsapp-templates.test.mjs`
- Modify: `packages/shared/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Produces: `TEMPLATE_READERS`, `TEMPLATE_MANAGERS`, `canReadTemplates(role)`, `canManageTemplates(role)`, `templateCategorySchema`, `templateParameterFormatSchema`, `templateDefinitionSchema`, `templateSendParametersSchema`, `TemplateDefinition`, and `TemplateSendParameters`.
- The component discriminators are `HEADER`, `BODY`, `FOOTER`, `BUTTONS`, `CAROUSEL`, `LIMITED_TIME_OFFER`, and `CUSTOM`; header formats are `TEXT`, `IMAGE`, `VIDEO`, `DOCUMENT`, and `LOCATION`; button kinds are `QUICK_REPLY`, `URL`, `PHONE_NUMBER`, `COPY_CODE`, `OTP`, `CATALOG`, and `FLOW`.

- [ ] **Step 1: Write failing contract tests**

Create table-driven Node tests that assert manager/admin mutation access, agent/viewer read access, rejection of `user`, required examples for variables, valid authentication OTP, valid Flow/catalog/carousel definitions, and rejection of advanced JSON containing protected keys.

```js
assert.equal(canManageTemplates('manager'), true)
assert.equal(canManageTemplates('agent'), false)
assert.equal(canReadTemplates('viewer'), true)
assert.equal(canReadTemplates('user'), false)

assert.equal(templateDefinitionSchema.safeParse({
  category: 'UTILITY',
  language: 'pt_BR',
  parameterFormat: 'POSITIONAL',
  components: [{ type: 'BODY', text: 'Olá {{1}}', examples: ['Maria'] }],
}).success, true)
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test packages/shared/src/whatsapp-templates.test.mjs`
Expected: FAIL because `whatsapp-templates.ts` does not exist.

- [ ] **Step 3: Implement the shared schemas and policy**

Use Zod discriminated unions for known components and an advanced component whose raw object is checked recursively against `accessToken`, `whatsAppAccountId`, `createdById`, `updatedById`, `remoteStatus`, and `remotePayload`.

```ts
export const TEMPLATE_READERS: RoleType[] = [
  'admin',
  'manager',
  'agent',
  'viewer',
]
export const TEMPLATE_MANAGERS: RoleType[] = ['admin', 'manager']

export const canReadTemplates = (role: RoleType) =>
  TEMPLATE_READERS.includes(role)
export const canManageTemplates = (role: RoleType) =>
  TEMPLATE_MANAGERS.includes(role)
```

Export the module from `packages/shared/package.json` and add `zod` as a runtime dependency.

- [ ] **Step 4: Run and verify GREEN**

Run: `node --test packages/shared/src/whatsapp-templates.test.mjs`
Run: `pnpm --filter @workspace/shared typecheck`
Run: `pnpm --filter @workspace/shared lint`
Expected: all checks PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/whatsapp-templates.ts packages/shared/src/whatsapp-templates.test.mjs packages/shared/package.json pnpm-lock.yaml
git commit -m "feat: define WhatsApp template contracts"
```

### Task 2: Template, revision, and asset persistence

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Regenerate ignored build output under: `apps/api/src/generated/`

**Interfaces:**
- Produces Prisma models `WhatsAppTemplate`, `WhatsAppTemplateRevision`, and `WhatsAppTemplateAsset`, plus enum `WhatsAppTemplateRevisionState`.
- `WhatsAppTemplate` is unique by `[whatsAppAccountId, name, language]` and `[whatsAppAccountId, metaTemplateId]`.
- `WhatsAppTemplateRevision` is unique by `[templateId, version]` and by `idempotencyKey`.

- [ ] **Step 1: Add the data model**

Add `templates WhatsAppTemplate[]` and `templateAssets WhatsAppTemplateAsset[]` to `WhatsAppAccount`, then define the models with explicit mapped table names.

```prisma
enum WhatsAppTemplateRevisionState {
  DRAFT
  SUBMITTED
  SUPERSEDED
}

model WhatsAppTemplate {
  id                String   @id @default(cuid(2))
  whatsAppAccountId String
  metaTemplateId    String?
  name              String
  language          String
  category          String
  remoteStatus      String?
  remoteQuality     String?
  rejectionReason   String?
  remotePayload     Json?
  remoteUpdatedAt   DateTime?
  lastSyncAttemptAt DateTime?
  lastSyncError     String?
  createdById       String
  updatedById       String
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  revisions         WhatsAppTemplateRevision[]
  whatsAppAccount   WhatsAppAccount @relation(fields: [whatsAppAccountId], references: [id], onDelete: Cascade)

  @@unique([whatsAppAccountId, name, language])
  @@unique([whatsAppAccountId, metaTemplateId])
  @@index([whatsAppAccountId, remoteStatus, updatedAt(sort: Desc)])
  @@map("whatsapp_template")
}
```

Revision fields are `definition Json`, `parameterFormat String`, `state`, `lockVersion Int @default(1)`, `submittedAt`, `submittedById`, `submissionResponse Json?`, and `idempotencyKey String @unique`. Asset fields are revision/account IDs, private `objectKey`, original name, MIME type, byte size, kind, optional `metaHandle`, and timestamps.

- [ ] **Step 2: Format and generate Prisma code**

Run: `pnpm exec prisma format --schema apps/api/prisma/schema.prisma`
Run: `pnpm db:generate`
Expected: Prisma client and Zod output include all three models and the revision enum.

- [ ] **Step 3: Apply the schema to the development database**

Run: `pnpm db:push`
Expected: Prisma reports the database synchronized without destructive changes.

- [ ] **Step 4: Verify generated types**

Run: `pnpm --filter @workspace/api typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat: persist WhatsApp template revisions"
```

### Task 3: Meta template payload adapter and Graph operations

**Files:**
- Create: `apps/api/src/lib/whatsapp/template-payload.ts`
- Create: `apps/api/src/lib/whatsapp/template-payload.test.mjs`
- Modify: `apps/api/src/lib/whatsapp/graph-client.ts`

**Interfaces:**
- Consumes: `TemplateDefinition` and `TemplateSendParameters` from `@workspace/shared/whatsapp-templates`.
- Produces: `toMetaTemplatePayload(definition)`, `fromMetaTemplatePayload(remote)`, `toMetaMessageComponents(definition, values)`, `listMessageTemplates`, `createMessageTemplate`, `updateMessageTemplate`, `deleteMessageTemplate`, and a component-aware `sendTemplateMessage`.

- [ ] **Step 1: Write failing adapter tests**

Cover positional and named body variables, media/location headers, URL variables, OTP, Flow, catalog, carousel cards, limited-time offers, raw advanced fields, and round-trip preservation of an unknown remote component.

```js
const payload = toMetaTemplatePayload({
  category: 'MARKETING',
  language: 'pt_BR',
  parameterFormat: 'POSITIONAL',
  components: [
    { type: 'BODY', text: 'Olá {{1}}', examples: ['Ana'] },
    { type: 'BUTTONS', buttons: [{ kind: 'URL', text: 'Abrir', url: 'https://example.com/{{1}}', examples: ['pedido-1'] }] },
  ],
})
assert.deepEqual(payload.components[0].example.body_text, [['Ana']])
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test apps/api/src/lib/whatsapp/template-payload.test.mjs`
Expected: FAIL because the adapter does not exist.

- [ ] **Step 3: Implement pure payload conversion**

Keep conversion free of Prisma and HTTP. Unknown remote component objects become the advanced representation and must serialize back without losing fields. `toMetaMessageComponents` maps user values to the Cloud API send format and rejects missing or extra parameters.

- [ ] **Step 4: Extend the Graph client**

Add cursor pagination and explicit request/response types. Do not export tokens or include them in thrown error messages.

```ts
export const listMessageTemplates = (
  token: string,
  wabaId: string,
  after?: string,
) => request<MetaTemplatePage>(
  `/${wabaId}/message_templates?${new URLSearchParams({
    fields: 'id,name,language,status,category,quality_score,rejected_reason,components,parameter_format,last_updated_time',
    limit: '100',
    ...(after ? { after } : {}),
  })}`,
  { headers: authHeaders(token) },
)
```

Change `sendTemplateMessage` to accept `{ name, languageCode, components }`, while updating its existing callers in a later task.

- [ ] **Step 5: Run and verify GREEN**

Run: `node --test apps/api/src/lib/whatsapp/template-payload.test.mjs`
Run: `pnpm --filter @workspace/api typecheck`
Expected: adapter tests and API typecheck PASS after temporary caller compatibility is retained through an overload.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/lib/whatsapp/template-payload.ts apps/api/src/lib/whatsapp/template-payload.test.mjs apps/api/src/lib/whatsapp/graph-client.ts
git commit -m "feat: add Meta template Graph adapter"
```

### Task 4: Template domain service, revision rules, and synchronization

**Files:**
- Create: `apps/api/src/lib/whatsapp/templates/policy.ts`
- Create: `apps/api/src/lib/whatsapp/templates/policy.test.mjs`
- Create: `apps/api/src/lib/whatsapp/templates/repository.ts`
- Create: `apps/api/src/lib/whatsapp/templates/service.ts`
- Create: `apps/api/src/lib/whatsapp/templates/sync.ts`

**Interfaces:**
- Produces: `createDraft`, `updateDraft`, `duplicateTemplate`, `submitRevision`, `syncTemplates`, `deleteDraft`, `deleteRemoteTemplate`, `getApprovedTemplateForSend`, `assertDraftEditable`, `nextRevisionVersion`, and `matchesExpectedLockVersion`.
- `updateDraft(id, expectedLockVersion, definition, actorId)` returns a conflict result when the stored lock version differs.
- `syncTemplates(account)` returns `{ imported; updated; failed; nextCursor: null }` only after exhausting all Meta pages.

- [ ] **Step 1: Write failing policy tests**

Assert that only `DRAFT` revisions are editable, submitted revisions cannot be rewritten, lock versions must match exactly, editing a submitted template allocates the next version, and a stable remote snapshot never replaces a local draft definition.

```js
assert.equal(assertDraftEditable({ state: 'DRAFT' }), true)
assert.equal(assertDraftEditable({ state: 'SUBMITTED' }), false)
assert.equal(matchesExpectedLockVersion(4, 4), true)
assert.equal(matchesExpectedLockVersion(4, 3), false)
assert.equal(nextRevisionVersion([{ version: 1 }, { version: 3 }]), 4)
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test apps/api/src/lib/whatsapp/templates/policy.test.mjs`
Expected: FAIL because the policy module does not exist.

- [ ] **Step 3: Implement policy and repository boundaries**

Keep rules pure in `policy.ts`. Put all Prisma queries and transactions in `repository.ts`, including atomic `updateMany` by revision ID, `state: 'DRAFT'`, and `lockVersion`.

- [ ] **Step 4: Implement draft and submission orchestration**

`submitRevision` validates the shared contract, seals the revision inside a transaction, calls create/update based on `metaTemplateId`, records the exact request/response snapshot, updates remote state, and returns the sealed revision. A retry with the same `idempotencyKey` returns the previous result.

- [ ] **Step 5: Implement paginated synchronization**

Use `getConnection()` for the active account, consume every cursor from `listMessageTemplates`, map remote payloads with `fromMetaTemplatePayload`, and upsert only template identity/remote fields. Store per-item failures and `lastSyncAttemptAt`; leave revisions untouched.

- [ ] **Step 6: Run and verify GREEN**

Run: `node --test apps/api/src/lib/whatsapp/templates/policy.test.mjs`
Run: `pnpm --filter @workspace/api typecheck`
Run: `pnpm --filter @workspace/api lint`
Expected: all checks PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/lib/whatsapp/templates
git commit -m "feat: add template revision domain service"
```

### Task 5: Authenticated template API routes

**Files:**
- Create: `apps/api/src/routes/whatsapp/template-schemas.ts`
- Create: `apps/api/src/routes/whatsapp/templates-policy.ts`
- Create: `apps/api/src/routes/whatsapp/templates.ts`
- Create: `apps/api/src/routes/whatsapp/templates-policy.test.mjs`
- Modify: `apps/api/src/routes/whatsapp/index.ts`

**Interfaces:**
- Consumes Task 4 service functions and shared role arrays.
- Produces operation IDs `listWhatsappTemplates`, `getWhatsappTemplate`, `createWhatsappTemplateDraft`, `updateWhatsappTemplateDraft`, `duplicateWhatsappTemplate`, `listWhatsappTemplateRevisions`, `validateWhatsappTemplateRevision`, `submitWhatsappTemplate`, `syncWhatsappTemplates`, `deleteWhatsappTemplateDraft`, and `deleteWhatsappTemplateRemote`.

- [ ] **Step 1: Write failing route-policy tests**

Extract a pure `getTemplateRouteCapabilities(role)` and assert the complete role matrix, including no access for the legacy `user` role.

- [ ] **Step 2: Run and verify RED**

Run: `node --test apps/api/src/routes/whatsapp/templates-policy.test.mjs`
Expected: FAIL because the route policy does not exist.

- [ ] **Step 3: Define OpenAPI schemas**

Responses expose remote state, quality, rejection reason, latest draft/submitted revision summaries, author IDs, and timestamps, but never account credentials, private object keys, or raw tokens. Mutation bodies include `expectedLockVersion` for draft updates. Every route in this subplugin uses the OpenAPI tag `WhatsAppTemplates`, which is also the dashboard query invalidation tag.

```ts
const updateDraftBodySchema = z.object({
  expectedLockVersion: z.number().int().positive(),
  definition: templateDefinitionSchema,
})
```

- [ ] **Step 4: Implement read and draft routes**

Require `TEMPLATE_READERS` for list/detail/history and `TEMPLATE_MANAGERS` for every mutation. Support `q`, category, status, language, page, and limit filters using `paginate`.

- [ ] **Step 5: Implement validate, submit, sync, and deletion routes**

Return HTTP 409 for stale draft versions, 422 for definition errors, 400/502 for translated Meta errors, and 404 without leaking another account's record. Record `template.created`, `template.updated`, `template.submitted`, `template.synced`, and deletion events through `recordAudit`.

- [ ] **Step 6: Register the subplugin**

Register `templatesRoutes` under the existing `/whatsapp` plugin so route paths are `/whatsapp/templates/...` and the connection routes remain unchanged.

- [ ] **Step 7: Verify routes**

Run: `node --test apps/api/src/routes/whatsapp/templates-policy.test.mjs`
Run: `pnpm --filter @workspace/api typecheck`
Run: `pnpm --filter @workspace/api lint`
Expected: all checks PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/routes/whatsapp
git commit -m "feat: expose WhatsApp template management API"
```

### Task 6: Regenerate and verify the API client

**Files:**
- Modify generated files under: `packages/api-client/src/`

**Interfaces:**
- Produces generated types, SDK functions, Zod schemas, query options, and mutations for every Task 5 operation ID.

- [ ] **Step 1: Confirm API health and schema availability**

Run: `Invoke-RestMethod http://localhost:3333/health`
Expected: healthy response. If port 3333 already serves this project, reuse it; do not start a second API process.

- [ ] **Step 2: Generate the client**

Run: `pnpm generate:api`
Expected: `packages/api-client/src/@tanstack/react-query.gen.ts` contains `listWhatsappTemplatesOptions` and all mutation helpers.

- [ ] **Step 3: Verify generated output**

Run: `pnpm --filter @workspace/api-client typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/api-client/src
git commit -m "chore: generate WhatsApp template API client"
```

### Task 7: Template catalog page and sidebar navigation

**Files:**
- Create: `apps/dashboard/app/(protected)/(general)/templates/page.tsx`
- Create: `apps/dashboard/app/(protected)/(general)/templates/_components/client.tsx`
- Create: `apps/dashboard/features/templates/components/template-filters.tsx`
- Create: `apps/dashboard/features/templates/components/template-table.tsx`
- Create: `apps/dashboard/features/templates/components/template-status-badge.tsx`
- Create: `apps/dashboard/features/templates/lib/template-capabilities.ts`
- Create: `apps/dashboard/features/templates/lib/template-capabilities.test.mjs`
- Modify: `apps/dashboard/components/app-sidebar.tsx`

**Interfaces:**
- Produces `/templates`, `getTemplateCapabilities(role)`, filter query state (`q`, `category`, `status`, `language`, `page`), and selected template query state (`id`).

- [ ] **Step 1: Write failing dashboard capability tests**

Assert manage/send/read behavior for admin, manager, agent, viewer, null, and `user`.

- [ ] **Step 2: Run and verify RED**

Run: `node --test apps/dashboard/features/templates/lib/template-capabilities.test.mjs`
Expected: FAIL because the policy module does not exist.

- [ ] **Step 3: Build metadata, capabilities, and sidebar entry**

Add `LayoutTemplate` at `/templates`. Replace `adminOnly` with optional `roles?: RoleType[]`; keep `/conexao` restricted to `['admin']` and templates to the four `TEMPLATE_READERS` roles.

- [ ] **Step 4: Build filters and catalog table**

Use `listWhatsappTemplatesOptions`, 300 ms debounced search, URL-backed filters, pagination, skeletons, empty/error states, distinct local-draft and remote-status badges, quality, rejection reason, and last sync. Show mutation actions only when `canManage`.

- [ ] **Step 5: Add synchronization action**

Wire `syncWhatsappTemplatesMutation`, disable it while pending, show imported/updated/failed counts, and invalidate the `WhatsAppTemplates` tag.

- [ ] **Step 6: Verify dashboard**

Run: `node --test apps/dashboard/features/templates/lib/template-capabilities.test.mjs`
Run: `pnpm --filter dashboard typecheck`
Run: `pnpm --filter dashboard lint`
Expected: all checks PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/app/\(protected\)/\(general\)/templates apps/dashboard/features/templates apps/dashboard/components/app-sidebar.tsx
git commit -m "feat: add WhatsApp template catalog"
```

### Task 8: Visual editor, preview, and draft concurrency

**Files:**
- Create: `apps/dashboard/features/templates/components/template-editor-dialog.tsx`
- Create: `apps/dashboard/features/templates/components/template-editor-form.tsx`
- Create: `apps/dashboard/features/templates/components/template-identity-fields.tsx`
- Create: `apps/dashboard/features/templates/components/component-editor.tsx`
- Create: `apps/dashboard/features/templates/components/header-editor.tsx`
- Create: `apps/dashboard/features/templates/components/body-editor.tsx`
- Create: `apps/dashboard/features/templates/components/buttons-editor.tsx`
- Create: `apps/dashboard/features/templates/components/template-preview.tsx`
- Create: `apps/dashboard/features/templates/lib/template-preview.ts`
- Create: `apps/dashboard/features/templates/lib/template-preview.test.mjs`
- Modify: `apps/dashboard/app/(protected)/(general)/templates/_components/client.tsx`

**Interfaces:**
- Consumes shared `templateDefinitionSchema` and generated draft mutations.
- Produces a React Hook Form editor, `renderTemplatePreview(definition, examples)`, create/edit/duplicate flows, and optimistic concurrency through `expectedLockVersion`.

- [ ] **Step 1: Write failing preview tests**

Cover positional and named substitutions, missing examples, header/body/footer order, URL button preview, and preservation of line breaks.

```js
assert.equal(
  renderTemplateText('Olá {{1}}, pedido {{2}}', ['Ana', '123']),
  'Olá Ana, pedido 123',
)
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test apps/dashboard/features/templates/lib/template-preview.test.mjs`
Expected: FAIL because preview helpers do not exist.

- [ ] **Step 3: Implement identity and standard component editors**

Use `useFieldArray` for component and button ordering. Render category/name/language/parameter format, text/media/location header, body and examples, footer, quick reply, URL, phone, and copy-code controls. Enforce Meta name format and component limits through the shared resolver.

- [ ] **Step 4: Implement live preview**

Render a phone-like message card with media placeholder, substituted text, footer, and button list. Preview errors are non-destructive and point back to their field path.

- [ ] **Step 5: Wire create, save, and duplicate**

Create via `createWhatsappTemplateDraftMutation`, save via `updateWhatsappTemplateDraftMutation`, and duplicate via `duplicateWhatsappTemplateMutation`. On HTTP 409, preserve form data and show a conflict action that reloads the latest revision instead of silently overwriting.

- [ ] **Step 6: Run and verify GREEN**

Run: `node --test apps/dashboard/features/templates/lib/template-preview.test.mjs`
Run: `pnpm --filter dashboard typecheck`
Run: `pnpm --filter dashboard lint`
Expected: all checks PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/features/templates apps/dashboard/app/\(protected\)/\(general\)/templates
git commit -m "feat: add WhatsApp template visual editor"
```

### Task 9: Specialized components and advanced JSON mode

**Files:**
- Create: `apps/dashboard/features/templates/components/authentication-editor.tsx`
- Create: `apps/dashboard/features/templates/components/catalog-editor.tsx`
- Create: `apps/dashboard/features/templates/components/flow-editor.tsx`
- Create: `apps/dashboard/features/templates/components/carousel-editor.tsx`
- Create: `apps/dashboard/features/templates/components/limited-time-offer-editor.tsx`
- Create: `apps/dashboard/features/templates/components/json-editor.tsx`
- Create: `apps/dashboard/features/templates/lib/json-mode.ts`
- Create: `apps/dashboard/features/templates/lib/json-mode.test.mjs`
- Modify: `apps/dashboard/features/templates/components/component-editor.tsx`
- Modify: `apps/dashboard/features/templates/components/template-editor-form.tsx`
- Modify: `apps/dashboard/features/templates/components/template-preview.tsx`

**Interfaces:**
- Produces visual editing for authentication/OTP, catalog/product, Flow, carousel, and limited-time offer plus `parseAdvancedDefinition(json)` and `formatAdvancedDefinition(definition)`.

- [ ] **Step 1: Write failing JSON safety tests**

Assert valid known and unknown component round trips, readable syntax errors with line/column, rejection of protected keys at any depth, and no loss of unknown Graph fields.

- [ ] **Step 2: Run and verify RED**

Run: `node --test apps/dashboard/features/templates/lib/json-mode.test.mjs`
Expected: FAIL because JSON mode helpers do not exist.

- [ ] **Step 3: Implement specialized editors**

Authentication exposes OTP type, autofill/package/signature, validity and security recommendation. Catalog/product exposes catalog and product references. Flow exposes Flow ID, action, navigation screen and data. Carousel uses nested card arrays with per-card media/body/buttons. Limited-time offer exposes expiration behavior and coupon/copy-code fields.

- [ ] **Step 4: Implement safe visual/JSON switching**

Before switching to visual mode, parse and validate JSON. Before switching to JSON, serialize the current form. Never discard invalid JSON automatically; show the error and keep the editor contents until corrected or explicitly reset.

- [ ] **Step 5: Extend preview**

Add carousel cards, OTP/copy action, product/catalog, Flow, and offer-expiration previews. Unknown advanced components render a labeled neutral block rather than failing the whole preview.

- [ ] **Step 6: Run and verify GREEN**

Run: `node --test apps/dashboard/features/templates/lib/json-mode.test.mjs`
Run: `pnpm --filter dashboard typecheck`
Run: `pnpm --filter dashboard lint`
Expected: all checks PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/features/templates
git commit -m "feat: support advanced WhatsApp template components"
```

### Task 10: Private media upload and Meta upload handles

**Files:**
- Create: `apps/api/src/lib/whatsapp/templates/assets.ts`
- Create: `apps/api/src/lib/whatsapp/templates/assets.test.mjs`
- Create: `apps/api/src/routes/whatsapp/template-assets.ts`
- Modify: `apps/api/src/routes/whatsapp/index.ts`
- Modify: `apps/api/src/lib/whatsapp/graph-client.ts`
- Create: `apps/dashboard/features/templates/components/template-media-field.tsx`
- Modify: `apps/dashboard/features/templates/components/header-editor.tsx`
- Modify: `apps/dashboard/features/templates/components/carousel-editor.tsx`

**Interfaces:**
- Produces operation IDs `prepareWhatsappTemplateAssetUpload`, `confirmWhatsappTemplateAssetUpload`, and `getWhatsappTemplateAssetPreview`; backend functions `validateTemplateAsset`, `prepareAssetUpload`, `confirmAssetUpload`, and `ensureMetaUploadHandle`.

- [ ] **Step 1: Write failing asset validation tests**

Cover accepted image/video/document MIME types, exact configured byte limits, path-safe object keys, account/revision ownership, missing R2 object, and handle reuse.

- [ ] **Step 2: Run and verify RED**

Run: `node --test apps/api/src/lib/whatsapp/templates/assets.test.mjs`
Expected: FAIL because asset helpers do not exist.

- [ ] **Step 3: Implement signed private upload lifecycle**

Generate keys as `whatsapp-templates/{accountId}/{revisionId}/{assetId}` without user-supplied path fragments. `prepare` returns a short-lived signed PUT URL; `confirm` verifies object length with `headFile`; preview returns a short-lived signed GET URL only to a template reader.

- [ ] **Step 4: Implement Meta upload handle conversion**

Read the private object through `getFile`, require the active account's `appId`, use the Meta resumable upload flow through focused Graph client functions, persist `metaHandle`, and reuse it until the underlying asset changes. If `appId` is absent, return an actionable 422 response that directs admin/manager to complete the connection settings.

- [ ] **Step 5: Build the media field**

Use the generated prepare/confirm calls, direct browser PUT to the signed URL, progress/pending/error states, and preview URL. Store only `assetId` in the template definition.

- [ ] **Step 6: Verify asset flow**

Run: `node --test apps/api/src/lib/whatsapp/templates/assets.test.mjs`
Run: `pnpm --filter @workspace/api typecheck`
Run: `pnpm --filter dashboard typecheck`
Expected: all checks PASS.

- [ ] **Step 7: Regenerate client and commit**

Run: `pnpm generate:api`

```bash
git add apps/api/src/lib/whatsapp apps/api/src/routes/whatsapp apps/dashboard/features/templates packages/api-client/src
git commit -m "feat: add template media upload flow"
```

### Task 11: Submission, history, comparison, and deletion UX

**Files:**
- Create: `apps/dashboard/features/templates/components/template-details-sheet.tsx`
- Create: `apps/dashboard/features/templates/components/template-history.tsx`
- Create: `apps/dashboard/features/templates/components/template-revision-diff.tsx`
- Create: `apps/dashboard/features/templates/components/submit-template-dialog.tsx`
- Create: `apps/dashboard/features/templates/components/delete-template-dialog.tsx`
- Modify: `apps/dashboard/features/templates/components/template-table.tsx`
- Modify: `apps/dashboard/app/(protected)/(general)/templates/_components/client.tsx`

**Interfaces:**
- Consumes generated detail/history/validate/submit/delete mutations.
- Produces immutable revision history, definition comparison, explicit submission, and separate local/remote delete confirmations.

- [ ] **Step 1: Build detail and history views**

Display remote ID/status/quality/rejection, local draft version, submitted snapshots, actor IDs, dates, and Meta response summary. Compare normalized JSON by component path and highlight additions/removals/changes without exposing private asset keys.

- [ ] **Step 2: Implement validation and submission confirmation**

Run server validation first. The confirmation names account label, template, language, category, revision, and expected re-review impact. Disable double submission and use the revision idempotency key.

- [ ] **Step 3: Implement separate deletion confirmations**

Local deletion states that only the unsubmitted draft is removed. Remote deletion requires typing the template name, calls the remote endpoint, and retains audit/history locally. On remote failure, keep the current row unchanged and surface the translated Meta error.

- [ ] **Step 4: Wire row actions and refresh**

After successful submit/delete, invalidate the `WhatsAppTemplates` list/detail/history tag. Poll pending items at 30 seconds while the page is visible and stop when no item has a transient state.

- [ ] **Step 5: Verify dashboard**

Run: `pnpm --filter dashboard typecheck`
Run: `pnpm --filter dashboard lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/features/templates apps/dashboard/app/\(protected\)/\(general\)/templates
git commit -m "feat: add template approval and history workflows"
```

### Task 12: Secure approved-template sending contract

**Files:**
- Create: `apps/api/src/routes/conversations/template-send-policy.ts`
- Create: `apps/api/src/routes/conversations/template-send-policy.test.mjs`
- Modify: `apps/api/src/routes/conversations/send.ts`
- Modify: `apps/api/src/routes/conversations/start.ts`
- Modify: `apps/api/src/lib/whatsapp/graph-client.ts`
- Modify: `apps/api/prisma/schema.prisma`
- Regenerate ignored Prisma/Zod build output under: `apps/api/src/generated/`

**Interfaces:**
- Produces request bodies `{ templateId: string; parameters: TemplateSendParameters }` for conversation and new-conversation sends.
- Produces `resolveApprovedTemplate(accountId, templateId, parameters)` which returns `{ name; languageCode; components; preview }` only for an `APPROVED` remote template in the same account.

- [ ] **Step 1: Write failing send-policy tests**

Assert account matching, approved status, parameter cardinality/type, media ownership, viewer denial through existing `canSendMessages`, and readable preview generation.

- [ ] **Step 2: Run and verify RED**

Run: `node --test apps/api/src/routes/conversations/template-send-policy.test.mjs`
Expected: FAIL because the send policy module does not exist.

- [ ] **Step 3: Update send request schemas and Graph payload**

Replace manually supplied template name/language with catalog `templateId` and validated parameters. Load the approved submitted definition from the conversation/account before calling `toMetaMessageComponents`.

```ts
const sendTemplateBodySchema = z.object({
  templateId: z.string().min(1),
  parameters: templateSendParametersSchema,
})
```

- [ ] **Step 4: Preserve an auditable send snapshot**

Add nullable `templateId` and `templateRevisionId` to `Message`, retain `templateName`, and write sanitized parameter/component data into `payload`. Generate Prisma types and push the additive database change.

- [ ] **Step 5: Update both sending routes**

Conversation send scopes by `conversation.whatsAppAccountId`; new conversation scopes by the active account returned from `getConnection()`. Both reject a non-approved, deleted, mismatched-account, or incomplete template before invoking Meta.

- [ ] **Step 6: Verify backend**

Run: `node --test apps/api/src/routes/conversations/template-send-policy.test.mjs`
Run: `pnpm --filter @workspace/api typecheck`
Run: `pnpm --filter @workspace/api lint`
Expected: all checks PASS.

- [ ] **Step 7: Regenerate client and commit**

Run: `pnpm generate:api`

```bash
git add apps/api/prisma/schema.prisma apps/api/src/routes/conversations apps/api/src/lib/whatsapp packages/api-client/src
git commit -m "feat: send approved templates from the catalog"
```

### Task 13: Reusable template picker in existing and new conversations

**Files:**
- Create: `apps/dashboard/features/templates/components/approved-template-picker.tsx`
- Create: `apps/dashboard/features/templates/components/template-parameter-form.tsx`
- Create: `apps/dashboard/features/templates/lib/send-parameters.ts`
- Create: `apps/dashboard/features/templates/lib/send-parameters.test.mjs`
- Modify: `apps/dashboard/features/inbox/components/thread/send-template-dialog.tsx`
- Modify: `apps/dashboard/features/inbox/components/thread/use-send-message.ts`
- Modify: `apps/dashboard/features/inbox/components/new-conversation/new-conversation-dialog.tsx`

**Interfaces:**
- Produces reusable `ApprovedTemplatePicker` and `TemplateParameterForm` that return `{ templateId, parameters }`.
- Consumes approved templates from `listWhatsappTemplatesOptions({ query: { status: 'APPROVED' } })`.

- [ ] **Step 1: Write failing parameter-form tests**

Test extraction and stable ordering for body/header/button/carousel parameters, defaults from examples, required media, and absence of fields for static templates.

- [ ] **Step 2: Run and verify RED**

Run: `node --test apps/dashboard/features/templates/lib/send-parameters.test.mjs`
Expected: FAIL because parameter helpers do not exist.

- [ ] **Step 3: Build approved-template selection**

Render searchable approved templates with language/category preview. When selection changes, derive the exact parameter field list from the approved submitted definition and reset values that belong to the prior template.

- [ ] **Step 4: Build dynamic parameter inputs and final preview**

Render text, currency/date, media, URL suffix, OTP, Flow, product, and per-carousel-card inputs as dictated by the definition. Validate with `templateSendParametersSchema` and show the final substituted preview before enabling send.

- [ ] **Step 5: Replace manual inputs in both dialogs**

Thread send and new conversation now submit `templateId` plus parameters. Keep phone/name and existing conversation-conflict behavior unchanged. Agent can send; viewer remains blocked by existing conversation permission and UI controls.

- [ ] **Step 6: Run and verify GREEN**

Run: `node --test apps/dashboard/features/templates/lib/send-parameters.test.mjs`
Run: `pnpm --filter dashboard typecheck`
Run: `pnpm --filter dashboard lint`
Expected: all checks PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/features/templates apps/dashboard/features/inbox
git commit -m "feat: select approved templates when messaging"
```

### Task 14: Slash command template picker in the composer

**Files:**
- Create: `apps/dashboard/features/inbox/lib/slash-command.ts`
- Create: `apps/dashboard/features/inbox/lib/slash-command.test.mjs`
- Create: `apps/dashboard/features/inbox/components/thread/template-slash-menu.tsx`
- Modify: `apps/dashboard/features/inbox/components/thread/composer.tsx`

**Interfaces:**
- Produces `parseSlashCommand(text)` returning `{ active, query }` and a composer dropdown listing approved templates.
- Consumes `ApprovedTemplatePicker` parameter flow from Task 13 to complete the send.

- [ ] **Step 1: Write failing slash parsing tests**

Assert that `/template:` at the start activates the menu, `/template:hel` yields query `hel`, text before the command does not activate it, a trailing space or newline closes it, and an empty draft stays inactive.

```js
assert.deepEqual(parseSlashCommand('/template:hel'), { active: true, query: 'hel' })
assert.deepEqual(parseSlashCommand('oi /template:hel'), { active: false, query: '' })
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test apps/dashboard/features/inbox/lib/slash-command.test.mjs`
Expected: FAIL because the parser does not exist.

- [ ] **Step 3: Build the composer dropdown**

Filter approved templates by name while typing, navigate with arrow keys, confirm with Enter or Tab, and dismiss with Escape. The menu must intercept Enter only while open so normal sending stays unchanged, and it must not fight the persisted draft state in `use-message-drafts`.

- [ ] **Step 4: Complete the send through the parameter form**

Selecting a template clears the slash text from the draft and opens the Task 13 parameter form pre-bound to that template. Sending uses the same `templateId` plus parameters contract, so the 24h window does not block delivery. Agents can send; viewers keep the read-only composer.

- [ ] **Step 5: Run and verify GREEN**

Run: `node --test apps/dashboard/features/inbox/lib/slash-command.test.mjs`
Run: `pnpm --filter dashboard typecheck`
Run: `pnpm --filter dashboard lint`
Expected: all checks PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/features/inbox
git commit -m "feat: pick templates with a composer slash command"
```

### Task 15: Complete verification and manual acceptance

**Files:**
- No source files unless a failing gate exposes a defect.

**Interfaces:**
- Verifies the complete spec and all contracts produced by Tasks 1–14.

- [ ] **Step 1: Run focused tests**

Run: `node --test packages/shared/src/whatsapp-templates.test.mjs apps/api/src/lib/whatsapp/template-payload.test.mjs apps/api/src/lib/whatsapp/templates/policy.test.mjs apps/api/src/lib/whatsapp/templates/assets.test.mjs apps/api/src/routes/whatsapp/templates-policy.test.mjs apps/api/src/routes/conversations/template-send-policy.test.mjs apps/dashboard/features/templates/lib/template-capabilities.test.mjs apps/dashboard/features/templates/lib/template-preview.test.mjs apps/dashboard/features/templates/lib/json-mode.test.mjs apps/dashboard/features/templates/lib/send-parameters.test.mjs`
Expected: all tests PASS.

- [ ] **Step 2: Run workspace gates**

Run: `pnpm typecheck`
Run: `pnpm lint`
Run: `pnpm build`
Run: `pnpm boundaries`
Expected: every Turbo task and boundary check PASS.

- [ ] **Step 3: Verify RBAC manually**

Confirm admin and manager can create/edit/duplicate/submit/sync/delete; agent can list, inspect, and send approved templates; viewer can list and inspect only; legacy `user` cannot open the page or call its API.

- [ ] **Step 4: Verify editorial lifecycle manually**

Create a draft with variables and media, reload it, trigger a stale-edit conflict, duplicate it, submit it once despite a double click, synchronize pending/approved/rejected state, create a new draft revision from the submitted item, compare revisions, and test both deletion confirmations.

- [ ] **Step 5: Verify sending manually**

Send one static and one parameterized approved template in an existing conversation and a new conversation. Confirm the persisted message stores template/revision IDs and that no manual template name/language input remains.

- [ ] **Step 6: Verify Meta failure recovery**

Exercise an invalid media handle and a simulated/rate-limited Graph response. Confirm the draft remains saved, the error is actionable, sync reports partial failure, and retries do not duplicate submissions.

- [ ] **Step 7: Inspect final Git state**

Run: `git status --short`
Run: `git diff --check`
Expected: only intentional feature files are committed; the preexisting `apps/api/package.json` modification remains unstaged and unchanged.
