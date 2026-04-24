import { redirect } from 'next/navigation'
import Link from 'next/link'
import { isNull } from 'drizzle-orm'
import { getCurrentUserProfile } from '@/lib/user'
import { db } from '@/lib/db'
import { approvalRoutes } from '@/lib/db/schema'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ChevronRight } from 'lucide-react'
import CreateRouteDialog from './_components/CreateRouteDialog'

export const metadata = { title: 'Approval Routes — DocuTrail' }

export default async function AdminRoutesPage() {
  const profile = await getCurrentUserProfile()
  if (!profile || profile.role !== 'it_admin') redirect('/dashboard')

  const routes = await db
    .select()
    .from(approvalRoutes)
    .where(isNull(approvalRoutes.deletedAt))
    .orderBy(approvalRoutes.name)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Approval Routes</h1>
        <CreateRouteDialog />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {routes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  No routes yet. Create one to start building approval chains.
                </TableCell>
              </TableRow>
            ) : (
              routes.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>
                    <Badge variant={r.kind === 'escalation' ? 'destructive' : 'outline'}>
                      {r.kind}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/admin/routes/${r.id}`}
                      className="flex items-center justify-center text-muted-foreground hover:text-foreground"
                    >
                      <ChevronRight size={16} />
                    </Link>
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
