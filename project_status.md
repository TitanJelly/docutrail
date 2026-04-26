# DocuTrail — Project Status

> Living snapshot. Update after every meaningful change. Durable policy lives in `CLAUDE.md`.

**Last updated:** 2026-04-26

---

## Current phase

**Phase 6 — Chat + uploads + archive**

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
| Audit trail hash-chain + `pg_cron` escalation | ✅ Ph5 |
| Notification bell + Realtime + Sonner toasts | ✅ Ph5 |
| Document-scoped chat, archive, full-text search | 🔜 Ph6 |
| PWA, analytics, CSV export, demo data | 🔜 Ph7 |

---

## DB tables (all pushed except Phase 5 pending)

`roles`, `offices`, `users`, `role_permissions` · `document_templates`, `documents`, `document_versions` · `approval_routes`, `approval_steps`, `document_approvals` · `signatures` · `escalation_rules`, `notifications`, `audit_log`

`document_approvals` gained `escalated_level` + `approved_version_id` in Ph5.

---

## Next — Phase 6: Chat + uploads + archive

- Document-scoped chat (group + private DM)
- PDF/DOCX upload path (bypass editor for external docs)
- Archived bucket + read-only view + full-text search on archived docs

---

## Known issues / gotchas

- First IT Admin must be created manually in Supabase dashboard (no self-signup by design).
- Pooler hostname **must be** `aws-1-*` not `aws-0-*` — project ref `wqldhpvzxrqcttwkigyi`, region `ap-southeast-1`.
- `db:push` requires an interactive terminal — cannot be piped.

---

## Known issues / loopholes (documented by design)

- **L1 (hash-chain bypass via direct DB):** Hash chain proves app-layer integrity; physical Postgres access is a separate infrastructure threat. Documented design decision.
- **L12 (notification read_at not audited):** `read_at` timestamp is the implicit proof of delivery. Documented design decision.

---

## Update log

- **2026-04-26** — Phase 5 DB wiring complete: `triggers.sql` applied (`log_mutation()` audit triggers on all business tables, `enforce_document_status_transition`, `audit_verify` view, `get_overdue_approvals()` RPC); `pg_cron` + `pg_net` extensions enabled; `escalation-scanner` Edge Function deployed; hourly `pg_cron` schedule created (job id 1). Supabase CLI v2.90.0 installed to `%LOCALAPPDATA%\supabase\`.
- **2026-04-26** — Phase 5 complete: `audit_log` + `notifications` + `escalation_rules` tables; `log_mutation()` hash-chain trigger; status-transition trigger (L7); `audit_verify` view; `escalation-scanner` Edge Function with circuit-breaker + idempotency (L2/L6); `NotificationBell` Realtime component + Sonner toasts; stamp failure made fatal (L5); `approvedVersionId` on approvals (L10); `manage_escalation_rules` permission; L11 RLS fix; pre-existing lint errors fixed.
- **2026-04-25** — Phase 4 complete: `signatures` table, PDF generation on submit, signature stamp on approve, `/signatures` CRUD, `/documents/[id]/pdf` download, ApprovalActions upgraded with signature picker.
- **2026-04-25** — DB singleton fix, TiptapViewer SSR fix, document edit-after-return flow.
- **2026-04-24** — Phase 3 complete: approval routing engine, submit/approve/return, `/approvals` inbox.
- **2026-04-24** — Phase 2 complete: Tiptap editor, template CRUD, new-document page.
- **2026-04-23** — Phase 1 complete: auth, RBAC, user provisioning.
- **2026-04-23** — Phase 0: scaffold + connectivity verified.
