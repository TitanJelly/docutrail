/**
 * Seed demo users + one template + one route + sample documents.
 * Safe to re-run — skips already-existing records.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/seed-demo.ts
 *
 * Demo accounts (all password: Demo@1234)
 *   admin@ccs.edu        — it_admin
 *   dean@ccs.edu         — dean
 *   exec@ccs.edu         — exec_director
 *   chair@ccs.edu        — dept_chair
 *   coordinator@ccs.edu  — coordinator
 *   faculty@ccs.edu      — faculty
 *   staff@ccs.edu        — office_staff (Records Office)
 *   student@ccs.edu      — student
 */
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { createClient } from '@supabase/supabase-js'
import * as schema from '../src/lib/db/schema'
import { eq } from 'drizzle-orm'

const DEMO_PASSWORD = 'Demo@1234'

type RoleName = 'it_admin' | 'dean' | 'exec_director' | 'dept_chair' | 'coordinator' | 'faculty' | 'office_staff' | 'student'
type DocumentStatus = 'draft' | 'in_review' | 'approved' | 'returned' | 'archived'

const DEMO_USERS: Array<{
  email: string
  fullName: string
  role: RoleName
  officeType?: string
}> = [
  { email: 'admin@ccs.edu', fullName: 'Admin User', role: 'it_admin' },
  { email: 'dean@ccs.edu', fullName: 'Dean Santos', role: 'dean' },
  { email: 'exec@ccs.edu', fullName: 'Exec Director Reyes', role: 'exec_director' },
  { email: 'chair@ccs.edu', fullName: 'Chair Cruz', role: 'dept_chair' },
  { email: 'coordinator@ccs.edu', fullName: 'Coordinator Lim', role: 'coordinator' },
  { email: 'faculty@ccs.edu', fullName: 'Prof. Garcia', role: 'faculty' },
  { email: 'staff@ccs.edu', fullName: 'Records Staff', role: 'office_staff', officeType: 'records' },
  { email: 'student@ccs.edu', fullName: 'Juan dela Cruz', role: 'student' },
]

// Minimal Tiptap JSON content for demo docs
const sampleContent = (title: string) => ({
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: title }],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'This is a demonstration document created by the seed script for DocuTrail defense purposes. All information contained herein is fictional.',
        },
      ],
    },
  ],
})

async function main() {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const client = postgres(process.env.DATABASE_URL!, { max: 1 })
  const db = drizzle(client, { schema })

  // ── Fetch lookup data ──────────────────────────────────────────────────────
  const allRoles = await db.select().from(schema.roles)
  const allOffices = await db.select().from(schema.offices)

  const roleByName = Object.fromEntries(allRoles.map((r) => [r.name, r])) as Record<string, (typeof allRoles)[0]>
  const officeByType = Object.fromEntries(allOffices.map((o) => [o.type, o]))

  // ── Create / ensure demo users ─────────────────────────────────────────────
  console.log('Creating demo users…')
  const createdUsers: Record<string, string> = {} // email → user id

  for (const u of DEMO_USERS) {
    // Check if already in public.users
    const existing = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, u.email))
      .limit(1)

    if (existing.length > 0) {
      console.log(`  skip ${u.email} (already exists)`)
      createdUsers[u.email] = existing[0].id
      continue
    }

    // Create in Supabase Auth
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: u.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: u.fullName },
    })

    if (error || !data.user) {
      // May already exist in auth but not in public.users — try to find it
      const { data: list } = await supabaseAdmin.auth.admin.listUsers()
      const found = list?.users.find((x) => x.email === u.email)
      if (!found) {
        console.error(`  ERROR creating ${u.email}:`, error?.message)
        continue
      }
      createdUsers[u.email] = found.id
    } else {
      createdUsers[u.email] = data.user.id
    }

    const officeId = u.officeType ? officeByType[u.officeType]?.id ?? null : null
    const roleId = roleByName[u.role]?.id
    if (!roleId) { console.error(`  Role ${u.role} not found`); continue }

    await db.insert(schema.users).values({
      id: createdUsers[u.email],
      email: u.email,
      fullName: u.fullName,
      roleId,
      officeId,
    }).onConflictDoNothing()

    console.log(`  created ${u.email}`)
  }

  // ── Demo approval route ────────────────────────────────────────────────────
  console.log('Creating demo approval route…')
  let routeId: string

  const existingRoute = await db
    .select({ id: schema.approvalRoutes.id })
    .from(schema.approvalRoutes)
    .where(eq(schema.approvalRoutes.name, 'Standard Thesis Proposal Route'))
    .limit(1)

  if (existingRoute.length > 0) {
    routeId = existingRoute[0].id
    console.log('  route already exists, skipping')
  } else {
    const [route] = await db
      .insert(schema.approvalRoutes)
      .values({ name: 'Standard Thesis Proposal Route', kind: 'standard' })
      .returning({ id: schema.approvalRoutes.id })
    routeId = route.id

    // Steps: coordinator → dept_chair → dean
    const stepRoles = ['coordinator', 'dept_chair', 'dean'] as const
    for (let i = 0; i < stepRoles.length; i++) {
      const role = roleByName[stepRoles[i]]
      if (!role) continue
      await db.insert(schema.approvalSteps).values({
        routeId,
        orderIndex: i + 1,
        approverRoleId: role.id,
        officeScope: 'any',
        deadlineHours: 48,
      })
    }
    console.log('  route + 3 steps created')
  }

  // ── Demo document template ─────────────────────────────────────────────────
  console.log('Creating demo template…')
  let templateId: string

  const existingTemplate = await db
    .select({ id: schema.documentTemplates.id })
    .from(schema.documentTemplates)
    .where(eq(schema.documentTemplates.name, 'Thesis Proposal'))
    .limit(1)

  if (existingTemplate.length > 0) {
    templateId = existingTemplate[0].id
    console.log('  template already exists, skipping')
  } else {
    const [template] = await db
      .insert(schema.documentTemplates)
      .values({
        name: 'Thesis Proposal',
        type: 'thesis',
        bodySchema: sampleContent('Thesis Proposal'),
        defaultRouteId: routeId,
      })
      .returning({ id: schema.documentTemplates.id })
    templateId = template.id
    console.log('  template created')
  }

  // ── Demo documents ─────────────────────────────────────────────────────────
  console.log('Creating demo documents…')
  const studentId = createdUsers['student@ccs.edu']
  const facultyId = createdUsers['faculty@ccs.edu']

  if (!studentId || !facultyId) {
    console.warn('  Demo user IDs missing — skipping document seeding.')
  } else {
    const DEMO_DOCS: Array<{
      title: string
      creatorEmail: string
      status: DocumentStatus
    }> = [
      { title: 'Thesis Proposal: AI-Based Document Routing', creatorEmail: 'student@ccs.edu', status: 'draft' },
      { title: 'Research Paper: Blockchain Audit Trails', creatorEmail: 'faculty@ccs.edu', status: 'in_review' },
      { title: 'Practicum Report: Web App Development', creatorEmail: 'student@ccs.edu', status: 'approved' },
      { title: 'Clearance Request — Dean Office', creatorEmail: 'student@ccs.edu', status: 'archived' },
      { title: 'Leave of Absence Form', creatorEmail: 'faculty@ccs.edu', status: 'returned' },
    ]

    for (const d of DEMO_DOCS) {
      const existing = await db
        .select({ id: schema.documents.id })
        .from(schema.documents)
        .where(eq(schema.documents.title, d.title))
        .limit(1)

      if (existing.length > 0) {
        console.log(`  skip "${d.title}"`)
        continue
      }

      const creatorId = createdUsers[d.creatorEmail]
      if (!creatorId) continue

      const [doc] = await db
        .insert(schema.documents)
        .values({
          title: d.title,
          templateId,
          creatorId,
          currentStatus: d.status,
          routeId,
        })
        .returning({ id: schema.documents.id })

      // Insert version 1
      await db.insert(schema.documentVersions).values({
        documentId: doc.id,
        versionNo: 1,
        content: sampleContent(d.title),
        createdBy: creatorId,
      }).onConflictDoNothing()

      console.log(`  created "${d.title}" [${d.status}]`)
    }
  }

  console.log('\nDemo seed complete.')
  console.log('\nDemo accounts (password: Demo@1234):')
  for (const u of DEMO_USERS) {
    console.log(`  ${u.email.padEnd(30)} ${u.role}`)
  }

  await client.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
