'use client'

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { createStepAction } from '../../actions'

interface Role { id: string; name: string; rank: number }
interface Office { id: string; name: string }

interface Props {
  routeId: string
  nextOrderIndex: number
  roles: Role[]
  offices: Office[]
}

const schema = z.object({
  approverRoleId: z.string().uuid('Select a role'),
  officeScope: z.enum(['creator_office', 'specific_office', 'any']),
  officeId: z.string().uuid().nullable().optional(),
  deadlineHours: z.number().int().min(1, 'Min 1 hour').max(8760, 'Max 8760 hours'),
})
type FormValues = z.infer<typeof schema>

export default function AddStepDialog({ routeId, nextOrderIndex, roles, offices }: Props) {
  const [open, setOpen] = useState(false)
  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { officeScope: 'any', deadlineHours: 48 },
  })

  const officeScope = watch('officeScope')

  async function onSubmit(values: FormValues) {
    const result = await createStepAction({
      routeId,
      orderIndex: nextOrderIndex,
      approverRoleId: values.approverRoleId,
      officeScope: values.officeScope,
      officeId: values.officeScope === 'specific_office' ? (values.officeId ?? null) : null,
      deadlineHours: values.deadlineHours,
      parallelGroup: null,
    })
    if (!result.success) {
      toast.error(result.error)
      return
    }
    toast.success(`Step ${nextOrderIndex} added`)
    reset()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" className="gap-1"><Plus size={14} />Add Step</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Step {nextOrderIndex}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Approver Role</Label>
            <Controller
              control={control}
              name="approverRoleId"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value ?? ''}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        <span className="capitalize">{r.name.replace('_', ' ')}</span>
                        <span className="ml-2 text-xs text-muted-foreground">rank {r.rank}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.approverRoleId && <p className="text-sm text-destructive">{errors.approverRoleId.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Office Scope</Label>
            <Controller
              control={control}
              name="officeScope"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="creator_office">Creator's office</SelectItem>
                    <SelectItem value="specific_office">Specific office</SelectItem>
                    <SelectItem value="any">Any (no office filter)</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {officeScope === 'specific_office' && (
            <div className="space-y-1.5">
              <Label>Target Office</Label>
              <Controller
                control={control}
                name="officeId"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value ?? ''}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select office" />
                    </SelectTrigger>
                    <SelectContent>
                      {offices.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="deadlineHours">Deadline (hours)</Label>
            <Input
              id="deadlineHours"
              type="number"
              min={1}
              max={8760}
              {...register('deadlineHours', { valueAsNumber: true })}
            />
            {errors.deadlineHours && <p className="text-sm text-destructive">{errors.deadlineHours.message}</p>}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Adding…' : 'Add Step'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
