// DocuTrail database schema (Drizzle ORM + Supabase Postgres).
// Tables get fleshed out in Phase 1; this file currently holds only shared enums
// so that route handlers and server actions can import stable names today.

import { pgEnum } from 'drizzle-orm/pg-core'

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
