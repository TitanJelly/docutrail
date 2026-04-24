import { redirect } from 'next/navigation'
import { isNull } from 'drizzle-orm'
import { getCurrentUserProfile } from '@/lib/user'
import { db } from '@/lib/db'
import { documentTemplates } from '@/lib/db/schema'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import CreateTemplateDialog from './_components/CreateTemplateDialog'
import DeleteTemplateButton from './_components/DeleteTemplateButton'

export const metadata = { title: 'Templates — DocuTrail' }

export default async function AdminTemplatesPage() {
  const profile = await getCurrentUserProfile()
  if (!profile || profile.role !== 'it_admin') redirect('/dashboard')

  const templates = await db
    .select()
    .from(documentTemplates)
    .where(isNull(documentTemplates.deletedAt))
    .orderBy(documentTemplates.name)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Document Templates</h1>
        <CreateTemplateDialog />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  No templates yet. Create the first one.
                </TableCell>
              </TableRow>
            ) : (
              templates.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{t.type}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(t.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <DeleteTemplateButton id={t.id} name={t.name} />
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
