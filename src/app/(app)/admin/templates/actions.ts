'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { documentTemplates } from '@/lib/db/schema'
import { getCurrentUserProfile } from '@/lib/user'
import { eq } from 'drizzle-orm'

const CCS_HEADER_HTML = `<img src="/ccs-header.png" style="width:100%;display:block;" alt="CCS Header" />`
const CCS_FOOTER_HTML = `<img src="/ccs-footer.png" style="width:100%;display:block;" alt="CCS Footer" />`

const createSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  type: z.string().min(1, 'Document type is required'),
})

type ActionResult = { success: true } | { success: false; error: string }

export async function createTemplateAction(
  data: z.infer<typeof createSchema>,
): Promise<ActionResult> {
  const profile = await getCurrentUserProfile()
  if (!profile || profile.role !== 'it_admin') {
    return { success: false, error: 'Unauthorized' }
  }

  const parsed = createSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  await db.insert(documentTemplates).values({
    name: parsed.data.name,
    type: parsed.data.type,
    headerHtml: CCS_HEADER_HTML,
    footerHtml: CCS_FOOTER_HTML,
  })

  revalidatePath('/admin/templates')
  return { success: true }
}

export async function assignRouteAction(templateId: string, routeId: string | null): Promise<ActionResult> {
  const profile = await getCurrentUserProfile()
  if (!profile || profile.role !== 'it_admin') {
    return { success: false, error: 'Unauthorized' }
  }

  await db
    .update(documentTemplates)
    .set({ defaultRouteId: routeId ?? undefined, updatedAt: new Date() })
    .where(eq(documentTemplates.id, templateId))

  revalidatePath('/admin/templates')
  return { success: true }
}

export async function deleteTemplateAction(id: string): Promise<ActionResult> {
  const profile = await getCurrentUserProfile()
  if (!profile || profile.role !== 'it_admin') {
    return { success: false, error: 'Unauthorized' }
  }

  await db
    .update(documentTemplates)
    .set({ deletedAt: new Date() })
    .where(eq(documentTemplates.id, id))

  revalidatePath('/admin/templates')
  return { success: true }
}
