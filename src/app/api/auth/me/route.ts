import { NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/session'
import { db } from '@/lib/db'

// GET /api/auth/me -> current logged-in user
export async function GET() {
  const session = await getSessionFromRequest()
  if (!session) {
    return NextResponse.json({ user: null })
  }
  const user = await db.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      phone: true,
      role: true,
      fullName: true,
      cnic: true,
      email: true,
      dob: true,
      address: true,
      kycStatus: true,
      kycNote: true,
      kycSubmittedAt: true,
      walletBalance: true,
      withdrawUnlocked: true,
      currentLoanId: true,
      mustChangePassword: true,
    },
  })
  // returning-customer signal for the loyalty (lower interest) rate
  const repaidLoans = user ? await db.loan.count({ where: { userId: user.id, status: 'REPAID' } }) : 0
  // Impersonation banner: when a super admin is acting as this account.
  const impersonatedBy = session.impersonatedBy || null
  return NextResponse.json({
    user: user ? { ...user, repaidLoans } : null,
    impersonating: !!impersonatedBy,
  })
}
