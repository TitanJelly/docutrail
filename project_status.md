# DocuTrail — Project Status

> Living snapshot. Update after every meaningful change. Durable policy lives in `CLAUDE.md`.

**Last updated:** 2026-04-24

---

## Current phase

**Phase 2 — Document model + Tiptap editor + templates: ✅ DONE**

DB tables pushed, RLS policies set, Tiptap editor built, template CRUD and new-document page wired up.

---

## What exists

| Area | Details |
|---|---|
| **DB tables** | `roles`, `offices`, `users`, `role_permissions` (Ph1) · `document_templates`, `documents`, `document_versions` (Ph2) |
| **Auth** | Supabase email+password · middleware + layout guard · `getCurrentUserProfile()` |
| **RBAC** | RLS + `has_permission()` SQL fn · `permissions.ts` TS mirror |
| **Pages** | `/login` · `/dashboard` · `/documents` · `/documents/new` · `/admin/users` · `/admin/templates` |
| **Editor** | `Tiptap.tsx` — Bold, Italic, Strike, H1–H3, lists, blockquote, undo/redo |
| **Assets** | `public/ccs-header.png` + `public/ccs-footer.png` (extracted from school docx) |
| **Scripts** | `setup:rls`, `seed`, `db:push`, `db:generate`, `check-connection` |

---

## First-run setup (fresh Supabase project)

```bash
npm run db:push
npm run setup:rls
npm run seed
# Then manually create the first it_admin via Supabase dashboard Auth → Users + SQL insert
```

---

## Next — Phase 3: Approval routing engine

- [ ] Schema: `approval_routes`, `approval_steps`, `document_approvals`, `signatures` + deferred FKs
- [ ] `db:push` + RLS for Phase 3 tables
- [ ] `/admin/routes` — route + step CRUD (IT Admin)
- [ ] Submit action: `draft → in_review`, create `document_approvals` rows, notify assignees
- [ ] Approve / reject actions + status advance
- [ ] `/approvals` — pending approval inbox

---

## Known issues

- First IT Admin requires manual Supabase dashboard creation (no self-signup by design).
- Pooler hostname must be `aws-1-*` not `aws-0-*` — see `CLAUDE.md` constraints.

---

## Update log

- **2026-04-24** — Phase 2 complete: schema, RLS, Tiptap editor, template CRUD, new-document page, CCS images.
- **2026-04-24** — MCPs configured (`.mcp.json`): Supabase, Context7, GitHub, shadcn, DevTools, Playwright.
- **2026-04-23** — Phase 1 complete: auth, RBAC, user provisioning.
- **2026-04-23** — Phase 0 verified: scaffold + connectivity smoke test green.
