import {
  pgEnum,
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  jsonb,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core'

// ─── Enums ───────────────────────────────────────────────────────────────────

export const roleName = pgEnum('role_name', [
  'it_admin',
  'dean',
  'exec_director',
  'dept_chair',
  'coordinator',
  'faculty',
  'office_staff',
  'student',
])

export const documentStatus = pgEnum('document_status', [
  'draft',
  'in_review',
  'approved',
  'returned',
  'archived',
])

export const approvalStatus = pgEnum('approval_status', [
  'pending',
  'approved',
  'rejected',
])

export const signatureType = pgEnum('signature_type', [
  'drawn',
  'typed',
  'image',
])

export const notificationKind = pgEnum('notification_kind', [
  'approval_request',
  'escalation_l1',
  'escalation_l2',
  'escalation_l3',
  'comment',
  'status_change',
])

export const routeKind = pgEnum('route_kind', ['standard', 'escalation'])

export const escalationLevel = pgEnum('escalation_level', ['L1', 'L2', 'L3'])

export const officeScopeEnum = pgEnum('office_scope', [
  'creator_office',
  'specific_office',
  'any',
])

// ─── Phase 1 tables ──────────────────────────────────────────────────────────

export const roles = pgTable('roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: roleName('name').notNull().unique(),
  description: text('description'),
  rank: integer('rank').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const offices = pgTable('offices', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const users = pgTable('users', {
  id: uuid('id').primaryKey(), // = auth.users.id
  email: text('email').notNull().unique(),
  fullName: text('full_name').notNull(),
  roleId: uuid('role_id')
    .references(() => roles.id)
    .notNull(),
  officeId: uuid('office_id').references(() => offices.id),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export const rolePermissions = pgTable(
  'role_permissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roleId: uuid('role_id')
      .references(() => roles.id)
      .notNull(),
    action: text('action').notNull(),
    resource: text('resource').notNull().default('*'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    roleActionUnique: unique().on(t.roleId, t.action),
  }),
)

// ─── Phase 3 route tables (before Phase 2 so templates can FK here) ──────────

export const approvalRoutes = pgTable('approval_routes', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  kind: routeKind('kind').default('standard').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export const approvalSteps = pgTable('approval_steps', {
  id: uuid('id').primaryKey().defaultRandom(),
  routeId: uuid('route_id')
    .references(() => approvalRoutes.id, { onDelete: 'cascade' })
    .notNull(),
  orderIndex: integer('order_index').notNull(),
  approverRoleId: uuid('approver_role_id')
    .references(() => roles.id)
    .notNull(),
  officeScope: officeScopeEnum('office_scope').default('any').notNull(),
  officeId: uuid('office_id').references(() => offices.id),
  deadlineHours: integer('deadline_hours').default(48).notNull(),
  parallelGroup: integer('parallel_group'),
})

// ─── Phase 2 tables ──────────────────────────────────────────────────────────

export const documentTemplates = pgTable('document_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  bodySchema: jsonb('body_schema'),       // Tiptap JSON template
  headerHtml: text('header_html'),
  footerHtml: text('footer_html'),
  defaultRouteId: uuid('default_route_id').references(() => approvalRoutes.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  templateId: uuid('template_id')
    .references(() => documentTemplates.id)
    .notNull(),
  creatorId: uuid('creator_id')
    .references(() => users.id)
    .notNull(),
  currentStatus: documentStatus('current_status').default('draft').notNull(),
  currentStepId: uuid('current_step_id').references(() => approvalSteps.id),
  routeId: uuid('route_id').references(() => approvalRoutes.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export const documentVersions = pgTable(
  'document_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .references(() => documents.id)
      .notNull(),
    versionNo: integer('version_no').notNull(),
    content: jsonb('content'),            // Tiptap JSON
    generatedPdfPath: text('generated_pdf_path'),
    createdBy: uuid('created_by')
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    docVersionUnique: unique().on(t.documentId, t.versionNo),
  }),
)

// ─── Phase 4: signatures ─────────────────────────────────────────────────────

export const signatures = pgTable('signatures', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  type: signatureType('type').notNull(),
  dataPath: text('data_path').notNull(), // Supabase Storage path: {userId}/{id}.png
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Phase 3 approval table ───────────────────────────────────────────────────

export const documentApprovals = pgTable('document_approvals', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id')
    .references(() => documents.id, { onDelete: 'cascade' })
    .notNull(),
  stepId: uuid('step_id')
    .references(() => approvalSteps.id)
    .notNull(),
  assigneeId: uuid('assignee_id')
    .references(() => users.id)
    .notNull(),
  status: approvalStatus('status').default('pending').notNull(),
  actedAt: timestamp('acted_at', { withTimezone: true }),
  signatureId: uuid('signature_id').references(() => signatures.id, { onDelete: 'set null' }),
  comment: text('comment'),
  // L9: track highest escalation level reached (circuit-breaker)
  escalatedLevel: escalationLevel('escalated_level'),
  // L10: record which document snapshot was actually approved
  approvedVersionId: uuid('approved_version_id').references(() => documentVersions.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Phase 5 tables ──────────────────────────────────────────────────────────

// Configurable SLA thresholds per route (or global when route_id IS NULL)
export const escalationRules = pgTable('escalation_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  routeId: uuid('route_id').references(() => approvalRoutes.id), // null = global default
  level: escalationLevel('level').notNull(),
  hoursOverdue: integer('hours_overdue').notNull(),
  notifyRoleId: uuid('notify_role_id').references(() => roles.id).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// Persisted in-app notifications (source of truth; Realtime is delivery only)
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    documentId: uuid('document_id').references(() => documents.id, { onDelete: 'cascade' }),
    documentApprovalId: uuid('document_approval_id').references(() => documentApprovals.id, {
      onDelete: 'cascade',
    }),
    kind: notificationKind('kind').notNull(),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    // Unique per (approval, level, user) — prevents duplicate escalation spam (L6)
    approvalKindUserUnique: unique().on(t.documentApprovalId, t.kind, t.userId),
  }),
)

// ─── Phase 6 tables ──────────────────────────────────────────────────────────

// Document-scoped chat — group (recipient_id IS NULL) or private DM
export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id')
    .references(() => documents.id, { onDelete: 'cascade' })
    .notNull(),
  senderId: uuid('sender_id')
    .references(() => users.id)
    .notNull(),
  recipientId: uuid('recipient_id').references(() => users.id), // null = visible to all doc participants
  body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// Append-only audit log — INSERT only; UPDATE/DELETE blocked via RLS
export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorId: uuid('actor_id'),                    // null for system/trigger-generated entries
  action: text('action').notNull(),             // INSERT | UPDATE | DELETE
  resourceType: text('resource_type').notNull(), // table name
  resourceId: uuid('resource_id'),
  before: jsonb('before'),
  after: jsonb('after'),
  ip: text('ip'),
  userAgent: text('user_agent'),
  prevHash: text('prev_hash'),                  // hash of previous row for this resource
  rowHash: text('row_hash').notNull(),          // md5 of this row's content + prev_hash
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
