import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { requireSuperAdmin } from '@/lib/session'
import { db } from '@/lib/db'
import { writeAudit, getClientIp } from '@/lib/audit'

// A readable, hard-to-guess temporary password.
function makeTempPassword(): string {
  return 'Geo-' + randomBytes(9).toString('base64url')
}

// POST /api/superadmin/users/[id]/reset-password
// Generates a NEW temporary password (returned ONCE to the super admin to hand over) and
// forces the user to change it on next login. We never reveal the user's old password —
// it is a one-way bcrypt hash and cannot be recovered.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const sa = await requireSuperAdmin()
  if (sa instanceof NextResponse) return sa

  const { id } = await ctx.params
  const target = await db.user.findUnique({ where: { id } })
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (target.role === 'SUPER_ADMIN') {
    return NextResponse.json(
      { error: 'Super admin credentials are managed via environment variables' },
      { status: 400 },
    )
  }

  const temp = makeTempPassword()
  await db.user.update({
    where: { id },
    data: { password: await bcrypt.hash(temp, 10), mustChangePassword: true },
  })

  await writeAudit({
    actor: sa,
    action: 'RESET_PASSWORD',
    target: `${target.phone} (${id})`,
    detail: `role=${target.role}`,
    ip: getClientIp(req),
  })

  return NextResponse.json({ ok: true, tempPassword: temp })
}
