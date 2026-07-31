# Conversation Context Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add right-click conversation actions with server-enforced RBAC, assignment concurrency control, and realtime synchronization.

**Architecture:** Put conversation mutations in a focused Fastify subplugin and keep authorization rules testable as pure policy. Regenerate the OpenAPI client, then build a dashboard context-menu component backed by a mutation hook and a small assignee dialog.

**Tech Stack:** Fastify 5, Prisma 7/PostgreSQL, Zod 4, Socket.io 4, Next.js 16, React Query 5, Radix Context Menu, Node 24 test runner, generated hey-api client.

## Global Constraints

- Admin and manager may assume, assign, and unassign conversations.
- Assignment targets must be active users with role `agent`.
- Agent may mark read and close/reopen only conversations in their own scope.
- Viewer has no context-menu actions.
- Assignment must reject stale `expectedAssigneeId` with HTTP 409.
- Every successful mutation emits `entity:mutated` for `conversation/updated`.

---

### Task 1: Conversation action policy

**Files:**
- Create: `apps/api/src/routes/conversations/action-policy.ts`
- Test: `apps/api/src/routes/conversations/action-policy.test.mjs`

**Interfaces:**
- Produces: `canAssignConversation(role)`, `canChangePriority(role)`, `canChangeStatus(role)`, `isEligibleAssignee(user)`, and `assigneeMatches(currentId, expectedId)`.

- [ ] **Step 1: Write failing policy tests**

Test that admin/manager can assign, only admin/manager can change priority, admin/manager/agent can change status, only non-banned `agent` users are eligible, and nullable assignee IDs must match exactly.

- [ ] **Step 2: Run and verify RED**

Run: `node --test apps/api/src/routes/conversations/action-policy.test.mjs`
Expected: FAIL because the policy module does not exist.

- [ ] **Step 3: Implement minimal policy functions**

Use explicit role arrays and exact nullable equality; do not depend on Fastify or Prisma so the policy remains deterministic.

- [ ] **Step 4: Run and verify GREEN**

Run: `node --test apps/api/src/routes/conversations/action-policy.test.mjs`
Expected: all policy cases PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/conversations/action-policy.ts apps/api/src/routes/conversations/action-policy.test.mjs
git commit -m "test: define conversation action permissions"
```

### Task 2: Backend conversation action routes

**Files:**
- Create: `apps/api/src/routes/conversations/actions.ts`
- Modify: `apps/api/src/routes/conversations/index.ts`
- Modify: `apps/api/src/routes/members/index.ts`

**Interfaces:**
- Consumes: `conversationSchema`, `conversationRelationsInclude`, `findScopedConversation`, policy functions, and `app.emitRealtimeEvent`.
- Produces operation IDs: `updateConversation`, `assignConversation`, `unassignConversation`, `closeConversation`, and `reopenConversation`.

- [ ] **Step 1: Define route schemas**

Use `z.object({ id: z.string() })` params; `PATCH` body `{ priority: ConversationPrioritySchema }`; assignment body `{ userId: z.string(), expectedAssigneeId: z.string().nullable() }`; unassignment body `{ expectedAssigneeId: z.string().nullable() }`. Return `conversationSchema` for HTTP 200 and document 409 on assignment conflicts.

- [ ] **Step 2: Implement atomic assignment**

Require `admin` or `manager`, load the target with `{ id: userId, role: 'agent', banned: { not: true } }`, then call `conversation.updateMany` with both conversation id and `assignedToId: expectedAssigneeId`. Set `assignedToId` and `assignedAt`. If count is zero, return 404 when the conversation is absent and 409 otherwise; fetch and return the updated conversation with relations.

- [ ] **Step 3: Implement atomic unassignment**

Use the same role check and stale-assignee guard. Set `assignedToId: null` and `assignedAt: null`, distinguish 404 from 409, and return the related conversation.

- [ ] **Step 4: Implement priority, close, and reopen**

Priority requires admin/manager. Close/reopen require admin/manager/agent and use `findScopedConversation` so agents cannot discover other agents' conversations. Close sets `CLOSED`, `closedAt`, and `closedById`; reopen sets `OPEN` and clears both closure fields.

- [ ] **Step 5: Emit one conversation update per mutation**

After each successful write, call:

```ts
app.emitRealtimeEvent({ entity: 'conversation', action: 'updated', entityId: updated.id })
```

- [ ] **Step 6: Register the action subplugin**

Import and register `actionsRoutes` in `conversations/index.ts` alongside messages, send, and start.

- [ ] **Step 7: Expose eligible-member data to managers**

Allow `GET /members` for `admin` and `manager`; add `banned: z.boolean().nullable()` to its response and Prisma select. Preserve the admin users page response compatibility.

- [ ] **Step 8: Verify backend**

Run: `node --test apps/api/src/routes/conversations/action-policy.test.mjs`
Run: `pnpm --filter @workspace/api typecheck`
Run: `pnpm --filter @workspace/api lint`
Expected: all checks PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/routes/conversations/action-policy.ts apps/api/src/routes/conversations/action-policy.test.mjs apps/api/src/routes/conversations/actions.ts apps/api/src/routes/conversations/index.ts apps/api/src/routes/members/index.ts
git commit -m "feat: add conversation management actions"
```

### Task 3: Regenerate the OpenAPI client

**Files:**
- Modify generated files under `packages/api-client/src/`.

**Interfaces:**
- Produces generated query/mutation helpers for the five new operation IDs and `banned` on `ListMembersResponse`.

- [ ] **Step 1: Confirm API health**

Run: `Invoke-RestMethod http://localhost:3333/health`
Expected: healthy response. If it is not running, start `pnpm dev:api`, wait for readiness, and check again.

- [ ] **Step 2: Regenerate**

Run: `pnpm generate:api`
Expected: generated SDK, types, Zod schemas, and React Query helpers include all new operations.

- [ ] **Step 3: Verify generated package**

Run: `pnpm --filter @workspace/api-client typecheck`
Expected: PASS.

- [ ] **Step 4: Commit generated output**

```bash
git add packages/api-client/src
git commit -m "chore: regenerate conversation action client"
```

### Task 4: Dashboard action visibility policy

**Files:**
- Create: `apps/dashboard/features/inbox/lib/conversation-action-policy.ts`
- Test: `apps/dashboard/features/inbox/lib/conversation-action-policy.test.mjs`

**Interfaces:**
- Produces: `getConversationActions(role, userId, conversation): { canAssign; canUnassign; canMarkRead; canChangePriority; canChangeStatus }`.

- [ ] **Step 1: Write failing matrix tests**

Cover admin, manager, owner agent, non-owner agent, and viewer. Assert admin/manager assignment; agent read/status only when `assignedToId === userId`; viewer all false; and `canMarkRead` false when `unreadCount === 0`.

- [ ] **Step 2: Run and verify RED**

Run: `node --test apps/dashboard/features/inbox/lib/conversation-action-policy.test.mjs`
Expected: FAIL because the policy module does not exist.

- [ ] **Step 3: Implement the minimal matrix**

Keep this file free of React and generated runtime imports. Accept only the fields `assignedToId`, `unreadCount`, and `status` required by the policy.

- [ ] **Step 4: Run and verify GREEN**

Run: `node --test apps/dashboard/features/inbox/lib/conversation-action-policy.test.mjs`
Expected: all matrix tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/features/inbox/lib/conversation-action-policy.ts apps/dashboard/features/inbox/lib/conversation-action-policy.test.mjs
git commit -m "test: define conversation context actions"
```

### Task 5: Dashboard mutations and assignment dialog

**Files:**
- Create: `apps/dashboard/features/inbox/hooks/use-conversation-actions.ts`
- Create: `apps/dashboard/features/inbox/components/conversation-list/assign-conversation-dialog.tsx`
- Modify: `apps/dashboard/features/inbox/hooks/index.ts`

**Interfaces:**
- Consumes generated mutation helpers and `listMembersOptions()`.
- Produces mutation methods `assign`, `unassign`, `markRead`, `changePriority`, `close`, `reopen`, plus `isPending`.

- [ ] **Step 1: Implement the action hook**

Create one `useMutation` per generated operation. Pass `expectedAssigneeId: conversation.assignedToId` for assign/unassign. On success invalidate `Conversations`; on error use `errorText` and a Portuguese fallback via `toast.error`. Expose a combined pending flag.

- [ ] **Step 2: Implement the assignment dialog**

Load `listMembersOptions()` only while open, filter `role === 'agent' && banned !== true`, and render a searchable/selectable list with name and email. Disable the current assignee, submit through `assign`, and close only after success.

- [ ] **Step 3: Export the hook**

Add `useConversationActions` to the Inbox hooks barrel without widening unrelated exports.

- [ ] **Step 4: Verify dashboard types**

Run: `pnpm --filter dashboard typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/features/inbox/hooks/use-conversation-actions.ts apps/dashboard/features/inbox/hooks/index.ts apps/dashboard/features/inbox/components/conversation-list/assign-conversation-dialog.tsx
git commit -m "feat: add conversation action mutations"
```

### Task 6: Right-click menu integration

**Files:**
- Create: `apps/dashboard/features/inbox/components/conversation-list/conversation-context-menu.tsx`
- Modify: `apps/dashboard/features/inbox/components/conversation-list/conversation-list-item.tsx`
- Modify: `apps/dashboard/features/inbox/components/conversation-list/index.ts`

**Interfaces:**
- Consumes `getConversationActions`, `useConversationActions`, `useUserRole`, and `AssignConversationDialog`.
- Produces a context-menu wrapper around the existing conversation button.

- [ ] **Step 1: Build the conditional menu**

Use `ContextMenuTrigger asChild`. Render assignment items only for admin/manager, read only when unread, a priority radio submenu for admin/manager, and exactly one of close/reopen based on status. Render children unchanged when no action is available.

- [ ] **Step 2: Wire actions and pending state**

Call hook methods from `onSelect`, disable items while any mutation is pending, use a destructive style for “Encerrar”, and open `AssignConversationDialog` from “Atribuir a outro”. “Assumir” passes the current session user id.

- [ ] **Step 3: Wrap the existing list item**

Keep the current button markup, click selection, badges, and styling unchanged; wrap it with `ConversationContextMenu` so right-click does not select another conversation.

- [ ] **Step 4: Run focused and workspace verification**

Run: `node --test apps/dashboard/features/inbox/lib/conversation-action-policy.test.mjs`
Run: `pnpm --filter dashboard typecheck`
Run: `pnpm --filter dashboard lint`
Expected: all checks PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/features/inbox/components/conversation-list apps/dashboard/features/inbox/lib/conversation-action-policy.ts apps/dashboard/features/inbox/lib/conversation-action-policy.test.mjs
git commit -m "feat: add conversation context menu"
```

### Task 7: End-to-end verification

**Files:**
- No source files unless verification exposes a defect.

- [ ] **Step 1: Run all focused policy tests**

Run: `node --test apps/api/src/routes/conversations/action-policy.test.mjs apps/dashboard/features/inbox/lib/conversation-action-policy.test.mjs`
Expected: all tests PASS.

- [ ] **Step 2: Run affected workspace gates**

Run: `pnpm --filter @workspace/api typecheck && pnpm --filter @workspace/api lint && pnpm --filter @workspace/api-client typecheck && pnpm --filter dashboard typecheck && pnpm --filter dashboard lint`
Expected: all gates PASS.

- [ ] **Step 3: Run architectural verification**

Run: `pnpm boundaries`
Expected: PASS.

- [ ] **Step 4: Verify RBAC manually**

Confirm admin and manager see all assignment actions; agent sees only read and close/reopen on owned conversations; viewer sees no menu. Confirm stale assignment returns a visible conflict toast and another connected dashboard updates through Socket.io.

