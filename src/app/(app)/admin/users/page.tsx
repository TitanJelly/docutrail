import { redirect } from 'next/navigation'
import { isNull } from 'drizzle-orm'
import { eq } from 'drizzle-orm'
import { getCurrentUserProfile } from '@/lib/user'
import { db } from '@/lib/db'
import { users, roles, offices } from '@/lib/db/schema'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import CreateUserDialog from './_components/CreateUserDialog'

export const metadata = { title: 'Users — DocuTrail' }

export default async function AdminUsersPage() {
  const profile = await getCurrentUserProfile()
  if (!profile || profile.role !== 'it_admin') redirect('/dashboard')

  const [allUsers, allRoles, allOffices] = await Promise.all([
    db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        roleName: roles.name,
        officeName: offices.name,
        isActive: users.isActive,
      })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .leftJoin(offices, eq(users.officeId, offices.id))
      .where(isNull(users.deletedAt))
      .orderBy(users.fullName),
    db.select({ id: roles.id, name: roles.name }).from(roles).orderBy(roles.name),
    db.select({ id: offices.id, name: offices.name }).from(offices).orderBy(offices.name),
  ])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Users</h1>
        <CreateUserDialog roles={allRoles} offices={allOffices} />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Office</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allUsers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-8 text-center text-muted-foreground"
                >
                  No users yet. Create the first one.
                </TableCell>
              </TableRow>
            ) : (
              allUsers.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.fullName}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{u.roleName}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {u.officeName ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.isActive ? 'default' : 'secondary'}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </Badge>
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
