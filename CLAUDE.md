@AGENTS.md

# DocuTrail

Web app for the **College of Computer Studies (CCS)** that replaces paper-based document routing with a digital, role-gated, auditable workflow. Capstone project — see `project_status.md` for current phase and next steps.

## Project goals

- Documents flow: create → approve through N nodes → archive.
- Every action is recorded in a tamper-proof audit trail.
- Missed deadlines escalate automatically.
- Document-scoped chat for collaboration.
- All under a strict RBAC model enforced at the database layer.

## Architecture overview

| Layer | Choice |
|---|---|
| Framework | Next.js 16.2.4 (App Router) + React 19.2.4 + TypeScript |
| Styling / UI | Tailwind v4 + shadcn/ui (Base UI under the hood) + `tw-animate-css` |
| Backend | Supabase only — Postgres, Auth, Storage, Realtime, RLS. No custom Express/Nest. |
| Query layer | Drizzle ORM + `postgres.js` (server) + `@supabase/ssr` (client/SSR) |
| Forms | React Hook Form + Zod + `@hookform/resolvers` |
| Data fetching | TanStack Query (client) + RSC (server) |
| Editor | Tiptap (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/pm`) |
| PDFs | `@react-pdf/renderer` (generate) + `pdf-lib` (stamp signatures) |
| Signatures | `react-signature-canvas` + typed-name + image upload |
| Realtime / toasts | Supabase Realtime + Sonner |
| Charts | Recharts (analytics dashboard) |
| Escalation | Supabase Edge Function + `pg_cron` hourly scanner |
| Hosting | Vercel + Supabase free tier |

### Folder layout
```
docutrail/
├── public/
│   ├── ccs-header.png             # CHMSU/CCS letterhead banner (header)
│   ├── ccs-footer.png             # CCS footer banner (contact + slogan)
│   ├── manifest.json              # PWA manifest (Phase 7)
│   └── sw.js                      # service worker (Phase 7)
├── scripts/
│   ├── check-connection.ts        # smoke test REST + pooler
│   ├── setup-rls.ts               # enable RLS + has_permission() + policies
│   ├── seed.ts                    # seed roles / offices / role_permissions
│   └── seed-demo.ts               # demo users + template + route + docs (Phase 7)
└── src/
    ├── middleware.ts
    ├── app/
    │   ├── layout.tsx
    │   ├── (auth)/login/
    │   ├── api/audit/export/      # CSV export route (Phase 7, gated view_audit_log)
    │   └── (app)/
    │       ├── layout.tsx
    │       ├── dashboard/
    │       ├── documents/         # list (search+filter) + new (editor/upload tabs) + [id] detail + [id]/pdf
    │       │   ├── _components/   # DocumentsFilter (status tabs + ilike search)
    │       │   ├── new/           # NewDocumentForm: editor tab + upload PDF tab
    │       │   └── [id]/          # ChatPanel, ArchiveButton, ApprovalActions, SubmitButton
    │       │       └── edit/
    │       ├── approvals/         # inbox + approve/return actions
    │       ├── signatures/        # user signature CRUD (Phase 4)
    │       ├── analytics/         # analytics dashboard (Phase 7, gated read_all_documents)
    │       ├── audit/             # audit log viewer (Phase 7, gated view_audit_log)
    │       ├── admin/users/       # IT Admin user CRUD
    │       ├── admin/templates/   # IT Admin template CRUD
    │       └── admin/routes/      # approval route + step designer
    ├── components/
    │   ├── app/Sidebar.tsx
    │   ├── app/PwaRegister.tsx    # registers /sw.js on mount (Phase 7)
    │   ├── chat/DocumentChat.tsx  # Realtime chat (Phase 6)
    │   ├── editor/Tiptap.tsx      # rich-text editor
    │   ├── notifications/NotificationBell.tsx  # Realtime bell (Phase 5)
    │   ├── signature/SignaturePad.tsx  # draw/type/upload (Phase 4)
    │   └── ui/                    # shadcn primitives
    └── lib/
        ├── supabase/              # client.ts, server.ts, admin.ts, middleware.ts
        ├── db/                    # index.ts, schema.ts
        ├── user.ts
        ├── chat-actions.ts        # getChatMessagesAction, sendChatMessageAction (Phase 6)
        ├── rbac/permissions.ts
        ├── pdf/                   # CCSDocument.tsx + generate.ts + stampSignature.ts (Phase 4)
        └── workflow/stateMachine.ts
```

## Design & style guidelines

- **TypeScript strict.** `@/*` aliases to `src/*`.
- **shadcn/ui first**, only roll a custom component when shadcn doesn't have one.
- **RSC by default**, mark `"use client"` only when needed (forms, editor, realtime).
- **Forms = RHF + Zod schema**, never raw `<form>` state.
- **Server actions or Route Handlers** for mutations — no API routes for CRUD.
- **No CSS files** outside `globals.css`; everything is Tailwind utilities.
- **`cn()` helper** for class merging (`@/lib/utils`).
- **Dark mode via `next-themes`** — token-driven through `globals.css`.

## Constraints & policies

- **Zero budget.** Every dependency must have a usable free tier. Flag cost before suggesting paid services (Twilio, SendGrid paid, Vercel Pro, etc).
- **No self-signup.** IT Admin provisions all accounts via the service-role client (`src/lib/supabase/admin.ts`).
- **In-app notifications only** for now. Email/SMS deferred.
- **RLS is the source of truth.** The `permissions.ts` map mirrors SQL policies — keep them in sync; treat them as two views of the same rules.
- **Audit log is append-only.** Hash-chain (`prev_hash`, `row_hash`) written by Postgres triggers. Plan: `REVOKE ALL ... GRANT INSERT` on `audit_log` so even the service role cannot UPDATE/DELETE from app code.
- **Routing integrity — "routes as rails, not choices."** Senders never pick a recipient. Every document is created from a template; the template has one `default_route_id`; `approval_steps` are resolved to assignees server-side by role + `office_scope` (`creator_office | specific_office | any`). `document_approvals` INSERT is blocked for all app roles (service-role only); UPDATE is gated by `assignee_id = auth.uid() AND status = 'pending'`. IT Admin cannot save a route that skips >1 rank unless the route's `kind = 'escalation'` — enforced by Zod + DB check constraint. Legit Chair-bypass cases use a first-class `Direct Escalation` template with required justification. Full design: `~/.claude/plans/when-a-sender-is-hidden-fiddle.md`.
- **Session-refresh ordering is sacred.** In `lib/supabase/middleware.ts`, never insert code between `createServerClient()` and `supabase.auth.getUser()` — `@supabase/ssr` requires that ordering.
- **Middleware skips auth when env vars are missing**, so a fresh checkout boots before `.env.local` is filled.
- **Never commit secrets.** `.env.local` is gitignored; `.env.example` is the committed template.

### Roles
```
it_admin, dean, exec_director, dept_chair, coordinator,
faculty, office_staff, student
```
Office types for `office_staff`: `records`, `sas`, `practicum`, `research`.

### Environment vars (`.env.local`)
| Var | Used by |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only — admin user provisioning |
| `DATABASE_URL` | Drizzle migrations + server queries (Session pooler, port 5432) |

⚠️ Pooler hostname is `aws-1-{region}.pooler.supabase.com` (NOT `aws-0-*`). Project ref `wqldhpvzxrqcttwkigyi`, region `ap-southeast-1`. If DB connectivity ever fails with **"Tenant or user not found"**, swap `aws-0` → `aws-1` first.

## Repo & git rules

- Single git repo lives in `docutrail/`, not at `CapstoneProject/` root (npm rejects capitalized names).
- Branch from `master`; commit messages use Conventional Commits prefix (`feat:`, `fix:`, `chore:`, `docs:`).
- Never commit `.env.local`, `node_modules/`, `.next/`, `tsconfig.tsbuildinfo`.
- Run `npm run typecheck` and `npm run lint` before committing.
- Update `project_status.md` after every meaningful change so the next session has a current snapshot.

## Commands & workflows

Run from `C:\Users\ASUS\Desktop\CapstoneProject\docutrail\`. Package manager is **npm** (not pnpm).

```bash
npm run dev           # dev server → http://localhost:3000
npm run build         # production build (also serves as type+lint sanity check)
npm run start         # serve the production build
npm run typecheck     # tsc --noEmit
npm run lint          # eslint flat config

npm run db:generate   # drizzle-kit generate  (after editing src/lib/db/schema.ts)
npm run db:migrate    # drizzle-kit migrate   (apply pending migrations)
npm run db:push       # drizzle-kit push      (direct push, skip migration files)
npm run db:studio     # drizzle-kit studio    (DB GUI)

npm run setup:rls     # run scripts/setup-rls.ts  — enable RLS + policies (once per fresh DB)
npm run setup:storage # run scripts/setup-storage.ts — create documents + signatures buckets (Phase 4)
npm run seed          # run scripts/seed.ts        — seed roles / offices / permissions
npm run seed:demo     # run scripts/seed-demo.ts   — 8 demo users + 1 template + 1 route + 5 docs (idempotent)
```

### Connectivity smoke test (run first if anything seems off)
```bash
npx tsx --env-file=.env.local scripts/check-connection.ts
```
Expected:
```
[ ok ] Supabase REST API: reachable (200)
[ ok ] Postgres (pooler): server time ...
```

### Adding a shadcn component
```bash
npx shadcn@latest add <component>
```

## Key patterns

- **User profile** — always fetch via `getCurrentUserProfile()` from `@/lib/user`. `React.cache()`-memoised per request; layout + page share the result without a double query.
- **Auth guard** — `(app)/layout.tsx` redirects to `/login` when profile is null. Middleware handles it first; layout is belt-and-suspenders.
- **Base UI dialogs** — shadcn Dialog is built on `@base-ui/react/dialog`, not Radix. Use the `render` prop: `<DialogTrigger render={<Button />} />`. Same for `AlertDialogTrigger`.
- **Button as link** — Base UI Button has no `asChild`. Use `<Link className={cn(buttonVariants({ size: 'sm' }))} href="..." />` instead.
- **Server actions return shape** — `{ success: true }` or `{ success: false; error: string }`. Callers check `result.success` before toasting.
- **Zod v4** — `z.record()` requires two args: `z.record(z.string(), z.unknown())`. Error message via `parsed.error.issues[0].message`.
- **Tiptap v3** — `useEditor` requires `immediatelyRender: false` (prevents SSR hydration mismatch) and `shouldRerenderOnTransaction: true` (keeps toolbar active-states reactive). Content in/out via `editor.getJSON()` / `content` prop (init only). Import type: `import type { JSONContent } from '@tiptap/core'`.
- **Schema push flow** — edit `schema.ts` → `npm run db:push` (interactive) → `npm run setup:rls` → `npm run seed` (idempotent). For Phase 4+ also run `npm run setup:storage` once.
- **PDF generation** — `generateDocumentPdf()` in `lib/pdf/generate.ts` calls `renderToBuffer` server-side via `React.createElement(CCSDocument, ...)`. `@react-pdf/renderer` is in `serverExternalPackages` so webpack never bundles it for the browser. Generated PDF uploaded to `documents/{docId}/latest.pdf` in Supabase Storage using the admin client.
- **Signature stamping** — `stampSignatureOnPdf()` in `lib/pdf/stampSignature.ts` uses `pdf-lib`. Step 1 stamps at x=30, step 2 at x=160, etc. (130pt spacing), y=38pt from bottom of last page. Overwrites the same `latest.pdf` path in Storage.
- **Storage operations** — always use `createAdminClient()` (service role) for Storage upload/download in server actions; browser never touches Storage directly.
- **Chat / Realtime** — `DocumentChat.tsx` subscribes via `supabase.channel('chat:{docId}').on('postgres_changes', { event: 'INSERT', table: 'chat_messages', filter: 'document_id=eq.{id}' }, ...)`. On INSERT, re-fetches via `getChatMessagesAction()` to pick up sender name join. Chat server actions live in `src/lib/chat-actions.ts` (imported by client components via `@/lib/chat-actions`).
- **File upload server action** — accept `FormData` directly: `async function uploadDocumentAction(formData: FormData)`. Call from client with `const fd = new FormData(); fd.append('file', file); await uploadDocumentAction(fd)`. Do NOT use `<form action={fn}>` — call the action manually for better error handling.
- **TabsContent (Base UI Panel)** — does NOT support `asChild` or slot composition. Wrap your `<form>` inside `<TabsContent value="...">...</TabsContent>`; never pass `asChild` as a prop.
- **Documents page search** — accepts `searchParams: Promise<{ q?: string; status?: string }>` (must be `await`ed). Filters with `ilike(documents.title, \`%${q}%\`)` and `eq(documents.currentStatus, status)`. `DocumentsFilter` client component uses `useSearchParams` + `useRouter().push` with 350ms debounce.
- **Next 16 metadata vs viewport** — `themeColor` belongs in `export const viewport: Viewport = { themeColor: '...' }`, NOT in `metadata`. Putting it in `metadata` triggers a build-time warning on every page. See `src/app/layout.tsx`.

## MCP servers

Project-scoped via `.mcp.json` (gitignored). Auto-start when a Claude Code session opens in this folder, terminate on session exit — no global registration.

| Server | Purpose |
|---|---|
| `supabase` | SQL, migrations, RLS, Storage, logs (read-only by default; needs PAT) |
| `context7` | Live docs for Next 16, Drizzle, Tiptap, `@react-pdf/renderer`, `pdf-lib` |
| `github` | Issues, PRs, releases (needs PAT with `repo` scope) |
| `shadcn` | Add / preview shadcn components |
| `chrome-devtools` | Inspect running dev server: console, network, DOM |
| `playwright` | E2E flows (login → draft → route → sign → audit) |

Before first session: paste **Supabase PAT** (https://supabase.com/dashboard/account/tokens) and **GitHub PAT** (`repo` scope) into the placeholders in `.mcp.json`, then restart Claude Code.

## Testing & build

No test runner is set up yet (TBD per phase). Until then:

- **Type safety** via `npm run typecheck` is the baseline check.
- **Lint** via `npm run lint`.
- **Build** via `npm run build` catches RSC/server-component boundary errors that `tsc` misses.
- **DB connectivity** via the smoke test above before touching migrations.
- **Manual verification** in the browser for any UI change (don't claim a UI feature works without loading it).

## Reference

- Spec: `..\spec.md` (one level up at `CapstoneProject\spec.md`).
- Implementation plan: `C:\Users\ASUS\.claude\plans\help-me-flesh-out-concurrent-pony.md`.
- Next 16 docs in-tree: `node_modules\next\dist\docs\` — read before writing framework-specific code (Next 16 has breaking changes; see `AGENTS.md`).
- Current status & next steps: `project_status.md`.
