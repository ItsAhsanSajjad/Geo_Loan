import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { isSuperAdminConfigured, ensureSuperAdminUser } from '@/lib/superadmin'

const DEFAULT_ADMIN_PHONE = '03000000000'
// Initial admin password — change immediately after first login (or override via env).
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_INITIAL_PASSWORD || 'admin123'

// One-time seed: admin account + default settings + loan packages
// Safe to call repeatedly (uses upsert / idempotent updates).
let seeded = false
export async function seedDefaults() {
  if (seeded) return // run once per process — avoid redundant DB writes on every login/register
  // Settings. adminPassword column is no longer used for auth — kept blank so no
  // plaintext credential is ever stored in this table.
  await db.setting.upsert({
    where: { id: 'default' },
    update: { adminPassword: '' },
    create: {
      id: 'default',
      bankName: 'HBL - Habib Bank Ltd',
      accountTitle: 'GEO Loan (Pvt) Ltd',
      accountNumber: '1234-5678-9012-3456',
      mobileAccount: '0300-1234567',
      markupPercent: 5,
      downPaymentPercent: 12,
      loanPackages: '[8000,14000,18500,24000]',
      adminPhone: DEFAULT_ADMIN_PHONE,
      adminPassword: '',
    },
  })

  // Admin account (phone-based) — password is always stored as a bcrypt hash.
  const existingAdmin = await db.user.findUnique({ where: { phone: DEFAULT_ADMIN_PHONE } })
  if (!existingAdmin) {
    await db.user.create({
      data: {
        phone: DEFAULT_ADMIN_PHONE,
        password: await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10),
        fullName: 'GEO Loan Admin',
        role: 'ADMIN',
        kycStatus: 'APPROVED',
      },
    })
  } else if (!existingAdmin.password.startsWith('$2')) {
    // Migrate a legacy plaintext admin password to a bcrypt hash in place.
    await db.user.update({
      where: { id: existingAdmin.id },
      data: { password: await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10) },
    })
  }

  // Optional super admin — provisioned ONLY when its env vars are set.
  // Credentials never live in source or in this seed; they come from the environment.
  if (isSuperAdminConfigured()) {
    await ensureSuperAdminUser()
  }

  seeded = true
}
