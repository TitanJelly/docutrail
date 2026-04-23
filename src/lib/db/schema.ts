import {
  pgEnum,
  pgTable,
  uuid,
  text,
  boolean,
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
  'rejected',
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

// ─── Phase 1 tables ──────────────────────────────────────────────────────────

export const roles = pgTable('roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: roleName('name').notNull().unique(),
  description: text('description'),
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
