import { NextResponse } from 'next/server'
import { eq, and, isNull, desc } from 'drizzle-orm'
import { getCurrentUserProfile } from '@/lib/user'
import { db } from '@/lib/db'
import { documents, documentVersions, documentApprovals } from '@/lib/db/schema'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await getCurrentUserProfile()
  if (!profile) return new NextResponse('Unauthorized', { status: 401 })

  const { id } = await params

  const [doc] = await db
    .select({ creatorId: documents.creatorId })
    .from(documents)
    .where(and(eq(documents.id, id), isNull(documents.deletedAt)))

  if (!doc) return new NextResponse('Not found', { status: 404 })

  const isCreator = doc.creatorId === profile.id
  const hasReadAll = ['it_admin', 'dean', 'exec_director', 'dept_chair'].includes(profile.role)

  let hasAccess = isCreator || hasReadAll
  if (!hasAccess) {
    const [assigneeRow] = await db
      .select({ id: documentApprovals.id })
      .from(documentApprovals)
      .where(
        and(
          eq(documentApprovals.documentId, id),
          eq(documentApprovals.assigneeId, profile.id),
        ),
      )
      .limit(1)
    hasAccess = !!assigneeRow
  }

  if (!hasAccess) return new NextResponse('Forbidden', { status: 403 })

  const [version] = await db
    .select({ generatedPdfPath: documentVersions.generatedPdfPath })
    .from(documentVersions)
    .where(eq(documentVersions.documentId, id))
    .orderBy(desc(documentVersions.versionNo))
    .limit(1)

  if (!version?.generatedPdfPath) {
    return new NextResponse('No PDF available yet — submit the document first.', { status: 404 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(version.generatedPdfPath, 300) // 5-minute signed URL

  if (error || !data?.signedUrl) {
    return new NextResponse('Failed to generate download link', { status: 500 })
  }

  return NextResponse.redirect(data.signedUrl)
}
