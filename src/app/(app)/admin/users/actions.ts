'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getCurrentUserProfile } from '@/lib/user'

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(1, 'Full name is required'),
  roleId: z.string().uuid(),
  officeId: z.string().uuid().nullable(),
})

type CreateUserInput = z.infer<typeof createSchema>
type ActionResult = { success: true } | { success: false; error: string }

export async function createUserAction(data: CreateUserInput): Promise<ActionResult> {
  const profile = await getCurrentUserProfile()
  if (!profile || profile.role !== 'it_admin') {
    return { success: false, error: 'Unauthorized' }
  }

  const parsed = createSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const admin = createAdminClient()
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
  })
  if (authError) return { success: false, error: authError.message }

  try {
    await db.insert(users).values({
      id: authUser.user.id,
      email: parsed.data.email,
      fullName: parsed.data.fullName,
      roleId: parsed.data.roleId,
      officeId: parsed.data.officeId,
    })
  } catch {
    // Rollback auth user so it doesn't become orphaned
    await admin.auth.admin.deleteUser(authUser.user.id)
    return { success: false, error: 'Failed to create user profile. Please try again.' }
  }

  revalidatePath('/admin/users')
  return { success: true }
}

export async function deactivateUserAction(userId: string): Promise<ActionResult> {
  const profile = await getCurrentUserProfile()
  if (!profile || profile.role !== 'it_admin') {
    return { success: false, error: 'Unauthorized' }
  }
  if (userId === profile.id) {
    return { success: false, error: 'You cannot deactivate your own account' }
  }

  await db.update(users).set({ isActive: false }).where(eq(users.id, userId))
  revalidatePath('/admin/users')
  return { success: true }
}

export async function reactivateUserAction(userId: string): Promise<ActionResult> {
  const profile = await getCurrentUserProfile()
  if (!profile || profile.role !== 'it_admin') {
    return { success: false, error: 'Unauthorized' }
  }

  await db.update(users).set({ isActive: true }).where(eq(users.id, userId))
  revalidatePath('/admin/users')
  return { success: true }
}
