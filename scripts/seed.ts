/**
 * Seed roles, offices, and role_permissions rows.
 * Safe to re-run — uses INSERT ... ON CONFLICT DO NOTHING.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/seed.ts
 */
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { type InferInsertModel } from 'drizzle-orm'
import * as schema from '../src/lib/db/schema'

type RoleName = InferInsertModel<typeof schema.roles>['name']

const client = postgres(process.env.DATABASE_URL!, { max: 1 })
const db = drizzle(client, { schema })

// Rank drives skip-rule enforcement in approval routes (higher = more authority)
const ROLE_RANK: Record<RoleName, number> = {
  it_admin: 0,       // admin, not in routing chain
  student: 1,
  faculty: 2,
  coordinator: 3,
  office_staff: 3,   // lateral target — exempt from skip-rule
  dept_chair: 4,
  dean: 5,
  exec_director: 6,
}

const ROLE_DESCRIPTIONS: Record<RoleName, string> = {
  it_admin: 'IT Administrator — full system access and user provisioning',
  dean: 'Dean — final approval authority, read-all documents',
  exec_director: 'Executive Director — approval and read-all access',
  dept_chair: 'Department Chair — departmental approval authority',
  coordinator: 'Program Coordinator — manages program documents',
  faculty: 'Faculty member — creates and submits documents',
  office_staff: 'Office Staff (Records / SAS / Practicum / Research)',
  student: 'Student — creates and tracks own documents',
}

const ROLE_PERMISSIONS: Record<string, string[]> = {
  it_admin: [
    'read_all_documents',
    'create_document',
    'manage_templates',
    'manage_routes',
    'manage_users',
    'view_audit_log',
    'manage_escalation_rules',
  ],
  dean: ['read_all_documents', 'approve_document', 'view_audit_log'],
  exec_director: ['read_all_documents', 'approve_document', 'view_audit_log'],
  dept_chair: ['read_all_documents', 'approve_document'],
  coordinator: ['read_own_documents', 'approve_document', 'create_document'],
  faculty: ['read_own_documents', 'create_document'],
  office_staff: ['read_own_documents', 'create_document', 'approve_document'],
  student: ['read_own_documents', 'create_document'],
}

const OFFICES = [
  { name: 'Records Office', type: 'records' },
  { name: 'Student Affairs and Services', type: 'sas' },
  { name: 'Practicum Office', type: 'practicum' },
  { name: 'Research Office', type: 'research' },
]

async function main() {
  console.log('Seeding roles…')
  for (const [name, description] of Object.entries(ROLE_DESCRIPTIONS) as [RoleName, string][]) {
    await db
      .insert(schema.roles)
      .values({ name, description, rank: ROLE_RANK[name] })
      .onConflictDoNothing()
  }

  console.log('Seeding offices…')
  for (const office of OFFICES) {
    await db.insert(schema.offices).values(office).onConflictDoNothing()
  }

  console.log('Seeding role_permissions…')
  const allRoles = await db.select().from(schema.roles)
  for (const role of allRoles) {
    const actions = ROLE_PERMISSIONS[role.name] ?? []
    for (const action of actions) {
      await db
        .insert(schema.rolePermissions)
        .values({ roleId: role.id, action, resource: '*' })
        .onConflictDoNothing()
    }
  }

  // Seed default escalation rules (global — route_id IS NULL)
  console.log('Seeding default escalation rules…')
  const allRoles2 = await db.select().from(schema.roles)
  const findRole = (name: string) => allRoles2.find((r) => r.name === name)

  const defaultRules: Array<{
    level: 'L1' | 'L2' | 'L3'
    hoursOverdue: number
    roleName: string
  }> = [
    { level: 'L1', hoursOverdue: 24, roleName: 'faculty' },     // reminder to assignee's role proxy
    { level: 'L2', hoursOverdue: 48, roleName: 'dept_chair' },  // supervisor notified
    { level: 'L3', hoursOverdue: 72, roleName: 'dean' },        // final escalation
  ]

  for (const rule of defaultRules) {
    const role = findRole(rule.roleName)
    if (!role) { console.warn(`  Role ${rule.roleName} not found — skipping`); continue }
    await db
      .insert(schema.escalationRules)
      .values({ level: rule.level, hoursOverdue: rule.hoursOverdue, notifyRoleId: role.id })
      .onConflictDoNothing()
  }

  console.log('Seed complete.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => client.end())
