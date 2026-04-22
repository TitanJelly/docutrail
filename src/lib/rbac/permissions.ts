export type Role =
  | 'it_admin'
  | 'dean'
  | 'exec_director'
  | 'dept_chair'
  | 'coordinator'
  | 'faculty'
  | 'office_staff'
  | 'student'

export type Action =
  | 'read_own_documents'
  | 'read_all_documents'
  | 'create_document'
  | 'approve_document'
  | 'manage_templates'
  | 'manage_routes'
  | 'manage_users'
  | 'view_audit_log'

export const permissions: Record<Role, Action[]> = {
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

export function can(role: Role, action: Action): boolean {
  return permissions[role]?.includes(action) ?? false
}
