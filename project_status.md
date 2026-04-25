# DocuTrail — Project Status

> Living snapshot. Update after every meaningful change. Durable policy lives in `CLAUDE.md`.

**Last updated:** 2026-04-25

---

## Current phase

**Phase 4 — PDF generation + e-signatures: ✅ CODE DONE, DB push pending**

Run once to activate:
```bash
npm run db:push        # interactive — accept all changes
npm run setup:rls
npm run setup:storage  # creates documents + signatures Storage buckets
```

---

## What exists

| Area | Status |
|---|---|
| Scaffold, Supabase connectivity | ✅ Ph0 |
| Auth (email+pw), RBAC, user provisioning | ✅ Ph1 |
| Tiptap editor, document templates, draft save | ✅ Ph2 |
| Approval routing engine (submit → review → approve/return) | ✅ Ph3 |
| PDF generation on submit (`@react-pdf/renderer`) | ✅ Ph4 |
| Signature CRUD (`/signatures`, draw/type/upload) | ✅ Ph4 |
| Signature stamping on approve (`pdf-lib`) | ✅ Ph4 |
| PDF download route `/documents/[id]/pdf` | ✅ Ph4 |
| Audit trail hash-chain + `pg_cron` escalation | 🔜 Ph5 |
| Document-scoped chat, archive, full-text search | 🔜 Ph6 |
| PWA, analytics, CSV export, demo data | 🔜 Ph7 |

---

## DB tables (all pushed except Phase 4 pending)

`roles`, `offices`, `users`, `role_permissions` · `document_templates`, `documents`, `document_versions` · `approval_routes`, `approval_steps`, `document_approvals` · **`signatures`** (Ph4 — needs `db:push`)

`document_approvals` gained `signature_id` FK in Ph4.

---

## Next — Phase 5: Audit trail + escalation

- `audit_log` table (append-only, hash-chain via Postgres trigger)
- `log_mutation()` trigger on all business tables
- `escalation_rules` table + Supabase Edge Function + `pg_cron` hourly scan
- `notifications` table + Realtime bell + Sonner toast

---

## Known issues / gotchas

- First IT Admin must be created manually in Supabase dashboard (no self-signup by design).
- Pooler hostname **must be** `aws-1-*` not `aws-0-*` — project ref `wqldhpvzxrqcttwkigyi`, region `ap-southeast-1`.
- `db:push` requires an interactive terminal — cannot be piped.

---

## Update log

- **2026-04-25** — Phase 4 complete: `signatures` table, PDF generation on submit, signature stamp on approve, `/signatures` CRUD, `/documents/[id]/pdf` download, ApprovalActions upgraded with signature picker.
- **2026-04-25** — DB singleton fix, TiptapViewer SSR fix, document edit-after-return flow.
- **2026-04-24** — Phase 3 complete: approval routing engine, submit/approve/return, `/approvals` inbox.
- **2026-04-24** — Phase 2 complete: Tiptap editor, template CRUD, new-document page.
- **2026-04-23** — Phase 1 complete: auth, RBAC, user provisioning.
- **2026-04-23** — Phase 0: scaffold + connectivity verified.
