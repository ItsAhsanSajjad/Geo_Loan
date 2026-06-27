import { NextRequest, NextResponse } from 'next/server'
import { createSession, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth'
import { requireSuperAdmin } from '@/lib/session'
import { db } from '@/lib/db'
import { writeAudit, getClientIp } from '@/lib/audit'

// POST /api/superadmin/users/[id]/impersonate
// Opens the target account ("Login as") by issuing a session for that user, tagged with
// the super admin's id so they can return. No password is read or required.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const sa = await requireSuperAdmin()
  if (sa instanceof NextResponse) return sa

  const { id } = await ctx.params
  const target = await db.user.findUnique({ where: { id } })
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (target.role === 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Cannot impersonate a super admin' }, { status: 400 })
  }

  const token = await createSession(target.id, sa.id)
  const redirect = target.role === 'ADMIN' ? '/admin' : '/app'
  const res = NextResponse.json({ ok: true, role: target.role, redirect })
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions())

  await writeAudit({
    actor: sa,
    action: 'IMPERSONATE',
    target: `${target.phone} (${id})`,
    detail: `role=${target.role}`,
    ip: getClientIp(req),
  })
  return res
}
