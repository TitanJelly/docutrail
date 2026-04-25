# DocuTrail — Project Status

> Living snapshot. Update after every meaningful change. Durable policy lives in `CLAUDE.md`.

**Last updated:** 2026-04-25

---

## Current phase

**Phase 3 — Approval routing engine: ✅ DONE (tested 2026-04-25)**

Schema pushed, RLS live, full approval workflow verified. Edit-after-return flow added. Phase 4 is next.

---

## What exists

| Area | Details |
|---|---|
| **DB tables** | `roles` (+ `rank`), `offices`, `users`, `role_permissions` (Ph1) · `document_templates` (+ `default_route_id` FK), `documents` (+ `route_id`, `current_step_id` FKs), `document_versions` (Ph2) · `approval_routes`, `approval_steps`, `document_approvals` (Ph3) |
| **Enums** | `document_status` (draft/in_review/approved/**returned**/archived), `approval_status`, `route_kind`, `office_scope` |
| **Auth** | Supabase email+password · middleware + layout guard · `getCurrentUserProfile()` |
| **RBAC** | RLS + `has_permission()` SQL fn · `permissions.ts` TS mirror |
| **Pages** | `/login` · `/dashboard` · `/documents` · `/documents/new` · `/documents/[id]` · `/approvals` · `/admin/users` · `/admin/templates` · `/admin/routes` · `/admin/routes/[id]` |
| **Editor** | `Tiptap.tsx` (edit) · `TiptapViewer.tsx` (read-only) |
| **Routing engine** | `submitDocumentAction` resolves assignees by role + office_scope, inserts approval rows, flips status · `approveAction` advances steps or marks approved · `returnDocumentAction` returns to creator |
| **Skip-rule** | Enforced in `createStepAction`: standard routes cannot skip >1 rank; office_staff steps are lateral-exempt; escalation routes bypass rule |
| **Assets** | `public/ccs-header.png` + `public/ccs-footer.png` |
| **Scripts** | `setup:rls` (now covers 10 tables), `seed` (now seeds role ranks), `db:push`, `check-connection` |

---

## First-run setup (fresh Supabase project)

```bash
npm run db:push
npm run setup:rls
npm run seed
# Then manually create the first it_admin via Supabase dashboard Auth → Users + SQL insert
```

---

## Pending — activate Phase 3 on database

Schema is code-complete but not yet pushed to Supabase. Run once:
```bash
npm run db:push
npm run setup:rls
npm run seed
```

---

## Next — Phase 4: PDF generation + e-signatures

- `@react-pdf/renderer` CCS-header/footer template → generate PDF on submit
- `signatures` CRUD (draw + typed + image upload to Supabase Storage)
- `pdf-lib` stamps signature onto PDF at each approval step
- Store `document_versions.generated_pdf_path` pointing to Supabase Storage

---

## Known issues

- First IT Admin requires manual Supabase dashboard creation (no self-signup by design).
- Pooler hostname must be `aws-1-*` not `aws-0-*` — see `CLAUDE.md` constraints.

---

## Update log

- **2026-04-25** — DB singleton pattern added to `lib/db/index.ts` (`globalThis` + `max: 5`) to fix `MaxClientsInSessionMode` pool exhaustion in dev.
- **2026-04-25** — Fixed same SSR hydration mismatch in `TiptapViewer.tsx` (missed from 2026-04-24 fix).
- **2026-04-25** — Added document edit flow: `updateDocumentAction`, `/documents/[id]/edit` page + `EditDocumentForm`. Creators can now revise content after a document is returned before re-submitting.
- **2026-04-24** — Fixed Tiptap SSR hydration mismatch: added `immediatelyRender: false` to `useEditor` in `Tiptap.tsx`.
- **2026-04-24** — Phase 3 complete: schema (approval_routes, approval_steps, document_approvals, roles.rank), RLS, route CRUD (/admin/routes), submit/approve/return actions, approval inbox (/approvals), document detail page (/documents/[id]).
- **2026-04-24** — Document status: renamed `rejected` → `returned` (more appropriate for academic routing; per-step approvalStatus still uses `rejected`).
- **2026-04-24** — Phase 3 design locked: template-bound routes, office-scoped assignees, hard-block skip-rule, dedicated `Direct Escalation` template. Plan: `~/.claude/plans/when-a-sender-is-hidden-fiddle.md`.
- **2026-04-24** — Phase 2 complete: schema, RLS, Tiptap editor, template CRUD, new-document page, CCS images.
- **2026-04-24** — MCPs configured (`.mcp.json`): Supabase, Context7, GitHub, shadcn, DevTools, Playwright.
- **2026-04-23** — Phase 1 complete: auth, RBAC, user provisioning.
- **2026-04-23** — Phase 0 verified: scaffold + connectivity smoke test green.
