/**
 * Run once after `npm run db:push` to enable RLS on Phase 1 tables
 * and install the has_permission() SQL helper.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/setup-rls.ts
 */
import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!, { max: 1 })

async function main() {
  console.log('Setting up RLS policies…')

  // FK to auth.users — ensures cascading delete keeps profiles in sync
  await sql`
    ALTER TABLE users
      ADD CONSTRAINT IF NOT EXISTS users_id_fkey
      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
  `.catch(() => {
    // Constraint may already exist on re-run
  })

  // Enable RLS
  for (const table of ['roles', 'offices', 'users', 'role_permissions']) {
    await sql.unsafe(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`)
    console.log(`  RLS enabled on ${table}`)
  }

  // has_permission() — security definer bypasses RLS inside the function
  await sql`
    CREATE OR REPLACE FUNCTION has_permission(p_user_id uuid, p_action text)
    RETURNS boolean
    LANGUAGE sql SECURITY DEFINER STABLE
    AS $$
      SELECT EXISTS (
        SELECT 1
        FROM role_permissions rp
        JOIN users u ON u.role_id = rp.role_id
        WHERE u.id = p_user_id
          AND u.is_active = true
          AND (rp.action = p_action OR rp.action = '*')
      );
    $$
  `
  console.log('  has_permission() created')

  // Drop and recreate policies idempotently
  const policies: [string, string][] = [
    ['roles', 'roles_select'],
    ['offices', 'offices_select'],
    ['role_permissions', 'role_permissions_select'],
    ['users', 'users_select'],
    ['users', 'users_update'],
  ]
  for (const [table, policy] of policies) {
    await sql.unsafe(`DROP POLICY IF EXISTS "${policy}" ON ${table}`)
  }

  // roles / offices / role_permissions: any authenticated user can read
  await sql`
    CREATE POLICY roles_select ON roles FOR SELECT TO authenticated USING (true)
  `
  await sql`
    CREATE POLICY offices_select ON offices FOR SELECT TO authenticated USING (true)
  `
  await sql`
    CREATE POLICY role_permissions_select ON role_permissions FOR SELECT TO authenticated USING (true)
  `

  // users: see own row, or anyone with manage_users permission
  await sql`
    CREATE POLICY users_select ON users FOR SELECT TO authenticated
    USING (
      id = auth.uid()
      OR has_permission(auth.uid(), 'manage_users')
    )
  `
  // users: only IT admin can update
  await sql`
    CREATE POLICY users_update ON users FOR UPDATE TO authenticated
    USING (has_permission(auth.uid(), 'manage_users'))
    WITH CHECK (has_permission(auth.uid(), 'manage_users'))
  `

  console.log('  Policies created')
  console.log('RLS setup complete.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => sql.end())
