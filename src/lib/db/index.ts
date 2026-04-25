import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is not set. Add it to .env.local.')
}

const globalForDb = globalThis as unknown as { _pgClient: postgres.Sql | undefined }

const client = globalForDb._pgClient ?? postgres(connectionString, { prepare: false, max: 5 })

if (process.env.NODE_ENV !== 'production') globalForDb._pgClient = client

export const db = drizzle(client, { schema })
