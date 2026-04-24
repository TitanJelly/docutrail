/**
 * Create the initial IT admin user for bootstrapping the system.
 * This script:
 *   1. Creates an auth.users row in Supabase Auth
 *   2. Creates a corresponding user record in the public.users table with it_admin role
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/create-admin.ts [email] [password] [fullName]
 *
 * Example:
 *   npx tsx --env-file=.env.local scripts/create-admin.ts admin@example.com "SecurePass123" "Admin User"
 */

import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq } from 'drizzle-orm'
import { createClient } from '@supabase/supabase-js'
import * as schema from '../src/lib/db/schema'

const args = process.argv.slice(2)
if (args.length < 3) {
  console.error('Usage: npx tsx scripts/create-admin.ts <email> <password> <fullName>')
  console.error('')
  console.error('Example:')
  console.error('  npx tsx --env-file=.env.local scripts/create-admin.ts admin@ccs.edu "SecurePass123!" "IT Admin"')
  process.exit(1)
}

const [email, password, fullName] = args

const client = postgres(process.env.DATABASE_URL!, { max: 1 })
const db = drizzle(client, { schema })

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  },
)

async function main() {
  console.log(`Creating admin user: ${email}`)

  const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError) {
    console.error('❌ Failed to create auth user:', authError.message)
    process.exit(1)
  }

  console.log(`✓ Created auth user with ID: ${authUser.user.id}`)

  const itAdminRole = await db
    .select()
    .from(schema.roles)
    .where(eq(schema.roles.name, 'it_admin'))
    .limit(1)
    .then((r) => r[0])

  if (!itAdminRole) {
    console.error('❌ it_admin role not found. Run `npm run seed` first.')
    await adminClient.auth.admin.deleteUser(authUser.user.id)
    process.exit(1)
  }

  try {
    await db.insert(schema.users).values({
      id: authUser.user.id,
      email,
      fullName,
      roleId: itAdminRole.id,
      officeId: null,
    })
    console.log(`✓ Created user record in database`)
  } catch (err) {
    console.error('❌ Failed to create user record:', err instanceof Error ? err.message : String(err))
    await adminClient.auth.admin.deleteUser(authUser.user.id)
    process.exit(1)
  }

  console.log('')
  console.log('✅ Admin user created successfully!')
  console.log(`   Email: ${email}`)
  console.log(`   Role: it_admin`)
  console.log('')
  console.log('You can now log in at http://localhost:3000 and create additional users.')
}

main()
  .catch((err) => {
    console.error('Fatal error:', err)
    process.exit(1)
  })
  .finally(() => client.end())
