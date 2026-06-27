import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/session'

// GET /api/superadmin/me — verifies the caller holds a SUPER_ADMIN session.
export async function GET() {
  const sa = await requireSuperAdmin()
  if (sa instanceof NextResponse) return sa
  return NextResponse.json({ ok: true, phone: sa.phone })
}
