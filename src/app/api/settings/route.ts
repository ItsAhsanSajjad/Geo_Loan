import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Always live — never cached by Next, LiteSpeed/CDN, or the browser, so admin
// changes (loan amounts, bank details) reflect on the user app immediately.
export const dynamic = 'force-dynamic'
export const revalidate = 0

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' }

// GET /api/settings — PUBLIC, non-sensitive app config the user app needs
// (loan packages, down-payment %, markup %, and the company payment details).
// Never exposes adminPhone / adminPassword / APK config.
export async function GET() {
  const s = await db.setting.findUnique({
    where: { id: 'default' },
    select: {
      loanPackages: true,
      downPaymentPercent: true,
      markupPercent: true,
      loyaltyDiscountPerLoan: true,
      minMarkupPercent: true,
      bankName: true,
      accountTitle: true,
      accountNumber: true,
      mobileAccount: true,
      maintenanceMode: true,
      maintenanceMessage: true,
    },
  })
  return NextResponse.json({ settings: s }, { headers: NO_CACHE })
}
