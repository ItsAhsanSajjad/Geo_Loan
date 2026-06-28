import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/session'

// POST /api/admin/kyc/history/[id] -> remove a single KYC case record (audit trail)
// Uses POST (not DELETE) — the shared host blocks PUT/DELETE methods.
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin
  const { id } = await ctx.params
  await db.kycSubmission.deleteMany({ where: { id } })
  return NextResponse.json({ ok: true })
}
