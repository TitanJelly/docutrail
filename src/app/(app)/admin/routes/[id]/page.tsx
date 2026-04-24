import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { eq, asc, isNull } from 'drizzle-orm'
import { getCurrentUserProfile } from '@/lib/user'
import { db } from '@/lib/db'
import { approvalRoutes, approvalSteps, roles, offices, documentTemplates } from '@/lib/db/schema'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowLeft } from 'lucide-react'
import AddStepDialog from './_components/AddStepDialog'
import DeleteStepButton from './_components/DeleteStepButton'

export const metadata = { title: 'Route Detail — DocuTrail' }

export default async function RouteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentUserProfile()
  if (!profile || profile.role !== 'it_admin') redirect('/dashboard')

  const { id } = await params

  const [route] = await db
    .select()
    .from(approvalRoutes)
    .where(eq(approvalRoutes.id, id))

  if (!route || route.deletedAt) notFound()

  const steps = await db
    .select({
      id: approvalSteps.id,
      orderIndex: approvalSteps.orderIndex,
      officeScope: approvalSteps.officeScope,
      deadlineHours: approvalSteps.deadlineHours,
      parallelGroup: approvalSteps.parallelGroup,
      roleName: roles.name,
      roleDescription: roles.description,
      officeName: offices.name,
    })
    .from(approvalSteps)
    .leftJoin(roles, eq(approvalSteps.approverRoleId, roles.id))
    .leftJoin(offices, eq(approvalSteps.officeId, offices.id))
    .where(eq(approvalSteps.routeId, id))
    .orderBy(asc(approvalSteps.orderIndex))

  const allRoles = await db.select({ id: roles.id, name: roles.name, rank: roles.rank }).from(roles).orderBy(roles.rank)
  const allOffices = await db.select({ id: offices.id, name: offices.name }).from(offices)

  // Templates using this route
  const linkedTemplates = await db
    .select({ id: documentTemplates.id, name: documentTemplates.name })
    .from(documentTemplates)
    .where(eq(documentTemplates.defaultRouteId, id))

  const nextOrderIndex = steps.length > 0 ? Math.max(...steps.map((s) => s.orderIndex)) + 1 : 1

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/routes">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft size={14} />
            Routes
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">{route.name}</h1>
          <Badge variant={route.kind === 'escalation' ? 'destructive' : 'outline'} className="mt-0.5">
            {route.kind}
          </Badge>
        </div>
      </div>

      {/* Steps */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium">Approval Steps</h2>
          <AddStepDialog
            routeId={id}
            nextOrderIndex={nextOrderIndex}
            roles={allRoles}
            offices={allOffices}
          />
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Office scope</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {steps.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No steps yet. Add the first step above.
                  </TableCell>
                </TableRow>
              ) : (
                steps.map((step) => (
                  <TableRow key={step.id}>
                    <TableCell className="font-mono text-sm">{step.orderIndex}</TableCell>
                    <TableCell>
                      <span className="font-medium capitalize">{step.roleName?.replace('_', ' ')}</span>
                      {step.parallelGroup !== null && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          parallel {step.parallelGroup}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {step.officeScope === 'specific_office'
                        ? step.officeName ?? 'any'
                        : step.officeScope === 'creator_office'
                        ? "creator's office"
                        : 'any'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {step.deadlineHours}h
                    </TableCell>
                    <TableCell>
                      <DeleteStepButton id={step.id} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Linked templates */}
      <section className="space-y-2">
        <h2 className="text-base font-medium">Templates using this route</h2>
        {linkedTemplates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No templates assigned. Go to{' '}
            <Link href="/admin/templates" className="underline underline-offset-2">
              Templates
            </Link>{' '}
            to assign this route.
          </p>
        ) : (
          <ul className="space-y-1">
            {linkedTemplates.map((t) => (
              <li key={t.id} className="text-sm">
                {t.name}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
