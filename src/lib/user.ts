import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { users, roles, offices } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import type { Role } from '@/lib/rbac/permissions'

export type UserProfile = {
  id: string
  email: string
  fullName: string
  role: Role
  officeId: string | null
}

export const getCurrentUserProfile = cache(async (): Promise<UserProfile | null> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const row = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      role: roles.name,
      officeId: users.officeId,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.id, user.id))
    .limit(1)
    .then((r) => r[0] ?? null)

  if (!row) return null
  return row as UserProfile
})
