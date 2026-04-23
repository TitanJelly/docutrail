# DocuTrail — Project Status

> Living snapshot of where the project is and what comes next.
> Update after every meaningful change (minor and major).
> For durable architecture/policy info, see `CLAUDE.md`.

**Last updated:** 2026-04-23

---

## Current phase

**Phase 0 — Scaffold: ✅ DONE**

The app boots, middleware redirects `/` → `/login`, and `/login` returns 404 because Phase 1 hasn't built it yet (expected). Both Supabase REST and the Postgres pooler are reachable.

### Recent commits on `master`
```
ec4abb9 chore: scaffold DocuTrail Phase 0 foundation
3f2a9da Initial commit from Create Next App
```

### What exists now
- Next.js 16.2.4 + React 19.2.4 + TS strict scaffold
- Tailwind v4 + shadcn/ui (~18 primitives installed)
- Supabase clients wired: `client.ts`, `server.ts`, `admin.ts`, `middleware.ts`
- Drizzle wired with `postgres.js`; `src/lib/db/schema.ts` contains **only enums** (no tables yet)
- RBAC scaffold in `src/lib/rbac/permissions.ts` (Role/Action types + `can()` helper, no policies populated)
- PDF + workflow stubs (`src/lib/pdf/`, `src/lib/workflow/stateMachine.ts`) — implemented in later phases
- `scripts/check-connection.ts` smoke test passing

---

## Next up — Phase 1: Auth + RBAC + user provisioning

In order:

- [ ] **Flesh out `src/lib/db/schema.ts`** — add `users`, `roles`, `offices`, `role_permissions` tables with relations. Keep existing pg enums.
- [ ] `npm run db:generate` → review SQL in `supabase/migrations/` → `npm run db:migrate`
- [ ] **Hand-write follow-up migration** with RLS policies + `has_permission(user_id uuid, action text)` SQL helper
- [ ] **Seed roles + office rows** via `scripts/seed.ts` (use admin client, mirror `check-connection.ts` shape)
- [ ] **Login page** at `src/app/(auth)/login/page.tsx` — email+password client component, calls `supabase.auth.signInWithPassword`
- [ ] **Admin user-creation** at `src/app/(app)/admin/users/page.tsx` — server component lists users; server action calls `admin.auth.admin.createUser()` + inserts a row into `users` with chosen role
- [ ] **Role-gated layout shell** at `src/app/(app)/layout.tsx` — fetches current user's role, filters sidebar links via `can(role, action)`

---

## Roadmap (later phases)

- **Phase 2** — Document model + Tiptap editor + draft/publish workflow
- **Phase 3** — Approval state machine + N-node routing + assignment UI
- **Phase 4** — PDF generation (`@react-pdf/renderer`) + signature stamping (`pdf-lib`)
- **Phase 5** — Document-scoped chat + Realtime notifications + Sonner toasts
- **Phase 6** — Audit log triggers + hash-chain + escalation Edge Function (`pg_cron`)
- **Phase 7** — Polish, PWA, analytics, CSV export, defense prep

Detailed plan: `C:\Users\ASUS\.claude\plans\help-me-flesh-out-concurrent-pony.md`.

---

## Known issues / gotchas

- None blocking. Watch out for the `aws-0` vs `aws-1` pooler hostname trap (see `CLAUDE.md` → Constraints).

---

## Update log

- **2026-04-23** — Phase 0 verified working. Connectivity smoke test green. Split CLAUDE.md into a durable guide + this status file.
