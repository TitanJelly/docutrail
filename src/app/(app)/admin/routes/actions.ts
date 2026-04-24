'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { approvalRoutes, approvalSteps, documentTemplates, roles } from '@/lib/db/schema'
import { getCurrentUserProfile } from '@/lib/user'

type ActionResult = { success: true } | { success: false; error: string }

const createRouteSchema = z.object({
  name: z.string().min(1, 'Route name is required'),
  kind: z.enum(['standard', 'escalation']),
})

export async function createRouteAction(data: z.infer<typeof createRouteSchema>): Promise<ActionResult> {
  const profile = await getCurrentUserProfile()
  if (!profile || profile.role !== 'it_admin') return { success: false, error: 'Unauthorized' }

  const parsed = createRouteSchema.safeParse(data)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

  await db.insert(approvalRoutes).values({ name: parsed.data.name, kind: parsed.data.kind })
  revalidatePath('/admin/routes')
  return { success: true }
}

const createStepSchema = z.object({
  routeId: z.string().uuid(),
  orderIndex: z.number().int().min(1),
  approverRoleId: z.string().uuid('Select a role'),
  officeScope: z.enum(['creator_office', 'specific_office', 'any']),
  officeId: z.string().uuid().nullable(),
  deadlineHours: z.number().int().min(1).max(8760),
  parallelGroup: z.number().int().nullable(),
})

type CreateStepInput = z.infer<typeof createStepSchema>

export async function createStepAction(data: CreateStepInput): Promise<ActionResult> {
  const profile = await getCurrentUserProfile()
  if (!profile || profile.role !== 'it_admin') return { success: false, error: 'Unauthorized' }

  const parsed = createStepSchema.safeParse(data)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

  const { routeId, orderIndex, approverRoleId, officeScope, officeId, deadlineHours, parallelGroup } = parsed.data

  // Load route to check kind (escalation routes skip the rank enforcement)
  const [route] = await db.select().from(approvalRoutes).where(eq(approvalRoutes.id, routeId))
  if (!route) return { success: false, error: 'Route not found' }

  if (route.kind === 'standard') {
    // Skip-rule: new step rank must not jump more than +1 above the previous step's role rank
    // office_staff steps are lateral and exempt
    const [newRole] = await db.select({ rank: roles.rank, name: roles.name }).from(roles).where(eq(roles.id, approverRoleId))
    if (!newRole) return { success: false, error: 'Role not found' }

    if (newRole.name !== 'office_staff' && orderIndex > 1) {
      const prevSteps = await db
        .select({ approverRoleId: approvalSteps.approverRoleId })
        .from(approvalSteps)
        .where(and(eq(approvalSteps.routeId, routeId), eq(approvalSteps.orderIndex, orderIndex - 1)))

      if (prevSteps.length > 0) {
        const prevRoleIds = prevSteps.map((s) => s.approverRoleId)
        const prevRoles = await db
          .select({ rank: roles.rank, name: roles.name })
          .from(roles)
          .where(eq(roles.id, prevRoleIds[0]))

        const prevRole = prevRoles[0]
        if (prevRole && prevRole.name !== 'office_staff' && newRole.rank > prevRole.rank + 1) {
          return {
            success: false,
            error: `Skip-rule violation: ${newRole.name} (rank ${newRole.rank}) jumps more than +1 above ${prevRole.name} (rank ${prevRole.rank}). Use an escalation route for legitimate skips.`,
          }
        }
      }
    }
  }

  await db.insert(approvalSteps).values({
    routeId,
    orderIndex,
    approverRoleId,
    officeScope,
    officeId: officeId ?? undefined,
    deadlineHours,
    parallelGroup: parallelGroup ?? undefined,
  })

  revalidatePath(`/admin/routes/${routeId}`)
  return { success: true }
}

export async function deleteStepAction(stepId: string): Promise<ActionResult> {
  const profile = await getCurrentUserProfile()
  if (!profile || profile.role !== 'it_admin') return { success: false, error: 'Unauthorized' }

  const [step] = await db.select({ routeId: approvalSteps.routeId }).from(approvalSteps).where(eq(approvalSteps.id, stepId))
  if (!step) return { success: false, error: 'Step not found' }

  await db.delete(approvalSteps).where(eq(approvalSteps.id, stepId))
  revalidatePath(`/admin/routes/${step.routeId}`)
  return { success: true }
}

export async function assignRouteToTemplateAction(templateId: string, routeId: string | null): Promise<ActionResult> {
  const profile = await getCurrentUserProfile()
  if (!profile || profile.role !== 'it_admin') return { success: false, error: 'Unauthorized' }

  await db
    .update(documentTemplates)
    .set({ defaultRouteId: routeId ?? undefined, updatedAt: new Date() })
    .where(eq(documentTemplates.id, templateId))

  revalidatePath('/admin/templates')
  revalidatePath('/admin/routes')
  return { success: true }
}
