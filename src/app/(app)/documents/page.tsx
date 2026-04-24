import Link from 'next/link'
import { redirect } from 'next/navigation'
import { isNull, desc, eq } from 'drizzle-orm'
import { getCurrentUserProfile } from '@/lib/user'
import { db } from '@/lib/db'
import { documents, documentTemplates } from '@/lib/db/schema'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Documents — DocuTrail' }

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  draft: 'secondary',
  in_review: 'default',
  approved: 'outline',
  rejected: 'destructive',
  archived: 'outline',
}

export default async function DocumentsPage() {
  const profile = await getCurrentUserProfile()
  if (!profile) redirect('/login')

  const docs = await db
    .select({
      id: documents.id,
      title: documents.title,
      currentStatus: documents.currentStatus,
      createdAt: documents.createdAt,
      templateName: documentTemplates.name,
    })
    .from(documents)
    .leftJoin(documentTemplates, eq(documents.templateId, documentTemplates.id))
    .where(isNull(documents.deletedAt))
    .orderBy(desc(documents.createdAt))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Documents</h1>
        <Link
          href="/documents/new"
          className={cn(buttonVariants({ size: 'sm' }), 'gap-1')}
        >
          <Plus size={14} />
          New Document
        </Link>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {docs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  No documents yet.{' '}
                  <Link href="/documents/new" className="underline underline-offset-2">
                    Create your first one.
                  </Link>
                </TableCell>
              </TableRow>
            ) : (
              docs.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium">{doc.title}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {doc.templateName ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[doc.currentStatus] ?? 'outline'}>
                      {doc.currentStatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
