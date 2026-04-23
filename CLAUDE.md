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
| Escalation | Supabase Edge Function + `pg_cron` hourly scanner |
| Hosting | Vercel + Supabase free tier |

### Folder layout
```
docutrail/
├── scripts/
│   ├── check-connection.ts        # smoke test REST + pooler
│   ├── setup-rls.ts               # enable RLS + has_permission() + policies (run once after db:push)
│   └── seed.ts                    # insert roles / offices / role_permissions
└── src/
    ├── middleware.ts              # gates routes via updateSession
    ├── app/
    │   ├── layout.tsx             # root: fonts + <Toaster richColors />
    │   ├── (auth)/login/          # public login page
    │   └── (app)/                 # authenticated shell
    │       ├── layout.tsx         # sidebar + auth guard
    │       ├── dashboard/         # home page
    │       └── admin/users/       # IT Admin: user list + create
    ├── components/
    │   ├── app/Sidebar.tsx        # role-gated nav + sign-out
    │   └── ui/                    # shadcn primitives
    └── lib/
        ├── supabase/              # client.ts, server.ts, admin.ts, middleware.ts
        ├── db/                    # index.ts (Drizzle client + schema export), schema.ts
        ├── user.ts                # React-cache getCurrentUserProfile() helper
        ├── rbac/permissions.ts    # mirrors DB policies in TS
        ├── pdf/                   # generate + stampSignature (Phase 4)
        └── workflow/stateMachine.ts (Phase 3)
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
npm run seed          # run scripts/seed.ts        — seed roles / offices / permissions
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

## Key patterns (Phase 1)

- **User profile** — always fetch via `getCurrentUserProfile()` from `@/lib/user`. It is `React.cache()`-memoised per request, so layout + page can both call it without a double query.
- **Auth guard** — `(app)/layout.tsx` redirects to `/login` when `getCurrentUserProfile()` returns `null`. The middleware handles the unauthenticated redirect earlier; the layout is a belt-and-suspenders check.
- **Base UI dialogs** — shadcn Dialog is built on `@base-ui/react/dialog`, not Radix. Use the `render` prop instead of `asChild` to customise the trigger element: `<DialogTrigger render={<Button />} />`.
- **Server actions return shape** — `{ success: true }` or `{ success: false; error: string }`. Callers check `result.success` before showing a toast.
- **Zod v4** — use `parsed.error.issues[0].message` (not `.errors`); `z.string().email()` still works.
- **Schema push flow for dev** — edit `schema.ts` → `npm run db:push` → `npm run setup:rls` (only needed when adding new tables) → `npm run seed` (idempotent).

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
