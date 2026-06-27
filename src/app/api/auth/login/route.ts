import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { createSession, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth'
import { seedDefaults } from '@/lib/seed'
import { normalizePhone } from '@/lib/validation'
import { getMaintenance, MAINTENANCE_MESSAGE_FALLBACK } from '@/lib/maintenance'

// POST /api/auth/login
// Body: { phone, password }
export async function POST(req: NextRequest) {
  await seedDefaults()
  const body = await req.json()
  const phone = normalizePhone(body.phone || '')
  const password = body.password
  if (!phone || !password) {
    return NextResponse.json({ error: 'Phone and password are required' }, { status: 400 })
  }

  const user = await db.user.findUnique({ where: { phone } })

  // Always run a bcrypt compare — even when the user is missing — so response
  // timing doesn't reveal whether a phone number is registered.
  const hash = user?.password ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva'
  const valid = await bcrypt.compare(String(password), hash)

  if (!user || !valid) {
    return NextResponse.json({ error: 'Invalid phone number or password' }, { status: 401 })
  }

  // While under maintenance, only SUPER_ADMIN may sign in.
  if (user.role !== 'SUPER_ADMIN') {
    const m = await getMaintenance()
    if (m.mode) {
      return NextResponse.json(
        { error: m.message || MAINTENANCE_MESSAGE_FALLBACK, maintenance: true },
        { status: 503 },
      )
    }
  }

  const token = await createSession(user.id)
  const res = NextResponse.json({
    user: {
      id: user.id,
      phone: user.phone,
      role: user.role,
      fullName: user.fullName,
      mustChangePassword: user.mustChangePassword,
    },
  })
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions())
  return res
}
