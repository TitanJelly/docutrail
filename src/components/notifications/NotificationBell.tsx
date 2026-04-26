'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Bell, CheckCheck } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  type Notification,
  getNotificationsAction,
  markNotificationReadAction,
  markAllReadAction,
} from '@/app/(app)/notifications/actions'

const KIND_LABEL: Record<string, string> = {
  approval_request: 'New approval request',
  escalation_l1: 'Overdue reminder',
  escalation_l2: 'Escalation — supervisor notified',
  escalation_l3: 'Critical escalation',
  comment: 'New comment',
  status_change: 'Document status changed',
}

export function NotificationBell({ userId }: { userId: string }) {
  const router = useRouter()
  const [items, setItems] = useState<Notification[]>([])
  const [, startTransition] = useTransition()

  useEffect(() => {
    getNotificationsAction().then(setItems)

    const supabase = createClient()
    const channel = supabase
      .channel('user-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const n = payload.new as Notification
          setItems((prev) => [n, ...prev])
          toast.info(KIND_LABEL[n.kind] ?? n.kind)
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  const unread = items.filter((n) => !n.readAt).length

  function handleItemClick(n: Notification) {
    startTransition(async () => {
      if (!n.readAt) {
        await markNotificationReadAction(n.id)
        setItems((prev) =>
          prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date() } : x)),
        )
      }
      if (n.documentId) router.push(`/documents/${n.documentId}`)
    })
  }

  function handleMarkAllRead() {
    startTransition(async () => {
      await markAllReadAction()
      setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date() })))
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'relative')}
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <p className="text-sm font-semibold">Notifications</p>
          {unread > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <CheckCheck size={12} />
              Mark all read
            </button>
          )}
        </div>
        <DropdownMenuSeparator />

        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            No notifications
          </p>
        ) : (
          items.map((n) => (
            <DropdownMenuItem
              key={n.id}
              onClick={() => handleItemClick(n)}
              className={cn(
                'flex flex-col items-start gap-0.5 py-2',
                !n.readAt && 'bg-accent/40',
              )}
            >
              <span className="text-xs font-medium leading-tight">
                {KIND_LABEL[n.kind] ?? n.kind}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {new Date(n.createdAt).toLocaleString()}
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
