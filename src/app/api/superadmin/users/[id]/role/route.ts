import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/session'
import { db } from '@/lib/db'
import { writeAudit, getClientIp } from '@/lib/audit'

// POST /api/superadmin/users/[id]/role  Body: { role: 'USER' | 'ADMIN' }
// Promote/demote between USER and ADMIN. SUPER_ADMIN cannot be granted or revoked here —
// it is provisioned only from environment variables.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const sa = await requireSuperAdmin()
  if (sa instanceof NextResponse) return sa

  const { id } = await ctx.params
  const { role } = await req.json().catch(() => ({ role: '' }))
  if (role !== 'USER' && role !== 'ADMIN') {
    return NextResponse.json({ error: 'Role must be USER or ADMIN' }, { status: 400 })
  }

  const target = await db.user.findUnique({ where: { id } })
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (target.role === 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Cannot change a super admin role here' }, { status: 400 })
  }

  await db.user.update({ where: { id }, data: { role } })
  await writeAudit({
    actor: sa,
    action: 'SET_ROLE',
    target: `${target.phone} (${id})`,
    detail: `${target.role} -> ${role}`,
    ip: getClientIp(req),
  })
  return NextResponse.json({ ok: true })
}
