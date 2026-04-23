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
    await db.insert(schema.roles).values({ name, description }).onConflictDoNothing()
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

  console.log('Seed complete.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => client.end())
