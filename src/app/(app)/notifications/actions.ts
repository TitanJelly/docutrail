'use server'

import { eq, desc, and, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { notifications } from '@/lib/db/schema'
import { getCurrentUserProfile } from '@/lib/user'

export type Notification = {
  id: string
  kind: string
  documentId: string | null
  documentApprovalId: string | null
  readAt: Date | null
  createdAt: Date
}

export async function getNotificationsAction(): Promise<Notification[]> {
  const profile = await getCurrentUserProfile()
  if (!profile) return []

  return db
    .select({
      id: notifications.id,
      kind: notifications.kind,
      documentId: notifications.documentId,
      documentApprovalId: notifications.documentApprovalId,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(eq(notifications.userId, profile.id))
    .orderBy(desc(notifications.createdAt))
    .limit(20)
}

export async function markNotificationReadAction(notificationId: string): Promise<void> {
  const profile = await getCurrentUserProfile()
  if (!profile) return

  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, profile.id),
      ),
    )
}

export async function markAllReadAction(): Promise<void> {
  const profile = await getCurrentUserProfile()
  if (!profile) return

  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.userId, profile.id),
        isNull(notifications.readAt),
      ),
    )
}
