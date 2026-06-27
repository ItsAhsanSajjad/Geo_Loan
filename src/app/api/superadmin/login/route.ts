import { NextRequest, NextResponse } from 'next/server'
import { createSession, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth'
import { verifySuperAdminCredentials, ensureSuperAdminUser, isSuperAdminConfigured } from '@/lib/superadmin'
import { writeAudit, getClientIp } from '@/lib/audit'
import { normalizePhone } from '@/lib/validation'

// POST /api/superadmin/login  — separate from the normal user/admin login.
// Credentials are validated against environment variables only.
export async function POST(req: NextRequest) {
  if (!isSuperAdminConfigured()) {
    return NextResponse.json({ error: 'Super admin is not configured on this server' }, { status: 503 })
  }
  const body = await req.json().catch(() => ({}))
  const phone = normalizePhone(body.phone || '')
  const password = String(body.password || '')

  const ok = await verifySuperAdminCredentials(phone, password)
  if (!ok) {
    await writeAudit({ actor: null, action: 'SUPERADMIN_LOGIN_FAILED', detail: `phone=${phone}`, ip: getClientIp(req) })
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const user = await ensureSuperAdminUser()
  if (!user) return NextResponse.json({ error: 'Super admin account unavailable' }, { status: 500 })

  const token = await createSession(user.id)
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions())
  await writeAudit({
    actor: { id: user.id, phone: user.phone, role: 'SUPER_ADMIN' },
    action: 'SUPERADMIN_LOGIN',
    ip: getClientIp(req),
  })
  return res
}
