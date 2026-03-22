# Low-Quota Balanced Routing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make low-quota accounts opt out of normal `balanced` round-robin while still remaining as fallback candidates, and expose the behavior as a switch in the settings tasks section without affecting token refresh polling or gateway keepalive.

**Architecture:** Keep the shared gateway candidate pool unchanged. Add a `balanced`-only soft-exclusion layer in route strategy application, driven by a new background-task-style runtime setting. Persist the setting through the existing `backgroundTasks` snapshot and render it in the settings tasks card so the UI stays consistent with existing controls.

**Tech Stack:** Rust service/core, Next.js/TypeScript frontend, TanStack Query, app settings RPC, Rust unit/integration tests.

---

### Task 1: Define the new setting shape

**Files:**
- Modify: `crates/service/src/usage/refresh/settings.rs`
- Modify: `crates/service/src/app_settings/gateway.rs`
- Modify: `crates/service/src/rpc_dispatch/gateway.rs`
- Modify: `apps/src/types/index.ts`
- Modify: `apps/src/lib/api/normalize.ts`

**Step 1: Write the failing tests**

- Extend `crates/service/tests/app_settings.rs` to assert the new `backgroundTasks.excludeLowQuotaFromBalancedRouting` field round-trips through `app_settings_set` and `app_settings_get`.

**Step 2: Run test to verify it fails**

Run: `cargo test -p codexmanager-service --test app_settings -- --nocapture`

Expected: FAIL because the new field is not serialized/deserialized yet.

**Step 3: Write minimal implementation**

- Add `exclude_low_quota_from_balanced_routing` to the runtime settings structs and patch structs.
- Default it to enabled.
- Include it in RPC parsing, app settings persistence, and frontend normalization/types.

**Step 4: Run test to verify it passes**

Run: `cargo test -p codexmanager-service --test app_settings -- --nocapture`

Expected: PASS for the new round-trip assertions.

### Task 2: Add balanced-only low-quota soft exclusion

**Files:**
- Modify: `crates/service/src/gateway/routing/route_hint.rs`
- Modify: `crates/service/src/gateway/routing/tests/route_hint_tests.rs`

**Step 1: Write the failing tests**

- Add tests that prove:
  - `balanced` rotates only across non-low-quota candidates when the switch is enabled.
  - low-quota candidates remain at the tail as fallback.
  - when all candidates are low quota, `balanced` still rotates across them.
  - `ordered` behavior remains unchanged.

**Step 2: Run test to verify it fails**

Run: `cargo test -p codexmanager-service gateway::routing::tests::route_hint_tests -- --nocapture`

Expected: FAIL because route strategy does not currently know about low quota or the new switch.

**Step 3: Write minimal implementation**

- Add a helper in `route_hint.rs` that, only for `balanced`, partitions candidates into normal and low-quota groups using current usage thresholds.
- Apply round-robin to the normal group when present, then append low-quota candidates as fallback.
- If the switch is disabled, keep current behavior.
- If every candidate is low quota, fall back to existing `balanced` rotation across the full list.

**Step 4: Run test to verify it passes**

Run: `cargo test -p codexmanager-service gateway::routing::tests::route_hint_tests -- --nocapture`

Expected: PASS for the new routing behavior.

### Task 3: Add the settings UI control

**Files:**
- Modify: `apps/src/app/settings/page.tsx`

**Step 1: Write the failing test or verification target**

- If there is no existing component test harness for the settings page, use targeted source-level verification and a build check instead of adding a new UI test framework.

**Step 2: Write minimal implementation**

- Add a new switch in the tasks card that matches existing layout and copy style.
- Bind it to `backgroundTasks.excludeLowQuotaFromBalancedRouting`.
- Ensure save/loading behavior reuses the current background tasks mutation/query flow.

**Step 3: Run verification**

Run: `pnpm run build:desktop`

Expected: PASS and typecheck succeeds with the new setting wired through.

### Task 4: Regression verification

**Files:**
- No new files required.

**Step 1: Run focused backend tests**

Run: `cargo test -p codexmanager-service --test app_settings gateway::routing::tests::route_hint_tests -- --nocapture`

Expected: PASS.

**Step 2: Run broader desktop build verification**

Run: `pnpm run build:desktop`

Expected: PASS.

**Step 3: Manual logic checklist**

- `balanced` + switch on: low quota skipped from normal RR, still fallback.
- `balanced` + switch off: old behavior preserved.
- `ordered`: unchanged.
- `token_refresh_polling`: unchanged.
- `gateway_keepalive`: unchanged.
