'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { can, type Role, type Action } from '@/lib/rbac/permissions'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { LayoutDashboard, Users, FileText, LayoutTemplate, LogOut, CheckSquare, GitBranch, PenLine, Archive, BarChart2, ScrollText } from 'lucide-react'

type NavItem = {
  href: string
  label: string
  icon: React.ReactNode
  requires?: Action
}

const NAV: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard size={16} />,
  },
  {
    href: '/documents',
    label: 'Documents',
    icon: <FileText size={16} />,
  },
  {
    href: '/approvals',
    label: 'Approvals',
    icon: <CheckSquare size={16} />,
    requires: 'approve_document',
  },
  {
    href: '/documents?status=archived',
    label: 'Archive',
    icon: <Archive size={16} />,
  },
  {
    href: '/signatures',
    label: 'Signatures',
    icon: <PenLine size={16} />,
  },
  {
    href: '/analytics',
    label: 'Analytics',
    icon: <BarChart2 size={16} />,
    requires: 'read_all_documents',
  },
  {
    href: '/audit',
    label: 'Audit Log',
    icon: <ScrollText size={16} />,
    requires: 'view_audit_log',
  },
  {
    href: '/admin/users',
    label: 'Users',
    icon: <Users size={16} />,
    requires: 'manage_users',
  },
  {
    href: '/admin/templates',
    label: 'Templates',
    icon: <LayoutTemplate size={16} />,
    requires: 'manage_templates',
  },
  {
    href: '/admin/routes',
    label: 'Routes',
    icon: <GitBranch size={16} />,
    requires: 'manage_routes',
  },
]

interface SidebarProps {
  role: Role
  fullName: string
  email: string
}

export default function Sidebar({ role, fullName, email }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const visible = NAV.filter((item) => !item.requires || can(role, item.requires))

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r bg-background">
      <div className="border-b px-4 py-3">
        <p className="text-sm font-semibold">DocuTrail</p>
        <p className="text-xs text-muted-foreground">CCS</p>
      </div>

      <nav className="flex-1 space-y-0.5 p-2">
        {visible.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
              pathname.startsWith(item.href)
                ? 'bg-accent text-accent-foreground font-medium'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="space-y-1 border-t p-3">
        <p className="truncate text-sm font-medium">{fullName}</p>
        <p className="truncate text-xs text-muted-foreground">{email}</p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 w-full justify-start gap-2 text-muted-foreground"
          onClick={signOut}
        >
          <LogOut size={14} />
          Sign out
        </Button>
      </div>
    </aside>
  )
}
