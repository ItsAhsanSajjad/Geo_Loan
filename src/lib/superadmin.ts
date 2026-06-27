import bcrypt from 'bcryptjs'
import { timingSafeEqual } from 'crypto'
import { db } from '@/lib/db'
import { normalizePhone } from '@/lib/validation'

// Super-admin credentials live ONLY in environment variables — never in source or the DB
// in plaintext. Prefer SUPERADMIN_PASSWORD_HASH (a bcrypt hash). SUPERADMIN_PASSWORD
// (plaintext) is accepted as a convenience for local dev only.
export function getSuperAdminPhone(): string | null {
  const p = process.env.SUPERADMIN_PHONE
  return p ? normalizePhone(p) : null
}

export function isSuperAdminConfigured(): boolean {
  return !!getSuperAdminPhone() && !!(process.env.SUPERADMIN_PASSWORD_HASH || process.env.SUPERADMIN_PASSWORD)
}

function safeStrEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

// Verify a login attempt against the env credentials. Constant-time where possible.
export async function verifySuperAdminCredentials(phone: string, password: string): Promise<boolean> {
  const envPhone = getSuperAdminPhone()
  if (!envPhone) return false
  const phoneOk = safeStrEqual(normalizePhone(phone), envPhone)

  const hash = process.env.SUPERADMIN_PASSWORD_HASH
  let passOk = false
  if (hash) {
    passOk = await bcrypt.compare(String(password), hash)
  } else if (process.env.SUPERADMIN_PASSWORD) {
    passOk = safeStrEqual(String(password), process.env.SUPERADMIN_PASSWORD)
  }
  // Always evaluate both so timing doesn't leak which field was wrong.
  return phoneOk && passOk
}

// Returns the bcrypt hash to persist for the super-admin user row.
async function superAdminHash(): Promise<string> {
  if (process.env.SUPERADMIN_PASSWORD_HASH) return process.env.SUPERADMIN_PASSWORD_HASH
  if (process.env.SUPERADMIN_PASSWORD) return bcrypt.hash(process.env.SUPERADMIN_PASSWORD, 10)
  // Unusable placeholder — only reached if misconfigured.
  return '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva'
}

// Ensure a backing User row exists with role SUPER_ADMIN (role is read from the DB on
// every request, so the session must map to a real user). Idempotent.
export async function ensureSuperAdminUser() {
  const phone = getSuperAdminPhone()
  if (!phone) return null
  const existing = await db.user.findUnique({ where: { phone } })
  if (existing) {
    if (existing.role !== 'SUPER_ADMIN') {
      return db.user.update({ where: { id: existing.id }, data: { role: 'SUPER_ADMIN' } })
    }
    return existing
  }
  return db.user.create({
    data: {
      phone,
      password: await superAdminHash(),
      fullName: 'Super Admin',
      role: 'SUPER_ADMIN',
      kycStatus: 'APPROVED',
    },
  })
}
