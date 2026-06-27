// One-off, NON-DESTRUCTIVE migration for the Super Admin release.
// Adds the new columns/table to an EXISTING production SQLite DB without touching data.
// Safe to run more than once (already-applied statements are skipped).
//
// Run on the server from the app's standalone folder (where @prisma/client resolves),
// with DATABASE_URL pointing at the live DB:
//   DATABASE_URL="file:/home/<cpaneluser>/path/db/custom.db" node migrate-superadmin.mjs
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const statements = [
  `ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT 0`,
  `ALTER TABLE "Setting" ADD COLUMN "maintenanceMode" BOOLEAN NOT NULL DEFAULT 0`,
  `ALTER TABLE "Setting" ADD COLUMN "maintenanceMessage" TEXT`,
  `CREATE TABLE IF NOT EXISTS "AuditLog" (
     "id" TEXT NOT NULL PRIMARY KEY,
     "actorId" TEXT,
     "actorPhone" TEXT,
     "role" TEXT,
     "action" TEXT NOT NULL,
     "target" TEXT,
     "detail" TEXT,
     "ip" TEXT,
     "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt")`,
  `CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action")`,
]

async function main() {
  for (const sql of statements) {
    const label = sql.replace(/\s+/g, ' ').slice(0, 60)
    try {
      await db.$executeRawUnsafe(sql)
      console.log('OK   ', label)
    } catch (e) {
      // duplicate column / already exists -> already applied, safe to ignore
      console.log('SKIP ', label, '::', String(e.message).split('\n')[0])
    }
  }
  console.log('\nMigration complete.')
}

main()
  .catch((e) => { console.error('FATAL', e); process.exit(1) })
  .finally(() => db.$disconnect())
