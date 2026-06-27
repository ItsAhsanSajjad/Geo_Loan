import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSession, SESSION_COOKIE } from './auth'
import type { SessionUser } from './auth'
import { getMaintenance, MAINTENANCE_MESSAGE_FALLBACK } from './maintenance'

export async function requireUser(): Promise<SessionUser | NextResponse> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const user = await getSession(token)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Maintenance mode: only SUPER_ADMIN may act while the app is under maintenance.
  if (user.role !== 'SUPER_ADMIN') {
    const m = await getMaintenance()
    if (m.mode) {
      return NextResponse.json(
        { error: m.message || MAINTENANCE_MESSAGE_FALLBACK, maintenance: true },
        { status: 503 },
      )
    }
  }
  return user
}

// ADMIN or SUPER_ADMIN. Super admin inherits every admin privilege.
export async function requireAdmin(): Promise<SessionUser | NextResponse> {
  const user = await requireUser()
  if (user instanceof NextResponse) return user
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return user
}

// SUPER_ADMIN only — for the dedicated super-admin control routes.
export async function requireSuperAdmin(): Promise<SessionUser | NextResponse> {
  const user = await requireUser()
  if (user instanceof NextResponse) return user
  if (user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return user
}

export async function getSessionFromRequest(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  return await getSession(token)
}
