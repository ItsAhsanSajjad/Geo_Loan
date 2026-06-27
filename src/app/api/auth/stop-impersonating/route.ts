import { NextRequest, NextResponse } from 'next/server'
import { createSession, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth'
import { getSessionFromRequest } from '@/lib/session'
import { db } from '@/lib/db'
import { writeAudit, getClientIp } from '@/lib/audit'

// POST /api/auth/stop-impersonating — return from an impersonated session to the super admin.
// Works even during maintenance (does not go through requireUser).
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest()
  if (!session || !session.impersonatedBy) {
    return NextResponse.json({ error: 'Not impersonating' }, { status: 400 })
  }

  // The impersonator must still be a valid super admin.
  const sa = await db.user.findUnique({ where: { id: session.impersonatedBy } })
  if (!sa || sa.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Original super admin no longer available' }, { status: 403 })
  }

  const token = await createSession(sa.id)
  const res = NextResponse.json({ ok: true, redirect: '/superadmin/dashboard' })
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions())

  await writeAudit({
    actor: { id: sa.id, phone: sa.phone, role: 'SUPER_ADMIN' },
    action: 'STOP_IMPERSONATION',
    target: `${session.phone} (${session.id})`,
    ip: getClientIp(req),
  })
  return res
}
