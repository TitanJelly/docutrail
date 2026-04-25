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
  for (const table of [
    'roles', 'offices', 'users', 'role_permissions',
    'document_templates', 'documents', 'document_versions',
    'approval_routes', 'approval_steps', 'signatures', 'document_approvals',
  ]) {
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
    ['document_templates', 'document_templates_select'],
    ['document_templates', 'document_templates_insert'],
    ['document_templates', 'document_templates_update'],
    ['documents', 'documents_select'],
    ['documents', 'documents_insert'],
    ['documents', 'documents_update'],
    ['document_versions', 'document_versions_select'],
    ['document_versions', 'document_versions_insert'],
    ['approval_routes', 'approval_routes_select'],
    ['approval_routes', 'approval_routes_insert'],
    ['approval_routes', 'approval_routes_update'],
    ['approval_steps', 'approval_steps_select'],
    ['approval_steps', 'approval_steps_insert'],
    ['approval_steps', 'approval_steps_update'],
    ['approval_steps', 'approval_steps_delete'],
    ['document_approvals', 'document_approvals_select'],
    ['document_approvals', 'document_approvals_insert'],
    ['document_approvals', 'document_approvals_update'],
    ['signatures', 'signatures_select'],
    ['signatures', 'signatures_insert'],
    ['signatures', 'signatures_update'],
    ['signatures', 'signatures_delete'],
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

  // document_templates: any authenticated user can read; only manage_templates can write
  await sql`
    CREATE POLICY document_templates_select ON document_templates
    FOR SELECT TO authenticated USING (deleted_at IS NULL)
  `
  await sql`
    CREATE POLICY document_templates_insert ON document_templates
    FOR INSERT TO authenticated
    WITH CHECK (has_permission(auth.uid(), 'manage_templates'))
  `
  await sql`
    CREATE POLICY document_templates_update ON document_templates
    FOR UPDATE TO authenticated
    USING (has_permission(auth.uid(), 'manage_templates'))
    WITH CHECK (has_permission(auth.uid(), 'manage_templates'))
  `

  // documents: creator sees own; read_all_documents roles see all
  await sql`
    CREATE POLICY documents_select ON documents
    FOR SELECT TO authenticated
    USING (
      deleted_at IS NULL
      AND (
        creator_id = auth.uid()
        OR has_permission(auth.uid(), 'read_all_documents')
      )
    )
  `
  // any authenticated user may insert, but creator_id must equal their uid
  await sql`
    CREATE POLICY documents_insert ON documents
    FOR INSERT TO authenticated
    WITH CHECK (creator_id = auth.uid())
  `
  // creator can update own draft; read_all_documents roles can update any
  await sql`
    CREATE POLICY documents_update ON documents
    FOR UPDATE TO authenticated
    USING (
      creator_id = auth.uid()
      OR has_permission(auth.uid(), 'read_all_documents')
    )
    WITH CHECK (
      creator_id = auth.uid()
      OR has_permission(auth.uid(), 'read_all_documents')
    )
  `

  // document_versions: visible if the parent document is visible to the user
  await sql`
    CREATE POLICY document_versions_select ON document_versions
    FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM documents d
        WHERE d.id = document_id
          AND d.deleted_at IS NULL
          AND (
            d.creator_id = auth.uid()
            OR has_permission(auth.uid(), 'read_all_documents')
          )
      )
    )
  `
  // only the document creator (or read_all_documents role) may insert versions
  await sql`
    CREATE POLICY document_versions_insert ON document_versions
    FOR INSERT TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM documents d
        WHERE d.id = document_id
          AND (
            d.creator_id = auth.uid()
            OR has_permission(auth.uid(), 'read_all_documents')
          )
      )
    )
  `

  // approval_routes: any authenticated user can read; manage_routes can write
  await sql`
    CREATE POLICY approval_routes_select ON approval_routes
    FOR SELECT TO authenticated USING (deleted_at IS NULL)
  `
  await sql`
    CREATE POLICY approval_routes_insert ON approval_routes
    FOR INSERT TO authenticated
    WITH CHECK (has_permission(auth.uid(), 'manage_routes'))
  `
  await sql`
    CREATE POLICY approval_routes_update ON approval_routes
    FOR UPDATE TO authenticated
    USING (has_permission(auth.uid(), 'manage_routes'))
    WITH CHECK (has_permission(auth.uid(), 'manage_routes'))
  `

  // approval_steps: readable by all authenticated; writable only by manage_routes
  await sql`
    CREATE POLICY approval_steps_select ON approval_steps
    FOR SELECT TO authenticated USING (true)
  `
  await sql`
    CREATE POLICY approval_steps_insert ON approval_steps
    FOR INSERT TO authenticated
    WITH CHECK (has_permission(auth.uid(), 'manage_routes'))
  `
  await sql`
    CREATE POLICY approval_steps_update ON approval_steps
    FOR UPDATE TO authenticated
    USING (has_permission(auth.uid(), 'manage_routes'))
    WITH CHECK (has_permission(auth.uid(), 'manage_routes'))
  `
  await sql`
    CREATE POLICY approval_steps_delete ON approval_steps
    FOR DELETE TO authenticated
    USING (has_permission(auth.uid(), 'manage_routes'))
  `

  // document_approvals: INSERT blocked for all app roles (service role / Drizzle superuser writes)
  await sql`
    CREATE POLICY document_approvals_insert ON document_approvals
    FOR INSERT TO authenticated
    WITH CHECK (false)
  `
  // SELECT: assignee sees own rows; creator sees rows for their docs; read_all_documents sees all
  await sql`
    CREATE POLICY document_approvals_select ON document_approvals
    FOR SELECT TO authenticated
    USING (
      assignee_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM documents d
        WHERE d.id = document_id
          AND (d.creator_id = auth.uid() OR has_permission(auth.uid(), 'read_all_documents'))
      )
    )
  `
  // UPDATE: only the assigned user can act on a pending row
  await sql`
    CREATE POLICY document_approvals_update ON document_approvals
    FOR UPDATE TO authenticated
    USING (assignee_id = auth.uid() AND status = 'pending')
    WITH CHECK (assignee_id = auth.uid())
  `

  // signatures: users see and manage only their own
  await sql`
    CREATE POLICY signatures_select ON signatures FOR SELECT TO authenticated
    USING (user_id = auth.uid())
  `
  await sql`
    CREATE POLICY signatures_insert ON signatures FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid())
  `
  await sql`
    CREATE POLICY signatures_update ON signatures FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid())
  `
  await sql`
    CREATE POLICY signatures_delete ON signatures FOR DELETE TO authenticated
    USING (user_id = auth.uid())
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
