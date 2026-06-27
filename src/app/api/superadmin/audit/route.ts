import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/session'
import { db } from '@/lib/db'

// GET /api/superadmin/audit — recent privileged-action log (who / what / when / IP).
export async function GET() {
  const sa = await requireSuperAdmin()
  if (sa instanceof NextResponse) return sa
  const logs = await db.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 200 })
  return NextResponse.json({ logs })
}
