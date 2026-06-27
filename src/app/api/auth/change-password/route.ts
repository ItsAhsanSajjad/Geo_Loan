import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { requireUser } from '@/lib/session'
import { db } from '@/lib/db'

// POST /api/auth/change-password  Body: { currentPassword?, newPassword }
// Changes the logged-in user's own password and clears any forced-change flag.
export async function POST(req: NextRequest) {
  const user = await requireUser()
  if (user instanceof NextResponse) return user

  const { currentPassword, newPassword } = await req.json().catch(() => ({}))
  if (!newPassword || String(newPassword).length < 6) {
    return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 })
  }

  const u = await db.user.findUnique({ where: { id: user.id } })
  if (!u) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // When a forced change is pending the user just authenticated with the temporary
  // password, so we don't ask for it again. Otherwise verify the current password.
  if (!u.mustChangePassword) {
    const ok = await bcrypt.compare(String(currentPassword || ''), u.password)
    if (!ok) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
  }

  await db.user.update({
    where: { id: u.id },
    data: { password: await bcrypt.hash(String(newPassword), 10), mustChangePassword: false },
  })
  return NextResponse.json({ ok: true })
}
