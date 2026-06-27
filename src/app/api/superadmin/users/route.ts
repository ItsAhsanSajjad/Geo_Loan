import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/session'
import { db } from '@/lib/db'
import { writeAudit } from '@/lib/audit'

// GET /api/superadmin/users — full directory of users + admins.
// Passwords are bcrypt hashes and are intentionally NEVER returned (one-way; cannot be shown).
export async function GET() {
  const sa = await requireSuperAdmin()
  if (sa instanceof NextResponse) return sa

  const users = await db.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      phone: true,
      fullName: true,
      cnic: true,
      email: true,
      role: true,
      kycStatus: true,
      walletBalance: true,
      currentLoanId: true,
      mustChangePassword: true,
      createdAt: true,
      _count: { select: { loans: true, payments: true, withdrawals: true } },
    },
  })

  await writeAudit({ actor: sa, action: 'VIEW_USERS', detail: `${users.length} records` })
  return NextResponse.json({ users })
}
