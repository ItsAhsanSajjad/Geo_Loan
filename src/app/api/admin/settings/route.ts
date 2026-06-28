import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/session'

// GET /api/admin/settings
export async function GET() {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin

  const s = await db.setting.findUnique({ where: { id: 'default' } })
  // Never expose the (now-unused) adminPassword column to the client.
  if (s) (s as Record<string, unknown>).adminPassword = ''
  return NextResponse.json({ settings: s })
}

// PUT /api/admin/settings
// Body: partial settings object. `adminPassword`, if present, updates the admin
// user's bcrypt-hashed password — it is NOT stored as plaintext in Settings.
// Uses POST (not PUT) — the shared host blocks PUT/DELETE methods.
export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin

  const body = await req.json()
  const allowed = [
    'bankName',
    'accountTitle',
    'accountNumber',
    'mobileAccount',
    'markupPercent',
    'downPaymentPercent',
    'loyaltyDiscountPerLoan',
    'minMarkupPercent',
    'loanPackages',
    'adminPhone',
  ]
  const data: Record<string, any> = {}
  for (const k of allowed) {
    if (k in body && body[k] !== undefined && body[k] !== null) {
      data[k] = body[k]
    }
  }
  if (data.loanPackages && typeof data.loanPackages !== 'string') {
    data.loanPackages = JSON.stringify(data.loanPackages)
  }

  // Admin Phone is the login identity — keep the admin User record in sync.
  if (data.adminPhone && String(data.adminPhone) !== admin.phone) {
    const clash = await db.user.findUnique({ where: { phone: String(data.adminPhone) } })
    if (clash && clash.id !== admin.id) {
      return NextResponse.json({ error: 'That phone number is already in use by another account' }, { status: 400 })
    }
    await db.user.update({ where: { id: admin.id }, data: { phone: String(data.adminPhone) } })
  }

  // Admin Password change: hash it onto the admin User record (never stored plaintext).
  const newPassword = body.adminPassword
  if (typeof newPassword === 'string' && newPassword.length > 0) {
    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'Admin password must be at least 8 characters' }, { status: 400 })
    }
    await db.user.update({
      where: { id: admin.id },
      data: { password: await bcrypt.hash(newPassword, 10) },
    })
  }

  const updated = await db.setting.upsert({
    where: { id: 'default' },
    update: data,
    create: { id: 'default', ...data, adminPassword: '' },
  })

  ;(updated as Record<string, unknown>).adminPassword = ''
  return NextResponse.json({ ok: true, settings: updated })
}
