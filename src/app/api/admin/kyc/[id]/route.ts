import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/session'

// POST /api/admin/kyc/[id] -> delete a user account and ALL their data
// (KYC, loans, payments, withdrawals, notifications cascade). For removing
// test/spam KYC entries. Admin cannot delete their own account.
// Uses POST (not DELETE) — the shared host blocks PUT/DELETE methods.
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin

  const { id } = await ctx.params
  if (id === admin.id) {
    return NextResponse.json({ error: 'You cannot delete your own admin account' }, { status: 400 })
  }
  const user = await db.user.findUnique({ where: { id }, select: { role: true } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (user.role === 'ADMIN') {
    return NextResponse.json({ error: 'Cannot delete an admin account' }, { status: 400 })
  }

  await db.user.delete({ where: { id } }) // cascades loans/payments/withdrawals/kyc/notifications
  return NextResponse.json({ ok: true })
}
