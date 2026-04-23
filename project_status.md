# DocuTrail — Project Status

> Living snapshot of where the project is and what comes next.
> Update after every meaningful change (minor and major).
> For durable architecture/policy info, see `CLAUDE.md`.

**Last updated:** 2026-04-23

---

## Current phase

**Phase 1 — Auth + RBAC + user provisioning: ✅ DONE**

Login page, role-gated app shell, admin user CRUD, full DB schema for Phase 1 tables, and RLS setup scripts are all in place.

### Recent commits on `master`
```
(Phase 1 commit — see git log)
b1715fa chore: expand project docs and add connection smoke test
ec4abb9 chore: scaffold DocuTrail Phase 0 foundation
3f2a9da Initial commit from Create Next App
```

### What exists now

**Database (schema.ts)**
- Enums: `role_name`, `document_status`, `approval_status`, `signature_type`, `notification_kind`
- Tables: `roles`, `offices`, `users`, `role_permissions`

**Auth & RBAC**
- Supabase email+password login at `/login` (`src/app/(auth)/login/`)
- Middleware redirects unauthenticated requests to `/login`
- `(app)/layout.tsx` re-checks auth and fetches user profile
- `src/lib/user.ts` — React-cache `getCurrentUserProfile()` helper (deduplicates DB calls)
- `src/lib/rbac/permissions.ts` — `can(role, action)` helper (mirrors DB policies)

**UI shell**
- `Sidebar` at `src/components/app/Sidebar.tsx` — role-gated nav + sign-out
- `/dashboard` — welcome card with role + email
- `/admin/users` — user list + "Add user" dialog (IT Admin only)
  - `createUserAction`, `deactivateUserAction`, `reactivateUserAction` server actions
  - Atomic: creates `auth.users` first, inserts `public.users` profile, rolls back auth user on failure

**Scripts**
- `npm run setup:rls` — enables RLS on Phase 1 tables, creates `has_permission()` function, installs policies
- `npm run seed` — idempotent seed of all 8 roles + 4 offices + role_permissions

---

## First-run setup (for a fresh Supabase project)

```bash
npm run db:push       # push schema to Supabase
npm run setup:rls     # enable RLS + policies + has_permission()
npm run seed          # seed roles, offices, permissions
```
Then create the first IT Admin user via the Supabase dashboard → Auth → Users (manually), and insert their profile row via SQL editor.

---

## Next up — Phase 2: Document model + Tiptap editor + templates

In order:

- [ ] Add `document_templates`, `documents`, `document_versions` tables to `schema.ts`
- [ ] `npm run db:push` + add RLS policies for document tables in `setup-rls.ts`
- [ ] **Tiptap editor component** at `src/components/editor/Tiptap.tsx`
- [ ] **Template CRUD** at `src/app/(app)/admin/templates/` (IT Admin)
- [ ] **New document page** at `src/app/(app)/documents/new/` — template picker + editor
- [ ] **Document list** at `src/app/(app)/documents/` — shows user's own docs
- [ ] **Draft save** — auto-save Tiptap JSON to `document_versions.content` via server action

---

## Roadmap (later phases)

- **Phase 3** — Approval state machine + N-node routing + assignment UI
- **Phase 4** — PDF generation (`@react-pdf/renderer`) + signature stamping (`pdf-lib`)
- **Phase 5** — Document-scoped chat + Realtime notifications + Sonner toasts
- **Phase 6** — Audit log triggers + hash-chain + escalation Edge Function (`pg_cron`)
- **Phase 7** — Polish, PWA, analytics, CSV export, defense prep

Detailed plan: `C:\Users\ASUS\.claude\plans\help-me-flesh-out-concurrent-pony.md`.

---

## Known issues / gotchas

- **First IT Admin bootstrap** requires manual Supabase dashboard SQL. There's no self-signup, so someone has to create the first `it_admin` account outside the app flow. Document this in the final user guide.
- Watch out for the `aws-0` vs `aws-1` pooler hostname trap (see `CLAUDE.md` → Constraints).

---

## Update log

- **2026-04-23** — Phase 1 complete. Auth + RBAC + user provisioning wired up.
- **2026-04-23** — Phase 0 verified working. Connectivity smoke test green. Split CLAUDE.md into a durable guide + this status file.
