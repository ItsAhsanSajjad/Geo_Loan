import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/session'
import { db } from '@/lib/db'
import { invalidateMaintenanceCache } from '@/lib/maintenance'
import { writeAudit, getClientIp } from '@/lib/audit'

// GET — current maintenance state.
export async function GET() {
  const sa = await requireSuperAdmin()
  if (sa instanceof NextResponse) return sa
  const s = await db.setting.findUnique({
    where: { id: 'default' },
    select: { maintenanceMode: true, maintenanceMessage: true },
  })
  return NextResponse.json({ mode: !!s?.maintenanceMode, message: s?.maintenanceMessage || '' })
}

// POST  Body: { enabled: boolean, message?: string }
// Turns the whole app off for everyone except SUPER_ADMIN (the kill switch).
export async function POST(req: NextRequest) {
  const sa = await requireSuperAdmin()
  if (sa instanceof NextResponse) return sa
  const { enabled, message } = await req.json().catch(() => ({}))
  await db.setting.update({
    where: { id: 'default' },
    data: {
      maintenanceMode: !!enabled,
      maintenanceMessage: typeof message === 'string' ? message.slice(0, 300) : undefined,
    },
  })
  invalidateMaintenanceCache()
  await writeAudit({
    actor: sa,
    action: 'TOGGLE_MAINTENANCE',
    detail: `enabled=${!!enabled}`,
    ip: getClientIp(req),
  })
  return NextResponse.json({ ok: true })
}
