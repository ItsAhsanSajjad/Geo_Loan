import { db } from '@/lib/db'

// Idempotent, additive schema guard. Runs once per server process (via
// instrumentation at boot) so a freshly-uploaded build self-migrates an existing
// SQLite DB without a shell. Checks before altering so re-deploys stay quiet.
// NEVER put destructive statements here.
let done = false

async function columnExists(table: string, column: string): Promise<boolean> {
  try {
    const rows = (await db.$queryRawUnsafe(`PRAGMA table_info("${table}")`)) as Array<{ name: string }>
    return Array.isArray(rows) && rows.some((r) => r.name === column)
  } catch {
    return true // on failure, assume present so we don't loop on a broken ALTER
  }
}

export async function ensureSchema(): Promise<void> {
  if (done) return
  try {
    if (!(await columnExists('User', 'mustChangePassword'))) {
      await db.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT 0`)
    }
    if (!(await columnExists('Setting', 'maintenanceMode'))) {
      await db.$executeRawUnsafe(`ALTER TABLE "Setting" ADD COLUMN "maintenanceMode" BOOLEAN NOT NULL DEFAULT 0`)
    }
    if (!(await columnExists('Setting', 'maintenanceMessage'))) {
      await db.$executeRawUnsafe(`ALTER TABLE "Setting" ADD COLUMN "maintenanceMessage" TEXT`)
    }
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "AuditLog" (
       "id" TEXT NOT NULL PRIMARY KEY,
       "actorId" TEXT,
       "actorPhone" TEXT,
       "role" TEXT,
       "action" TEXT NOT NULL,
       "target" TEXT,
       "detail" TEXT,
       "ip" TEXT,
       "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
     )`)
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt")`)
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action")`)
  } catch {
    // best-effort; never block startup
  }
  done = true
}
