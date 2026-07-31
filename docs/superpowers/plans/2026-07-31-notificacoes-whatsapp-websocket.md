# WhatsApp WebSocket Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish native browser notifications for inbound WhatsApp messages while the dashboard tab remains open and hidden.

**Architecture:** Keep the existing `entity:mutated` Socket.io contract and global listener. Isolate event eligibility in a pure function, request browser permission only from a sidebar user action, and navigate to the conversation when a notification is clicked.

**Tech Stack:** Next.js 16, React 19, TypeScript 6, Socket.io Client 4, Web Notifications API, Node 24 test runner, shadcn/Radix sidebar components.

## Global Constraints

- Notify only while the dashboard tab is open and `document.visibilityState !== 'visible'`.
- Notify only `message/created` events whose payload direction is `INBOUND`.
- Do not add a service worker, Web Push, or a new Socket.io event.
- Permission must be requested by a user action, never automatically at layout mount.
- Preserve the existing realtime invalidation and open-thread listeners.

---

### Task 1: Notification eligibility policy

**Files:**
- Create: `apps/dashboard/hooks/message-notification-policy.ts`
- Test: `apps/dashboard/hooks/message-notification-policy.test.mjs`

**Interfaces:**
- Consumes: untrusted `entity:mutated` payload, `NotificationPermission`, and `DocumentVisibilityState`.
- Produces: `getMessageNotification(event, permission, visibility): { conversationId: string; body: string } | null`.

- [ ] **Step 1: Write the failing policy tests**

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import { getMessageNotification } from './message-notification-policy.ts'

const inbound = {
  entity: 'message', action: 'created', entityId: 'm1',
  payload: { id: 'm1', conversationId: 'c1', direction: 'INBOUND', content: 'Olá' },
}

test('returns notification data for an inbound message in a hidden tab', () => {
  assert.deepEqual(getMessageNotification(inbound, 'granted', 'hidden'), {
    conversationId: 'c1', body: 'Olá',
  })
})

test('uses the media fallback when content is empty', () => {
  assert.equal(
    getMessageNotification({ ...inbound, payload: { ...inbound.payload, content: null } }, 'granted', 'hidden')?.body,
    'Mídia recebida',
  )
})

for (const [name, event, permission, visibility] of [
  ['visible tab', inbound, 'granted', 'visible'],
  ['permission denied', inbound, 'denied', 'hidden'],
  ['outbound message', { ...inbound, payload: { ...inbound.payload, direction: 'OUTBOUND' } }, 'granted', 'hidden'],
  ['incomplete payload', { ...inbound, payload: {} }, 'granted', 'hidden'],
]) test(`ignores ${name}`, () => assert.equal(getMessageNotification(event, permission, visibility), null))
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test apps/dashboard/hooks/message-notification-policy.test.mjs`
Expected: FAIL because `message-notification-policy.ts` does not exist.

- [ ] **Step 3: Implement the minimal pure policy**

Define narrow runtime guards for `entity`, `action`, `payload.direction`, `payload.conversationId`, and nullable `payload.content`. Return `null` unless permission is `granted` and visibility is not `visible`.

- [ ] **Step 4: Run the test and verify GREEN**

Run: `node --test apps/dashboard/hooks/message-notification-policy.test.mjs`
Expected: all policy cases PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/hooks/message-notification-policy.ts apps/dashboard/hooks/message-notification-policy.test.mjs
git commit -m "test: define WhatsApp notification policy"
```

### Task 2: Socket listener and browser permission control

**Files:**
- Modify: `apps/dashboard/hooks/use-message-notifications.ts`
- Modify: `apps/dashboard/components/message-notifications.tsx`
- Create: `apps/dashboard/components/notification-status.tsx`
- Modify: `apps/dashboard/components/app-sidebar.tsx`

**Interfaces:**
- Consumes: `getMessageNotification`, `useSocket()`, `router.push`, and the browser `Notification` API.
- Produces: `requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'>` and a sidebar control reflecting `default`, `granted`, `denied`, or `unsupported`.

- [ ] **Step 1: Remove the automatic permission request**

Delete the mount effect that calls `Notification.requestPermission()`. Remove `activeConversationId` from the hook options because visibility alone is the approved rule.

- [ ] **Step 2: Connect the listener to the tested policy**

Inside the socket handler, read the current `Notification.permission` and `document.visibilityState`, call `getMessageNotification`, and return when it yields `null`. Construct one native notification with title `Nova mensagem`, icon `/favicon.ico`, `tag: msg-${conversationId}`, and `renotify: true`.

- [ ] **Step 3: Keep click navigation focused and deterministic**

Set `notification.onclick` to call `window.focus()`, invoke `onNavigate(conversationId)`, and close the notification. Keep listener cleanup paired with the exact handler.

- [ ] **Step 4: Add the sidebar permission control**

Create a `NotificationStatus` sidebar item using `Bell`, `BellRing`, and `BellOff`. On click in state `default`, call `Notification.requestPermission()` and update local state. For `denied`, show “Bloqueadas” with a tooltip explaining browser settings; for unsupported browsers, show “Indisponíveis”; for granted, show “Notificações”.

- [ ] **Step 5: Mount the control without changing existing socket status**

Render `<NotificationStatus />` in `AppSidebar` near `<SidebarSocketStatus />`. Preserve all current local UI behavior.

- [ ] **Step 6: Run focused verification**

Run: `node --test apps/dashboard/hooks/message-notification-policy.test.mjs`
Run: `pnpm --filter dashboard typecheck`
Run: `pnpm --filter dashboard lint`
Expected: tests, TypeScript, and ESLint PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/hooks/use-message-notifications.ts apps/dashboard/components/message-notifications.tsx apps/dashboard/components/notification-status.tsx apps/dashboard/components/app-sidebar.tsx
git commit -m "feat: finish WhatsApp browser notifications"
```

### Task 3: Manual browser verification

**Files:**
- No source files unless verification exposes a defect.

**Interfaces:**
- Consumes: running API and dashboard with an authenticated user and an inbound WhatsApp event.
- Produces: verified behavior in a real browser.

- [ ] **Step 1: Verify permission states**

Confirm the sidebar displays default, granted, denied, and unsupported behavior without requesting permission during page load.

- [ ] **Step 2: Verify foreground/background rules**

With permission granted, confirm no native notification appears while the tab is visible and exactly one appears while it is hidden.

- [ ] **Step 3: Verify navigation**

Click the native notification and confirm the window focuses and the URL becomes `/conversations?c=<conversationId>`.

- [ ] **Step 4: Re-run the final dashboard checks**

Run: `node --test apps/dashboard/hooks/message-notification-policy.test.mjs && pnpm --filter dashboard typecheck && pnpm --filter dashboard lint`
Expected: all commands PASS.

