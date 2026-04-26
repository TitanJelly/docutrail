// Supabase Edge Function — escalation-scanner
// Triggered hourly by pg_cron. Scans all pending approvals whose deadline has
// passed, determines the appropriate escalation level, and inserts notifications.
//
// Idempotency: the unique constraint on (document_approval_id, kind, user_id)
// in the notifications table prevents duplicate notifications (L6).
// Circuit-breaker: once escalated_level = 'L3', no further escalation (L2).
//
// Deploy: supabase functions deploy escalation-scanner

import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

type EscalationLevel = 'L1' | 'L2' | 'L3'
type NotificationKind = 'escalation_l1' | 'escalation_l2' | 'escalation_l3'

const LEVEL_TO_KIND: Record<EscalationLevel, NotificationKind> = {
  L1: 'escalation_l1',
  L2: 'escalation_l2',
  L3: 'escalation_l3',
}

const LEVEL_ORDER: EscalationLevel[] = ['L1', 'L2', 'L3']

// Returns true if `candidate` is a higher level than `current`
function isHigherLevel(candidate: EscalationLevel, current: EscalationLevel | null): boolean {
  if (!current) return true
  return LEVEL_ORDER.indexOf(candidate) > LEVEL_ORDER.indexOf(current)
}

Deno.serve(async (_req) => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  // ── 1. Get all pending approvals with exceeded deadlines ───────────────────
  const { data: overdue, error: overdueErr } = await supabase.rpc('get_overdue_approvals')
  if (overdueErr) {
    console.error('get_overdue_approvals failed:', overdueErr.message)
    return new Response(JSON.stringify({ error: overdueErr.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!overdue || overdue.length === 0) {
    return new Response(JSON.stringify({ ok: true, processed: 0, notifications: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ── 2. Load escalation rules (route-specific or global fallback) ───────────
  const { data: rules } = await supabase.from('escalation_rules').select('*')
  const escalationRules = rules ?? []

  // Cache role lookups to avoid repeated queries
  const roleUserCache: Record<string, string[]> = {}

  async function getUsersForRole(roleId: string): Promise<string[]> {
    if (roleUserCache[roleId]) return roleUserCache[roleId]
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('role_id', roleId)
      .eq('is_active', true)
      .is('deleted_at', null)
    const ids = (data ?? []).map((u: { id: string }) => u.id)
    roleUserCache[roleId] = ids
    return ids
  }

  async function getRoleIdByName(name: string): Promise<string | null> {
    const { data } = await supabase.from('roles').select('id').eq('name', name).single()
    return data?.id ?? null
  }

  let processed = 0
  let notificationCount = 0

  for (const row of overdue) {
    const hoursOverdue = Number(row.hours_overdue)
    const currentLevel = row.escalated_level as EscalationLevel | null

    // Circuit-breaker (L2): already at L3 — nothing more to do
    if (currentLevel === 'L3') continue

    // Determine the highest level this approval qualifies for
    // Default thresholds (hours overdue): L1=24, L2=48, L3=72
    const defaultThresholds: Record<EscalationLevel, number> = { L1: 24, L2: 48, L3: 72 }

    // Find the highest level that applies to this approval's hours_overdue,
    // preferring route-specific rules over global ones
    let targetLevel: EscalationLevel | null = null

    for (const level of [...LEVEL_ORDER].reverse()) {
      if (currentLevel && !isHigherLevel(level, currentLevel)) continue

      const routeRule = escalationRules.find(
        (r: { level: string; route_id: string | null; hours_overdue: number }) =>
          r.level === level && r.route_id === row.route_id,
      )
      const globalRule = escalationRules.find(
        (r: { level: string; route_id: string | null; hours_overdue: number }) =>
          r.level === level && r.route_id === null,
      )
      const threshold =
        routeRule?.hours_overdue ?? globalRule?.hours_overdue ?? defaultThresholds[level]

      if (hoursOverdue >= threshold) {
        targetLevel = level
        break
      }
    }

    if (!targetLevel) continue

    // ── 3. Determine who to notify ───────────────────────────────────────────
    let notifyUserIds: string[] = []

    if (targetLevel === 'L1') {
      // Remind the assignee themselves
      notifyUserIds = [row.assignee_id]
    } else {
      const routeRule = escalationRules.find(
        (r: { level: string; route_id: string | null; notify_role_id: string }) =>
          r.level === targetLevel && r.route_id === row.route_id,
      )
      const globalRule = escalationRules.find(
        (r: { level: string; route_id: string | null; notify_role_id: string }) =>
          r.level === targetLevel && r.route_id === null,
      )
      const notifyRoleId = routeRule?.notify_role_id ?? globalRule?.notify_role_id ?? null

      if (notifyRoleId) {
        notifyUserIds = await getUsersForRole(notifyRoleId)
      } else {
        // Hardcoded fallback: L2 → dept_chair, L3 → dean
        const fallbackRoleName = targetLevel === 'L2' ? 'dept_chair' : 'dean'
        const fallbackRoleId = await getRoleIdByName(fallbackRoleName)
        if (fallbackRoleId) notifyUserIds = await getUsersForRole(fallbackRoleId)
      }
    }

    if (notifyUserIds.length === 0) continue

    // ── 4. Insert notifications — unique constraint prevents duplicates (L6) ──
    const kind = LEVEL_TO_KIND[targetLevel]

    for (const userId of notifyUserIds) {
      const { error: insertErr } = await supabase.from('notifications').upsert(
        {
          user_id: userId,
          document_id: row.document_id,
          document_approval_id: row.approval_id,
          kind,
        },
        {
          onConflict: 'document_approval_id,kind,user_id',
          ignoreDuplicates: true,
        },
      )

      if (!insertErr) notificationCount++
    }

    // ── 5. Update escalated_level to the highest level processed ─────────────
    await supabase
      .from('document_approvals')
      .update({ escalated_level: targetLevel })
      .eq('id', row.approval_id)

    processed++
  }

  console.log(`Escalation scan complete. Processed: ${processed}, Notifications: ${notificationCount}`)

  return new Response(
    JSON.stringify({ ok: true, processed, notifications: notificationCount }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
