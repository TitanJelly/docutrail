/**
 * Creates the Supabase Storage buckets required for Phase 4.
 * Run once after db:push + setup:rls:
 *   npx tsx --env-file=.env.local scripts/setup-storage.ts
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

const BUCKETS = [
  { name: 'documents', public: false },
  { name: 'signatures', public: false },
]

async function main() {
  console.log('Setting up Supabase Storage buckets…')
  for (const bucket of BUCKETS) {
    const { error } = await supabase.storage.createBucket(bucket.name, {
      public: bucket.public,
    })
    if (error && !error.message.toLowerCase().includes('already exists')) {
      throw new Error(`Failed to create bucket '${bucket.name}': ${error.message}`)
    }
    console.log(`  Bucket '${bucket.name}': ready`)
  }
  console.log('Storage setup complete.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
