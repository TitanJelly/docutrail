'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
} from 'recharts'

export type StatusCount = { status: string; count: number }
export type MonthlyCount = { month: string; count: number }
export type OfficeBottleneck = { office: string; avgHours: number; pending: number }

interface Props {
  statusCounts: StatusCount[]
  monthlyTrend: MonthlyCount[]
  bottleneck: OfficeBottleneck[]
}

const STATUS_COLOR: Record<string, string> = {
  draft: '#94a3b8',
  in_review: '#f59e0b',
  approved: '#22c55e',
  returned: '#ef4444',
  archived: '#6366f1',
}

export function AnalyticsCharts({ statusCounts, monthlyTrend, bottleneck }: Props) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Document volume by status */}
      <div className="rounded-lg border p-4">
        <p className="mb-4 text-sm font-medium">Documents by Status</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={statusCounts} barCategoryGap="30%">
            <XAxis dataKey="status" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar
              dataKey="count"
              fill="#0f172a"
              radius={[4, 4, 0, 0]}
              // Per-bar colours via Cell — recharts passes index
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              label={false as any}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly submission trend */}
      <div className="rounded-lg border p-4">
        <p className="mb-4 text-sm font-medium">Monthly Submissions (last 6 mo.)</p>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={monthlyTrend}>
            <defs>
              <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#6366f1"
              strokeWidth={2}
              fill="url(#trendGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Bottleneck offices — pending count */}
      {bottleneck.length > 0 && (
        <div className="rounded-lg border p-4 lg:col-span-2">
          <p className="mb-4 text-sm font-medium">Pending Approvals by Office</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={bottleneck} layout="vertical" barCategoryGap="25%">
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="office" width={160} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v, name) => [v, name === 'pending' ? 'Pending' : 'Avg hours']} />
              <Bar dataKey="pending" fill="#f59e0b" radius={[0, 4, 4, 0]} name="pending" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

export { STATUS_COLOR }
