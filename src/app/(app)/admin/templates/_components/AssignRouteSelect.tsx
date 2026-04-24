'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { assignRouteAction } from '../actions'

interface Route { id: string; name: string }

interface Props {
  templateId: string
  currentRouteId: string | null
  routes: Route[]
}

export default function AssignRouteSelect({ templateId, currentRouteId, routes }: Props) {
  const [pending, startTransition] = useTransition()

  function handleChange(value: string | null) {
    if (value === null) return
    startTransition(async () => {
      const result = await assignRouteAction(templateId, value === '__none__' ? null : value)
      if (!result.success) toast.error(result.error)
      else toast.success('Route assigned')
    })
  }

  return (
    <Select
      value={currentRouteId ?? '__none__'}
      onValueChange={handleChange}
      disabled={pending}
    >
      <SelectTrigger className="h-7 w-44 text-xs">
        <SelectValue placeholder="No route" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">No route</SelectItem>
        {routes.map((r) => (
          <SelectItem key={r.id} value={r.id}>
            {r.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
