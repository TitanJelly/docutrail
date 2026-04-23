import postgres from 'postgres'

type Check = { name: string; ok: boolean; detail: string }

async function checkSupabaseApi(): Promise<Check> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anon) {
    return { name: 'Supabase REST API', ok: false, detail: 'URL or anon key missing' }
  }
  try {
    const resp = await fetch(`${supabaseUrl}/auth/v1/settings`, { headers: { apikey: anon } })
    if (!resp.ok) {
      return { name: 'Supabase REST API', ok: false, detail: `HTTP ${resp.status}` }
    }
    return { name: 'Supabase REST API', ok: true, detail: `reachable (${resp.status})` }
  } catch (err) {
    return {
      name: 'Supabase REST API',
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    }
  }
}

async function checkPostgres(): Promise<Check> {
  const url = process.env.DATABASE_URL
  if (!url) return { name: 'Postgres (pooler)', ok: false, detail: 'DATABASE_URL missing' }

  const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 10 })
  try {
    const [row] = await sql<{ now: Date }[]>`select now() as now`
    return { name: 'Postgres (pooler)', ok: true, detail: `server time ${row.now.toISOString()}` }
  } catch (err) {
    return {
      name: 'Postgres (pooler)',
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    }
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {})
  }
}

async function main() {
  const checks = [await checkSupabaseApi(), await checkPostgres()]
  let failed = 0
  for (const c of checks) {
    const marker = c.ok ? '[ ok ]' : '[FAIL]'
    console.log(`${marker} ${c.name}: ${c.detail}`)
    if (!c.ok) failed++
  }
  if (failed > 0) {
    console.log(`\n${failed} of ${checks.length} checks failed.`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('[check-connection] unexpected error:', err instanceof Error ? err.message : err)
  process.exit(1)
})
