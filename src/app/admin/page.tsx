'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import {
  Loader2, LogOut, LayoutDashboard, Users, FileCheck, Wallet,
  Settings as SettingsIcon, Bell, Search, ShieldCheck, ChevronRight,
  Check, X, Eye, EyeOff, Phone, Lock, ArrowLeft, RefreshCw, Banknote,
  Landmark, Coins, KeyRound, Menu, Video, Trash2, UploadCloud,
} from 'lucide-react'
import { BrandLogo, TAGLINE_UR, TAGLINE_EN } from '@/components/brand/logo'
import { normalizePhone, PHONE_LENGTH } from '@/lib/validation'

// ============ TYPES ============
interface AdminUser {
  id: string
  phone: string
  role: string
  fullName: string | null
}
interface Stats {
  totalUsers: number
  totalLoans: number
  pendingPayments: number
  approvedPayments: number
  rejectedPayments: number
  totalDisbursed: number
  totalReceived: number
}
interface PaymentRow {
  id: string
  type: string
  amount: number
  status: string
  screenshotPath: string
  createdAt: string
  adminNote: string | null
  reviewedAt: string | null
  user: { id: string; phone: string; fullName: string | null; cnic: string | null }
  loan: { id: string; amount: number } | null
}
interface UserRow {
  id: string
  phone: string
  fullName: string | null
  cnic: string | null
  kycStatus: string
  walletBalance: number
  withdrawUnlocked: boolean
  currentLoanId: string | null
  createdAt: string
}
interface LoanRow {
  id: string
  amount: number
  markupPercent: number
  totalRepayment: number
  weeklyInstallment: number
  downPayment: number
  status: string
  createdAt: string
  user: { id: string; phone: string; fullName: string | null }
  installments: { id: string; weekNumber: number; amount: number; status: string }[]
}
interface SettingsData {
  bankName: string
  accountTitle: string
  accountNumber: string
  mobileAccount: string
  markupPercent: number
  downPaymentPercent: number
  loyaltyDiscountPerLoan: number
  minMarkupPercent: number
  loanPackages: string
  adminPhone: string
  adminPassword: string
}

interface WithdrawalRow {
  id: string
  amount: number
  method: string
  bank: string | null
  accountNumber: string
  accountTitle: string
  status: string
  transactionId: string | null
  adminNote: string | null
  createdAt: string
  reviewedAt: string | null
  user: { fullName: string | null; phone: string; cnic: string | null }
}

type Tab = 'dashboard' | 'kyc' | 'payments' | 'withdrawals' | 'users' | 'loans' | 'reels' | 'settings'

// ============ MAIN ============
export default function AdminPanel() {
  const [admin, setAdmin] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('dashboard')

  const refresh = useCallback(async () => {
    const r = await fetch('/api/auth/me', { cache: 'no-store' })
    const d = await r.json()
    setAdmin(d.user || null)
    return d.user || null
  }, [])

  useEffect(() => {
    refresh().finally(() => setLoading(false))
  }, [refresh])

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center geo-surface">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!admin) return <AdminLogin onLogin={refresh} />
  if (admin.role !== 'ADMIN') {
    return (
      <div className="min-h-screen grid place-items-center geo-surface p-4">
        <div className="max-w-md w-full geo-card p-8 text-center">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-red-50 border border-red-200 grid place-items-center">
            <ShieldCheck className="w-6 h-6 text-red-600" />
          </div>
          <h2 className="font-bold text-xl mt-4 text-slate-900">Access Denied</h2>
          <p className="text-sm text-slate-600 mt-1.5">This account does not have admin privileges.</p>
          <a href="/app" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
            Go to user app <ChevronRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    )
  }

  return <AdminShell admin={admin} tab={tab} setTab={setTab} refresh={refresh} />
}

// ============ LOGIN ============
function AdminLogin({ onLogin }: { onLogin: () => Promise<any> }) {
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!phone || !password) return toast.error('Fill all fields')
    setLoading(true)
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      })
      const d = await r.json()
      if (!r.ok) return toast.error(d.error || 'Login failed')
      if (d.user.role !== 'ADMIN') {
        toast.error('This account is not an admin')
        await fetch('/api/auth/logout', { method: 'POST' })
        return
      }
      toast.success('Welcome, Admin!')
      await onLogin()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid place-items-center geo-surface p-4">
      <div className="max-w-md w-full geo-card p-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <BrandLogo height={52} />
          <div className="geo-rule-gold w-16 mt-5" />
          <h1 className="text-2xl font-bold mt-4 text-slate-900">Management Console</h1>
          <p className="font-urdu text-sm text-muted-foreground mt-1.5" dir="rtl">{TAGLINE_UR}</p>
          <p className="text-xs text-muted-foreground/80 mt-0.5">{TAGLINE_EN}</p>
        </div>

        <div className="mt-7 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Admin Phone</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={phone}
                onChange={(e) => setPhone(normalizePhone(e.target.value))}
                placeholder="03000000000"
                type="tel"
                inputMode="numeric"
                maxLength={PHONE_LENGTH}
                className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-border bg-background focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none text-sm transition"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                placeholder="Enter password"
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-border bg-background focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none text-sm transition"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            onClick={submit}
            disabled={loading}
            className="w-full geo-gradient text-white py-3 rounded-xl font-semibold disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm hover:opacity-95 transition"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Sign in to Console
          </button>
        </div>

        <div className="mt-5 text-center">
          <a href="/" className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1 transition">
            <ArrowLeft className="w-3 h-3" /> Back to home
          </a>
        </div>
      </div>
    </div>
  )
}

// ============ SHELL ============
function AdminShell({ admin, tab, setTab, refresh }: {
  admin: AdminUser; tab: Tab; setTab: (t: Tab) => void; refresh: () => Promise<any>
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const nav: { id: Tab; label: string; icon: any }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'kyc', label: 'KYC Review', icon: ShieldCheck },
    { id: 'payments', label: 'Payments', icon: FileCheck },
    { id: 'withdrawals', label: 'Withdrawals', icon: Banknote },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'loans', label: 'Loans', icon: Wallet },
    { id: 'reels', label: 'Customer Videos', icon: Video },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ]

  return (
    <div className="min-h-screen geo-surface flex">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex flex-col w-64 bg-card border-r border-border">
        <div className="px-5 pt-5 pb-4 border-b border-border">
          <BrandLogo height={30} />
          <div className="geo-rule-gold w-10 mt-3" />
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground mt-2.5 font-medium">
            Management Console
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map((n) => (
            <button
              key={n.id}
              onClick={() => setTab(n.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                tab === n.id
                  ? 'geo-gradient text-white shadow-sm'
                  : 'text-slate-600 hover:bg-muted hover:text-slate-900'
              }`}
            >
              <n.icon className="w-4 h-4" /> {n.label}
              {n.id === 'kyc' && <KycBadge />}
              {n.id === 'payments' && <PaymentsBadge />}
              {n.id === 'withdrawals' && <WithdrawalsBadge />}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-border">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">Signed in as</div>
          <div className="text-sm font-semibold text-slate-900">{admin.fullName || admin.phone}</div>
          <button
            onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/admin' }}
            className="mt-3 w-full px-3 py-2 rounded-lg text-xs font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 inline-flex items-center gap-1.5 transition"
          >
            <LogOut className="w-3.5 h-3.5" /> Logout
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden bg-card border-b border-border p-3 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg text-slate-700 hover:bg-muted">
            <Menu className="w-5 h-5" />
          </button>
          <BrandLogo height={28} />
          <button
            onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/admin' }}
            className="p-1.5 rounded-lg text-slate-600 hover:text-red-600 hover:bg-red-50"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </header>

        {/* Mobile sidebar */}
        {sidebarOpen && (
          <div className="md:hidden fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)}>
            <aside className="w-72 h-full bg-card p-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between mb-5">
                <div>
                  <BrandLogo height={28} />
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground mt-2 font-medium">
                    Management Console
                  </div>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-lg text-slate-500 hover:bg-muted">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {nav.map((n) => (
                <button
                  key={n.id}
                  onClick={() => { setTab(n.id); setSidebarOpen(false) }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium mb-1 transition ${
                    tab === n.id
                      ? 'geo-gradient text-white shadow-sm'
                      : 'text-slate-600 hover:bg-muted hover:text-slate-900'
                  }`}
                >
                  <n.icon className="w-4 h-4" /> {n.label}
                </button>
              ))}
            </aside>
          </div>
        )}

        <main className="flex-1 p-4 md:p-8 overflow-auto">
          {tab === 'dashboard' && <DashboardTab />}
          {tab === 'kyc' && <KycTab />}
          {tab === 'payments' && <PaymentsTab />}
          {tab === 'withdrawals' && <WithdrawalsTab />}
          {tab === 'users' && <UsersTab />}
          {tab === 'loans' && <LoansTab />}
          {tab === 'reels' && <ReelsTab />}
          {tab === 'settings' && <SettingsTab />}
        </main>
      </div>
    </div>
  )
}

// Live pending-KYC badge — polls every 10s and toasts when a NEW submission arrives
// (works from any tab, so the admin is notified instantly).
function KycBadge() {
  const [count, setCount] = useState(0)
  const prev = useRef<number | null>(null)
  useEffect(() => {
    let alive = true
    const load = () =>
      fetch('/api/admin/kyc?status=SUBMITTED', { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => {
          if (!alive) return
          const n = d.submissions?.length || 0
          if (prev.current !== null && n > prev.current) {
            toast('🔔 New KYC submission received', { description: 'Open KYC Review to verify.' })
          }
          prev.current = n
          setCount(n)
        })
        .catch(() => {})
    load()
    const t = setInterval(load, 10000)
    return () => { alive = false; clearInterval(t) }
  }, [])
  if (count === 0) return null
  return (
    <span className="ml-auto bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
      {count}
    </span>
  )
}

function PaymentsBadge() {
  const [count, setCount] = useState(0)
  const prev = useRef<number | null>(null)
  useEffect(() => {
    let alive = true
    const load = () =>
      fetch('/api/admin/payments?status=PENDING', { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => {
          if (!alive) return
          const n = d.payments?.length || 0
          if (prev.current !== null && n > prev.current) {
            toast('🔔 New payment submitted', { description: 'Open Payments to review.' })
          }
          prev.current = n
          setCount(n)
        })
        .catch(() => {})
    load()
    const t = setInterval(load, 10000)
    return () => { alive = false; clearInterval(t) }
  }, [])
  if (count === 0) return null
  return (
    <span className="ml-auto bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
      {count}
    </span>
  )
}

function WithdrawalsBadge() {
  const [count, setCount] = useState(0)
  const prev = useRef<number | null>(null)
  useEffect(() => {
    let alive = true
    const load = () =>
      fetch('/api/admin/withdrawals?status=PENDING', { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => {
          if (!alive) return
          const n = d.withdrawals?.length || 0
          if (prev.current !== null && n > prev.current) {
            toast('🔔 New withdrawal request', { description: 'Open Withdrawals to process.' })
          }
          prev.current = n
          setCount(n)
        })
        .catch(() => {})
    load()
    const t = setInterval(load, 10000)
    return () => { alive = false; clearInterval(t) }
  }, [])
  if (count === 0) return null
  return (
    <span className="ml-auto bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
      {count}
    </span>
  )
}

// ============ WITHDRAWALS ============
function WithdrawalsTab() {
  const [filter, setFilter] = useState<'PENDING' | 'PAID' | 'REJECTED' | ''>('PENDING')
  const [rows, setRows] = useState<WithdrawalRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [txn, setTxn] = useState<Record<string, string>>({})
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [reasons, setReasons] = useState<string[]>([])
  const [extra, setExtra] = useState('')

  const W_REASONS = ['Wrong account number', 'Account title mismatch', 'Account not found / invalid', 'Suspected fraud', 'Duplicate request']
  const toggleReason = (q: string) => setReasons((rs) => (rs.includes(q) ? rs.filter((x) => x !== q) : [...rs, q]))
  const buildNote = () => [reasons.join('; '), extra.trim()].filter(Boolean).join(' — ')
  const openReject = (id: string) => { setRejectId(id); setReasons([]); setExtra('') }

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true)
    const url = filter ? `/api/admin/withdrawals?status=${filter}` : '/api/admin/withdrawals'
    fetch(url, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setRows(d.withdrawals || []))
      .catch(() => {})
      .finally(() => { if (!silent) setLoading(false) })
  }, [filter])
  useEffect(() => { load() }, [load])
  // Auto-refresh: new withdrawal requests + status changes appear without a manual refresh
  useEffect(() => {
    const t = setInterval(() => load(true), 10000)
    return () => clearInterval(t)
  }, [load])

  const methodLabel = (w: WithdrawalRow) =>
    w.method === 'bank' ? (w.bank || 'Bank') : w.method === 'easypaisa' ? 'EasyPaisa' : w.method === 'jazzcash' ? 'JazzCash' : w.method
  const wColor = (s: string) =>
    s === 'PAID' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : s === 'REJECTED' ? 'bg-red-50 text-red-700 border-red-200'
      : 'bg-amber-50 text-amber-700 border-amber-200'
  const copy = (t: string) => { navigator.clipboard?.writeText(t).then(() => toast.success('Copied')).catch(() => {}) }

  const pay = async (id: string) => {
    const t = (txn[id] || '').trim()
    if (t.length < 4) return toast.error('Enter the Transaction ID (min 4 characters)')
    setBusy(true)
    try {
      const r = await fetch(`/api/admin/withdrawals/${id}/pay`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transactionId: t }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) return toast.error(d.error || 'Failed')
      toast.success('Marked paid — Transaction ID sent to the user.')
      setTxn((s) => { const n = { ...s }; delete n[id]; return n })
      load()
    } finally { setBusy(false) }
  }

  const reject = async (id: string) => {
    setBusy(true)
    try {
      const r = await fetch(`/api/admin/withdrawals/${id}/reject`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note: buildNote() }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) return toast.error(d.error || 'Failed')
      toast.success('Rejected — amount refunded to the user wallet.')
      setRejectId(null); setReasons([]); setExtra(''); load()
    } finally { setBusy(false) }
  }

  return (
    <div>
      <PageTitle icon={Banknote} title="Withdrawals" subtitle="Send the money to the user's account, then record the Transaction ID" />

      <div className="mt-5 flex flex-wrap gap-2">
        {[
          { id: 'PENDING', label: 'Pending', color: 'bg-amber-500' },
          { id: 'PAID', label: 'Paid', color: 'bg-emerald-600' },
          { id: 'REJECTED', label: 'Rejected', color: 'bg-red-600' },
          { id: '', label: 'All', color: 'bg-primary' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id as 'PENDING' | 'PAID' | 'REJECTED' | '')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              filter === f.id ? `${f.color} text-white shadow-sm` : 'bg-card border border-border text-slate-600 hover:bg-muted'
            }`}
          >
            {f.label}
          </button>
        ))}
        <button onClick={() => load()} className="ml-auto px-3.5 py-1.5 rounded-lg text-xs font-medium bg-card border border-border text-slate-600 inline-flex items-center gap-1.5 hover:bg-muted transition">
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      {loading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <EmptyState icon={Banknote} text="No withdrawal requests" />
      ) : (
        <div className="mt-5 grid gap-4">
          {rows.map((w) => (
            <div key={w.id} className="geo-card p-4">
              <div className="flex flex-col md:flex-row md:items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${wColor(w.status)}`}>{w.status}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-slate-600 border border-border">{methodLabel(w)}</span>
                  </div>
                  <div className="font-bold text-xl mt-2 text-slate-900">PKR {Math.round(w.amount).toLocaleString()}</div>
                  <div className="text-xs text-slate-600 mt-1.5">
                    <span className="font-semibold">User:</span> {w.user.fullName || w.user.phone}
                    <span className="ml-2 text-muted-foreground">Phone: {w.user.phone}</span>
                    {w.user.cnic && <span className="ml-2 text-muted-foreground">CNIC: {w.user.cnic}</span>}
                  </div>

                  {/* Payout destination — what the admin needs to send money */}
                  <div className="mt-3 rounded-xl border border-border bg-muted/40 p-3 text-xs space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-24 shrink-0">Send to</span>
                      <span className="font-semibold text-slate-900">{methodLabel(w)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-24 shrink-0">Account #</span>
                      <span className="font-semibold text-slate-900 break-all">{w.accountNumber}</span>
                      <button onClick={() => copy(w.accountNumber)} className="text-primary hover:underline shrink-0">copy</button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-24 shrink-0">Account title</span>
                      <span className="font-semibold text-slate-900">{w.accountTitle}</span>
                      <button onClick={() => copy(w.accountTitle)} className="text-primary hover:underline shrink-0">copy</button>
                    </div>
                  </div>

                  <div className="text-[10px] text-muted-foreground mt-2">
                    Requested: {new Date(w.createdAt).toLocaleString('en-PK', { dateStyle: 'short', timeStyle: 'short' })}
                    {w.reviewedAt && <> · Processed: {new Date(w.reviewedAt).toLocaleString('en-PK', { dateStyle: 'short', timeStyle: 'short' })}</>}
                  </div>

                  {w.status === 'PAID' && w.transactionId && (
                    <div className="mt-2 inline-flex items-center gap-2 text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-3 py-1.5">
                      <Check className="w-3.5 h-3.5" /> Transaction ID: <strong>{w.transactionId}</strong>
                    </div>
                  )}
                  {w.status === 'REJECTED' && w.adminNote && (
                    <div className="mt-2 text-xs text-red-700">Reason: <em>{w.adminNote}</em></div>
                  )}
                </div>

                {w.status === 'PENDING' && (
                  <div className="shrink-0 md:w-72 space-y-2">
                    <label className="block text-xs font-semibold text-slate-700">Transaction ID (after sending money)</label>
                    <input
                      value={txn[w.id] || ''}
                      onChange={(e) => setTxn((s) => ({ ...s, [w.id]: e.target.value }))}
                      placeholder="e.g. TXN123456 / TID from app"
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition"
                    />
                    <button
                      onClick={() => pay(w.id)}
                      disabled={busy}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 inline-flex items-center gap-1.5 justify-center transition"
                    >
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Mark Paid &amp; Send ID
                    </button>
                    <button
                      onClick={() => openReject(w.id)}
                      disabled={busy}
                      className="w-full px-3.5 py-2 rounded-xl bg-card border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 disabled:opacity-60 inline-flex items-center gap-1.5 justify-center transition"
                    >
                      <X className="w-4 h-4" /> Reject &amp; Refund
                    </button>
                  </div>
                )}
              </div>

              {w.status === 'PENDING' && rejectId === w.id && (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50/50 p-3">
                  <div className="text-xs font-semibold text-slate-700 mb-1.5">Reason for rejection — select one or more (sent to the user; balance is refunded)</div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {W_REASONS.map((q) => {
                      const on = reasons.includes(q)
                      return (
                        <button key={q} onClick={() => toggleReason(q)}
                          className={`text-[10px] px-2 py-0.5 rounded-full border inline-flex items-center gap-1 transition ${on ? 'bg-red-600 text-white border-red-600' : 'bg-card border-border text-slate-600 hover:border-primary'}`}>
                          {on && <Check className="w-2.5 h-2.5" />}{q}
                        </button>
                      )
                    })}
                  </div>
                  <textarea value={extra} onChange={(e) => setExtra(e.target.value)} rows={2} placeholder="Add any extra details (optional)…"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition" />
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => reject(w.id)} disabled={(reasons.length === 0 && !extra.trim()) || busy}
                      className="px-3.5 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-60 inline-flex items-center gap-1.5 transition">
                      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />} Confirm Reject &amp; Refund
                    </button>
                    <button onClick={() => { setRejectId(null); setReasons([]); setExtra('') }} className="px-3.5 py-2 rounded-lg bg-card border border-border text-slate-600 text-xs font-semibold hover:bg-muted transition">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============ DASHBOARD ============
function DashboardTab() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = () =>
      fetch('/api/admin/stats', { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => setStats(d))
        .catch(() => {})
        .finally(() => setLoading(false))
    load()
    const t = setInterval(load, 10000) // live dashboard — refresh counts every 10s
    return () => clearInterval(t)
  }, [])

  if (loading || !stats) return <Loading />

  const cards = [
    { label: 'Total Users', value: stats.totalUsers, icon: Users, tint: 'bg-primary/10 text-primary', highlight: false },
    { label: 'Total Loans', value: stats.totalLoans, icon: Wallet, tint: 'bg-primary/10 text-primary', highlight: false },
    { label: 'Pending Approvals', value: stats.pendingPayments, icon: FileCheck, tint: 'bg-amber-50 text-amber-600', highlight: false },
    { label: 'Approved Payments', value: stats.approvedPayments, icon: Check, tint: 'bg-emerald-50 text-emerald-600', highlight: false },
    { label: 'Rejected Payments', value: stats.rejectedPayments, icon: X, tint: 'bg-red-50 text-red-600', highlight: false },
    { label: 'Total Disbursed', value: `PKR ${Math.round(stats.totalDisbursed).toLocaleString()}`, icon: Banknote, tint: 'bg-emerald-50 text-emerald-600', highlight: true },
    { label: 'Total Received', value: `PKR ${Math.round(stats.totalReceived).toLocaleString()}`, icon: Banknote, tint: 'bg-emerald-50 text-emerald-600', highlight: true },
  ]

  return (
    <div>
      <PageTitle icon={LayoutDashboard} title="Dashboard" subtitle="Quick overview of platform activity" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        {cards.map((c) => (
          <div key={c.label} className={`geo-card p-5 relative overflow-hidden ${c.highlight ? 'ring-1 ring-gold/30' : ''}`}>
            {c.highlight && <div className="geo-gradient-gold absolute inset-x-0 top-0 h-1" />}
            <div className={`w-10 h-10 rounded-xl ${c.tint} grid place-items-center mb-4`}>
              <c.icon className="w-5 h-5" />
            </div>
            <div className="text-2xl font-bold text-slate-900 tracking-tight">{c.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 geo-card p-6">
        <h3 className="font-bold text-sm text-slate-900 mb-4">How the approval flow works</h3>
        <ol className="text-sm text-slate-600 space-y-2.5 list-decimal pl-4 marker:text-primary marker:font-semibold">
          <li>User registers &amp; submits KYC (you can review in Users tab — auto-approved in this demo)</li>
          <li>User selects loan package → amount credited to wallet → user attempts to withdraw</li>
          <li>System requires 12% down payment → user uploads screenshot → appears in Payments tab as PENDING</li>
          <li>Admin approves → user advances to 1st installment payment → user uploads again → PENDING</li>
          <li>Admin approves → user&apos;s withdraw unlocks → user withdraws to EasyPaisa/JazzCash/Bank</li>
          <li>If admin rejects → user is notified and can re-upload a new screenshot</li>
        </ol>
      </div>
    </div>
  )
}

// ============ PAYMENTS ============
// ============ KYC REVIEW ============
interface KycRow {
  id: string
  fullName: string | null
  phone: string
  cnic: string | null
  email: string | null
  dob: string | null
  address: string | null
  cnicFront: string | null
  cnicBack: string | null
  selfie: string | null
  kycStatus: string
  kycNote: string | null
  kycSubmittedAt: string | null
  createdAt: string
}

function KycDetail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-medium text-slate-800">{value || '—'}</span>
    </div>
  )
}

type KycSubmissionRow = {
  id: string; userId: string; phone: string | null; fullName: string | null
  cnic: string | null; email: string | null; dob: string | null; address: string | null
  cnicFront: string | null; cnicBack: string | null; selfie: string | null
  status: string; adminNote: string | null; reviewedAt: string | null; createdAt: string
}

function KycTab() {
  const [filter, setFilter] = useState<'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'ALL' | 'HISTORY'>('SUBMITTED')
  const [rows, setRows] = useState<KycRow[]>([])
  const [history, setHistory] = useState<KycSubmissionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [lightbox, setLightbox] = useState<{ src: string; label: string } | null>(null)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [reasons, setReasons] = useState<string[]>([])
  const [extra, setExtra] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const toggleReason = (q: string) => setReasons((rs) => (rs.includes(q) ? rs.filter((x) => x !== q) : [...rs, q]))
  const buildNote = () => [reasons.join('; '), extra.trim()].filter(Boolean).join(' — ')

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true)
    if (filter === 'HISTORY') {
      fetch('/api/admin/kyc/history', { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => setHistory(d.submissions || []))
        .catch(() => {})
        .finally(() => { if (!silent) setLoading(false) })
    } else {
      fetch(`/api/admin/kyc?status=${filter}`, { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => setRows(d.submissions || []))
        .catch(() => {})
        .finally(() => { if (!silent) setLoading(false) })
    }
  }, [filter])

  useEffect(() => { load() }, [load])
  // Auto-refresh: new submissions + status changes appear without a manual refresh
  useEffect(() => {
    const t = setInterval(() => load(true), 10000)
    return () => clearInterval(t)
  }, [load])

  const act = async (id: string, action: 'approve' | 'reject', reason?: string) => {
    setActionLoading(id + action)
    try {
      const r = await fetch(`/api/admin/kyc/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'reject' ? { note: reason || '' } : {}),
      })
      const d = await r.json()
      if (!r.ok) return toast.error(d.error || 'Failed')
      toast.success(action === 'approve' ? 'KYC approved' : 'KYC rejected — user notified')
      setRejectId(null); setReasons([]); setExtra(''); load()
    } finally {
      setActionLoading(null)
    }
  }

  const delCase = async (id: string) => {
    if (!window.confirm('Delete this KYC case record? This cannot be undone.')) return
    try {
      const r = await fetch(`/api/admin/kyc/history/${id}`, { method: 'POST' })
      if (r.ok) { toast.success('KYC case deleted'); load() } else toast.error('Could not delete')
    } catch { toast.error('Could not delete') }
  }

  const delUser = async (id: string, name: string) => {
    if (!window.confirm(`Delete ${name}'s account and ALL their data (KYC, loans, payments)? This cannot be undone.`)) return
    try {
      const r = await fetch(`/api/admin/kyc/${id}`, { method: 'POST' })
      const d = await r.json().catch(() => ({}))
      if (r.ok) { toast.success('User & KYC deleted'); load() } else toast.error(d.error || 'Could not delete')
    } catch { toast.error('Could not delete') }
  }

  const QUICK = ['Blurry / unclear photo', 'CNIC number does not match', 'Wrong document uploaded', 'Selfie does not match CNIC', 'Details incomplete']

  return (
    <div>
      <PageTitle icon={ShieldCheck} title="KYC Review" subtitle="Verify identity documents — approve, or reject with feedback" />

      <div className="mt-5 flex flex-wrap gap-2">
        {[
          { id: 'SUBMITTED', label: 'Pending', color: 'bg-amber-500' },
          { id: 'APPROVED', label: 'Approved', color: 'bg-emerald-600' },
          { id: 'REJECTED', label: 'Rejected', color: 'bg-red-600' },
          { id: 'ALL', label: 'All', color: 'bg-primary' },
          { id: 'HISTORY', label: 'All Cases (History)', color: 'bg-slate-700' },
        ].map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id as any)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${filter === f.id ? `${f.color} text-white shadow-sm` : 'bg-card border border-border text-slate-600 hover:bg-muted'}`}>
            {f.label}
          </button>
        ))}
        <button onClick={() => load()} className="ml-auto px-3.5 py-1.5 rounded-lg text-xs font-medium bg-card border border-border text-slate-600 inline-flex items-center gap-1.5 hover:bg-muted transition">
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      {loading ? <Loading /> : filter === 'HISTORY' ? (
        history.length === 0 ? <EmptyState icon={ShieldCheck} text="No KYC cases yet" /> : (
          <div className="mt-5 grid gap-3">
            {history.map((h) => (
              <div key={h.id} className="geo-card p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-900">{h.fullName || '—'}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${kycColor(h.status)}`}>{h.status}</span>
                  <span className="text-xs text-muted-foreground">
                    {h.phone} · submitted {new Date(h.createdAt).toLocaleString('en-PK', { dateStyle: 'short', timeStyle: 'short' })}
                    {h.reviewedAt ? ` · reviewed ${new Date(h.reviewedAt).toLocaleString('en-PK', { dateStyle: 'short', timeStyle: 'short' })}` : ''}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {[{ label: 'CNIC Front', src: h.cnicFront }, { label: 'CNIC Back', src: h.cnicBack }, { label: 'Selfie', src: h.selfie }].map((doc) => (
                    <button key={doc.label} onClick={() => doc.src && setLightbox({ src: doc.src, label: doc.label })}
                      className="rounded-xl bg-muted overflow-hidden border border-border hover:border-primary relative aspect-[4/3] transition">
                      {doc.src ? <img src={doc.src} alt={doc.label} className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center text-[10px] text-muted-foreground">No image</div>}
                      <span className="absolute bottom-1 left-1 text-[9px] bg-slate-900/70 text-white px-1.5 py-0.5 rounded">{doc.label}</span>
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3 text-xs">
                  <KycDetail label="CNIC" value={h.cnic} />
                  <KycDetail label="Date of Birth" value={h.dob} />
                  <KycDetail label="Email" value={h.email} />
                  <KycDetail label="Address" value={h.address} />
                </div>
                {h.adminNote && (
                  <div className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">Note: <em>{h.adminNote}</em></div>
                )}
                <div className="mt-3 flex justify-end">
                  <button onClick={() => delCase(h.id)} className="text-xs text-red-600 inline-flex items-center gap-1 hover:underline">
                    <Trash2 className="w-3.5 h-3.5" /> Delete case
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : rows.length === 0 ? <EmptyState icon={ShieldCheck} text="No KYC submissions" /> : (
        <div className="mt-5 grid gap-4">
          {rows.map((u) => {
            const docs = [
              { label: 'CNIC Front', src: u.cnicFront },
              { label: 'CNIC Back', src: u.cnicBack },
              { label: 'Selfie', src: u.selfie },
            ]
            return (
              <div key={u.id} className="geo-card p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-900">{u.fullName || '—'}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${kycColor(u.kycStatus)}`}>{u.kycStatus}</span>
                  <span className="text-xs text-muted-foreground">
                    {u.phone}{u.kycSubmittedAt ? ` · submitted ${new Date(u.kycSubmittedAt).toLocaleString('en-PK', { dateStyle: 'short', timeStyle: 'short' })}` : ''}
                  </span>
                  <button onClick={() => delUser(u.id, u.fullName || u.phone)} title="Delete user & KYC"
                    className="ml-auto text-xs text-red-600 inline-flex items-center gap-1 hover:underline shrink-0">
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3">
                  {docs.map((doc) => (
                    <button key={doc.label} onClick={() => doc.src && setLightbox({ src: doc.src, label: doc.label })}
                      className="rounded-xl bg-muted overflow-hidden border border-border hover:border-primary relative aspect-[4/3] transition">
                      {doc.src ? (
                        <>
                          <img src={doc.src} alt={doc.label} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-slate-900/0 hover:bg-slate-900/40 grid place-items-center text-white opacity-0 hover:opacity-100 transition"><Eye className="w-5 h-5" /></div>
                        </>
                      ) : <div className="w-full h-full grid place-items-center text-[10px] text-muted-foreground">No image</div>}
                      <span className="absolute bottom-1 left-1 text-[9px] bg-slate-900/70 text-white px-1.5 py-0.5 rounded">{doc.label}</span>
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3 text-xs">
                  <KycDetail label="CNIC" value={u.cnic} />
                  <KycDetail label="Date of Birth" value={u.dob} />
                  <KycDetail label="Email" value={u.email} />
                  <KycDetail label="Address" value={u.address} />
                </div>

                {u.kycStatus === 'REJECTED' && u.kycNote && (
                  <div className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    Rejection feedback: <em>{u.kycNote}</em>
                  </div>
                )}

                {u.kycStatus === 'SUBMITTED' && (
                  rejectId === u.id ? (
                    <div className="mt-3 rounded-xl border border-red-200 bg-red-50/50 p-3">
                      <div className="text-xs font-semibold text-slate-700 mb-1.5">Reason for rejection — select one or more (sent to the user)</div>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {QUICK.map((q) => {
                          const on = reasons.includes(q)
                          return (
                            <button key={q} onClick={() => toggleReason(q)}
                              className={`text-[10px] px-2 py-0.5 rounded-full border inline-flex items-center gap-1 transition ${on ? 'bg-red-600 text-white border-red-600' : 'bg-card border-border text-slate-600 hover:border-primary'}`}>
                              {on && <Check className="w-2.5 h-2.5" />}{q}
                            </button>
                          )
                        })}
                      </div>
                      <textarea value={extra} onChange={(e) => setExtra(e.target.value)} rows={2} placeholder="Add any extra details (optional)…"
                        className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition" />
                      {(reasons.length > 0 || extra.trim()) && (
                        <div className="mt-2 text-[11px] text-slate-500">User will see: <span className="text-slate-700">{buildNote()}</span></div>
                      )}
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => act(u.id, 'reject', buildNote())} disabled={(reasons.length === 0 && !extra.trim()) || actionLoading === u.id + 'reject'}
                          className="px-3.5 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-60 inline-flex items-center gap-1.5 transition">
                          {actionLoading === u.id + 'reject' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />} Confirm Reject
                        </button>
                        <button onClick={() => { setRejectId(null); setReasons([]); setExtra('') }} className="px-3.5 py-2 rounded-lg bg-card border border-border text-slate-600 text-xs font-semibold hover:bg-muted transition">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => act(u.id, 'approve')} disabled={actionLoading === u.id + 'approve'}
                        className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-60 inline-flex items-center gap-1.5 transition">
                        {actionLoading === u.id + 'approve' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Approve
                      </button>
                      <button onClick={() => { setRejectId(u.id); setReasons([]); setExtra('') }}
                        className="px-4 py-2 rounded-lg bg-card border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 transition inline-flex items-center gap-1.5">
                        <X className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  )
                )}
              </div>
            )
          })}
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm grid place-items-center p-4" onClick={() => setLightbox(null)}>
          <div className="max-w-3xl w-full bg-card rounded-2xl overflow-hidden shadow-sm" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="font-bold text-sm text-slate-900">{lightbox.label}</div>
              <button onClick={() => setLightbox(null)} className="p-1.5 rounded-lg text-slate-500 hover:bg-muted hover:text-slate-900 transition"><X className="w-4 h-4" /></button>
            </div>
            <img src={lightbox.src} alt={lightbox.label} className="w-full max-h-[75vh] object-contain bg-muted" />
          </div>
        </div>
      )}
    </div>
  )
}

function PaymentsTab() {
  const [filter, setFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | ''>('PENDING')
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<PaymentRow | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [reasons, setReasons] = useState<string[]>([])
  const [extra, setExtra] = useState('')

  const toggleReason = (q: string) => setReasons((rs) => (rs.includes(q) ? rs.filter((x) => x !== q) : [...rs, q]))
  const buildNote = () => [reasons.join('; '), extra.trim()].filter(Boolean).join(' — ')
  const PAY_REASONS = [
    'Wrong / unrelated screenshot', 'Amount does not match', 'Blurry / unclear image',
    'Not a valid payment receipt', 'Duplicate submission', 'Wrong account / recipient',
  ]
  const openReject = (id: string) => { setSelected(null); setRejectId(id); setReasons([]); setExtra('') }

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true)
    const url = filter ? `/api/admin/payments?status=${filter}` : '/api/admin/payments'
    fetch(url, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setPayments(d.payments || []))
      .catch(() => {})
      .finally(() => { if (!silent) setLoading(false) })
  }, [filter])

  useEffect(() => { load() }, [load])
  // Auto-refresh: new payments + status changes appear without a manual refresh
  useEffect(() => {
    const t = setInterval(() => load(true), 10000)
    return () => clearInterval(t)
  }, [load])

  const act = async (id: string, action: 'approve' | 'reject', note?: string) => {
    setActionLoading(true)
    try {
      const r = await fetch(`/api/admin/payments/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: note || '' }),
      })
      const d = await r.json()
      if (!r.ok) return toast.error(d.error || 'Failed')
      toast.success(action === 'approve' ? 'Payment approved. User balance updated.' : 'Payment rejected.')
      setSelected(null); setRejectId(null); setReasons([]); setExtra('')
      load()
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div>
      <PageTitle icon={FileCheck} title="Payment Approvals" subtitle="Review user-submitted payment screenshots" />

      <div className="mt-5 flex flex-wrap gap-2">
        {[
          { id: 'PENDING', label: 'Pending', color: 'bg-amber-500' },
          { id: 'APPROVED', label: 'Approved', color: 'bg-emerald-600' },
          { id: 'REJECTED', label: 'Rejected', color: 'bg-red-600' },
          { id: '', label: 'All', color: 'bg-primary' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id as any)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              filter === f.id ? `${f.color} text-white shadow-sm` : 'bg-card border border-border text-slate-600 hover:bg-muted'
            }`}
          >
            {f.label}
          </button>
        ))}
        <button
          onClick={() => load()}
          className="ml-auto px-3.5 py-1.5 rounded-lg text-xs font-medium bg-card border border-border text-slate-600 inline-flex items-center gap-1.5 hover:bg-muted transition"
        >
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      {loading ? (
        <Loading />
      ) : payments.length === 0 ? (
        <EmptyState icon={FileCheck} text="No payments found" />
      ) : (
        <div className="mt-5 grid gap-4">
          {payments.map((p) => (
            <div key={p.id} className="geo-card p-4">
              <div className="flex flex-col md:flex-row gap-4">
              {/* Screenshot thumbnail */}
              <button
                onClick={() => setSelected(p)}
                className="md:w-40 h-32 md:h-32 rounded-xl bg-muted overflow-hidden border border-border hover:border-primary relative shrink-0 transition"
              >
                <img src={p.screenshotPath} alt="screenshot" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-slate-900/0 hover:bg-slate-900/40 grid place-items-center text-white opacity-0 hover:opacity-100 transition">
                  <Eye className="w-6 h-6" />
                </div>
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColor(p.status)}`}>
                    {p.status}
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-slate-600 border border-border">
                    {p.type === 'DOWN_PAYMENT' ? 'Down Payment' : p.type === 'INSTALLMENT' ? 'Installment' : p.type}
                  </span>
                </div>
                <div className="font-bold text-lg mt-2 text-slate-900">PKR {Math.round(p.amount).toLocaleString()}</div>
                <div className="text-xs text-slate-600 mt-1.5">
                  <span className="font-semibold">User:</span> {p.user.fullName || p.user.phone}
                  {p.user.cnic && <span className="ml-2 text-muted-foreground">CNIC: {p.user.cnic}</span>}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Phone: {p.user.phone} · Submitted: {new Date(p.createdAt).toLocaleString('en-PK', { dateStyle: 'short', timeStyle: 'short' })}
                </div>
                {p.adminNote && (
                  <div className="text-xs text-slate-700 mt-1.5">Admin note: <em>{p.adminNote}</em></div>
                )}
                {p.reviewedAt && (
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    Reviewed: {new Date(p.reviewedAt).toLocaleString('en-PK', { dateStyle: 'short', timeStyle: 'short' })}
                  </div>
                )}
              </div>

              {p.status === 'PENDING' && (
                <div className="flex md:flex-col gap-2 shrink-0">
                  <button
                    onClick={() => act(p.id, 'approve')}
                    disabled={actionLoading}
                    className="flex-1 md:flex-none px-3.5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-60 inline-flex items-center gap-1.5 justify-center transition"
                  >
                    <Check className="w-3.5 h-3.5" /> Approve
                  </button>
                  <button
                    onClick={() => openReject(p.id)}
                    disabled={actionLoading}
                    className="flex-1 md:flex-none px-3.5 py-2 rounded-lg bg-card border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 disabled:opacity-60 inline-flex items-center gap-1.5 justify-center transition"
                  >
                    <X className="w-3.5 h-3.5" /> Reject
                  </button>
                </div>
              )}
              </div>

              {p.status === 'PENDING' && rejectId === p.id && (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50/50 p-3">
                  <div className="text-xs font-semibold text-slate-700 mb-1.5">Reason for rejection — select one or more (sent to the user)</div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {PAY_REASONS.map((q) => {
                      const on = reasons.includes(q)
                      return (
                        <button key={q} onClick={() => toggleReason(q)}
                          className={`text-[10px] px-2 py-0.5 rounded-full border inline-flex items-center gap-1 transition ${on ? 'bg-red-600 text-white border-red-600' : 'bg-card border-border text-slate-600 hover:border-primary'}`}>
                          {on && <Check className="w-2.5 h-2.5" />}{q}
                        </button>
                      )
                    })}
                  </div>
                  <textarea value={extra} onChange={(e) => setExtra(e.target.value)} rows={2} placeholder="Add any extra details (optional)…"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition" />
                  {(reasons.length > 0 || extra.trim()) && (
                    <div className="mt-2 text-[11px] text-slate-500">User will see: <span className="text-slate-700">{buildNote()}</span></div>
                  )}
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => act(p.id, 'reject', buildNote())} disabled={(reasons.length === 0 && !extra.trim()) || actionLoading}
                      className="px-3.5 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-60 inline-flex items-center gap-1.5 transition">
                      {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />} Confirm Reject
                    </button>
                    <button onClick={() => { setRejectId(null); setReasons([]); setExtra('') }} className="px-3.5 py-2 rounded-lg bg-card border border-border text-slate-600 text-xs font-semibold hover:bg-muted transition">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm grid place-items-center p-4"
          onClick={() => setSelected(null)}
        >
          <div className="max-w-3xl w-full bg-card rounded-2xl overflow-hidden shadow-sm" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <div className="font-bold text-sm text-slate-900">Payment Screenshot</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {selected.user.fullName || selected.user.phone} · PKR {Math.round(selected.amount).toLocaleString()} · {selected.type}
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg text-slate-500 hover:bg-muted hover:text-slate-900 transition">
                <X className="w-4 h-4" />
              </button>
            </div>
            <img src={selected.screenshotPath} alt="screenshot" className="w-full max-h-[70vh] object-contain bg-muted" />
            {selected.status === 'PENDING' && (
              <div className="p-4 border-t border-border flex gap-2">
                <button
                  onClick={() => act(selected.id, 'approve')}
                  disabled={actionLoading}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 inline-flex items-center gap-1.5 justify-center transition"
                >
                  <Check className="w-4 h-4" /> Approve Payment
                </button>
                <button
                  onClick={() => openReject(selected.id)}
                  disabled={actionLoading}
                  className="flex-1 py-2.5 rounded-xl bg-card border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 disabled:opacity-60 inline-flex items-center gap-1.5 justify-center transition"
                >
                  <X className="w-4 h-4" /> Reject
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ============ USERS ============
function UsersTab() {
  const [q, setQ] = useState('')
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [kycActionLoading, setKycActionLoading] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/admin/users?q=${encodeURIComponent(q)}&role=USER`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setUsers(d.users || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [q])

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load])

  const kycAction = async (id: string, action: 'approve' | 'reject') => {
    setKycActionLoading(id + action)
    try {
      const r = await fetch(`/api/admin/kyc/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'reject' ? { note: 'KYC documents invalid' } : {}),
      })
      const d = await r.json()
      if (!r.ok) return toast.error(d.error || 'Failed')
      toast.success(action === 'approve' ? 'KYC approved' : 'KYC rejected')
      load()
    } finally {
      setKycActionLoading(null)
    }
  }

  return (
    <div>
      <PageTitle icon={Users} title="Users" subtitle="Manage user accounts & KYC" />

      <div className="mt-5 relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, phone, CNIC..."
          className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-border bg-card text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition"
        />
      </div>

      {loading ? (
        <Loading />
      ) : users.length === 0 ? (
        <EmptyState icon={Users} text="No users found" />
      ) : (
        <div className="mt-5 geo-card overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">User</th>
                <th className="text-left px-4 py-3 font-semibold">CNIC</th>
                <th className="text-left px-4 py-3 font-semibold">KYC</th>
                <th className="text-left px-4 py-3 font-semibold">Wallet</th>
                <th className="text-left px-4 py-3 font-semibold">Withdraw</th>
                <th className="text-left px-4 py-3 font-semibold">Joined</th>
                <th className="text-left px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-muted/40 transition">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{u.fullName || '—'}</div>
                    <div className="text-xs text-muted-foreground">{u.phone}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{u.cnic || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${kycColor(u.kycStatus)}`}>
                      {u.kycStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-emerald-600">PKR {Math.round(u.walletBalance).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    {u.withdrawUnlocked ? (
                      <span className="text-emerald-600 text-xs font-semibold inline-flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Unlocked
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs inline-flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Locked
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(u.createdAt).toLocaleDateString('en-PK')}
                  </td>
                  <td className="px-4 py-3">
                    {u.kycStatus === 'SUBMITTED' && (
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => kycAction(u.id, 'approve')}
                          disabled={kycActionLoading === u.id + 'approve'}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-semibold hover:bg-emerald-700 disabled:opacity-60 inline-flex items-center gap-1 transition"
                        >
                          <Check className="w-3 h-3" /> Approve
                        </button>
                        <button
                          onClick={() => kycAction(u.id, 'reject')}
                          disabled={kycActionLoading === u.id + 'reject'}
                          className="px-2.5 py-1 rounded-lg bg-card border border-red-200 text-red-600 text-[10px] font-semibold hover:bg-red-50 disabled:opacity-60 inline-flex items-center gap-1 transition"
                        >
                          <X className="w-3 h-3" /> Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ============ LOANS ============
function LoansTab() {
  const [loans, setLoans] = useState<LoanRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('')

  const load = useCallback(() => {
    setLoading(true)
    const url = filter ? `/api/admin/loans?status=${filter}` : '/api/admin/loans'
    fetch(url, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setLoans(d.loans || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [filter])

  useEffect(() => { load() }, [load])

  const markRepaid = async (id: string) => {
    if (!window.confirm('Mark this loan as FULLY REPAID? The user can then take a new loan at a lower (loyalty) rate.')) return
    const r = await fetch(`/api/admin/loans/${id}/repaid`, { method: 'POST' })
    const d = await r.json().catch(() => ({}))
    if (r.ok) { toast.success('Loan marked repaid — loyalty rate unlocked'); load() } else toast.error(d.error || 'Failed')
  }

  return (
    <div>
      <PageTitle icon={Wallet} title="Loans" subtitle="All user loans" />

      <div className="mt-5 flex flex-wrap gap-2">
        {['', 'APPROVED', 'DOWN_PAYMENT_APPROVED', 'INST1_APPROVED', 'WITHDRAWN', 'REPAID', 'REJECTED'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              filter === f ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-card border border-border text-slate-600 hover:bg-muted'
            }`}
          >
            {f ? f.replace(/_/g, ' ') : 'All'}
          </button>
        ))}
        <button
          onClick={() => load()}
          className="ml-auto px-3.5 py-1.5 rounded-lg text-xs font-medium bg-card border border-border text-slate-600 inline-flex items-center gap-1.5 hover:bg-muted transition"
        >
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      {loading ? (
        <Loading />
      ) : loans.length === 0 ? (
        <EmptyState icon={Wallet} text="No loans found" />
      ) : (
        <div className="mt-5 grid gap-4">
          {loans.map((l) => (
            <div key={l.id} className="geo-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg text-slate-900">PKR {Math.round(l.amount).toLocaleString()}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${loanStatusColor(l.status)}`}>
                      {l.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 mt-1.5">
                    User: <strong className="text-slate-900">{l.user.fullName || l.user.phone}</strong> · {l.user.phone}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Created: {new Date(l.createdAt).toLocaleString('en-PK', { dateStyle: 'short', timeStyle: 'short' })}
                  </div>
                </div>
                <div className="text-right text-xs space-y-0.5">
                  <div className="text-slate-700">Total: <strong className="text-gold-foreground">PKR {Math.round(l.totalRepayment).toLocaleString()}</strong></div>
                  <div className="text-muted-foreground">Markup: {l.markupPercent}%</div>
                  <div className="text-muted-foreground">Weekly: PKR {Math.round(l.weeklyInstallment).toLocaleString()}</div>
                  <div className="text-muted-foreground">Down Pay: PKR {Math.round(l.downPayment).toLocaleString()}</div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-2 text-xs">
                {l.installments.map((inst) => (
                  <div key={inst.id} className={`px-2.5 py-1.5 rounded-lg border ${inst.status === 'PAID' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-muted border-border text-slate-600'}`}>
                    Week {inst.weekNumber}: <strong>PKR {Math.round(inst.amount).toLocaleString()}</strong>
                    <span className="ml-1 opacity-70">({inst.status})</span>
                  </div>
                ))}
              </div>
              {l.status !== 'REPAID' && l.status !== 'REJECTED' && (
                <div className="mt-3 flex justify-end">
                  <button onClick={() => markRepaid(l.id)}
                    className="px-3.5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 inline-flex items-center gap-1.5 transition">
                    <Check className="w-3.5 h-3.5" /> Mark as Repaid
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============ CUSTOMER VIDEOS (REELS) ============
interface ReelRow { id: string; title: string; subtitle: string | null; videoPath: string; createdAt: string }

function ReelsTab() {
  const [reels, setReels] = useState<ReelRow[]>([])
  const [loading, setLoading] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/admin/reels', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setReels(d.reels || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  // XHR upload so we can show real upload progress for large videos.
  const upload = () => {
    if (!file) return toast.error('Choose a video first')
    if (!title.trim()) return toast.error('Add a title')
    setUploading(true); setProgress(0)

    const fd = new FormData()
    fd.append('file', file); fd.append('title', title); fd.append('subtitle', subtitle)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/admin/reels')
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      setUploading(false); setProgress(0)
      let d: { error?: string } = {}
      try { d = JSON.parse(xhr.responseText) } catch {}
      if (xhr.status >= 200 && xhr.status < 300) {
        toast.success('Video added to the home page')
        setFile(null); setTitle(''); setSubtitle(''); if (fileRef.current) fileRef.current.value = ''
        load()
      } else {
        toast.error(d.error || 'Upload failed')
      }
    }
    xhr.onerror = () => { setUploading(false); setProgress(0); toast.error('Upload failed. Please try again.') }
    xhr.send(fd)
  }

  const del = async (id: string) => {
    if (!window.confirm('Delete this video? This cannot be undone.')) return
    try {
      const r = await fetch(`/api/admin/reels/${id}`, { method: 'POST' })
      const d = await r.json().catch(() => ({}))
      if (r.ok) { toast.success('Video deleted'); load() }
      else toast.error(d.error || 'Could not delete')
    } catch {
      toast.error('Network error — please try again')
    }
  }

  return (
    <div>
      <PageTitle icon={Video} title="Customer Videos" subtitle="Upload short videos shown in “Our Satisfied Customers” on the home page" />

      <div className="mt-5 geo-card p-4 max-w-xl">
        <div className="text-sm font-semibold text-slate-900 mb-3">Add a new video</div>
        <button onClick={() => fileRef.current?.click()} disabled={uploading} className="w-full border-2 border-dashed border-border rounded-xl p-5 text-center hover:border-primary transition disabled:opacity-60">
          <UploadCloud className="w-6 h-6 mx-auto text-primary" />
          <div className="text-xs text-slate-600 mt-1.5">{file ? file.name : 'Tap to choose a video (MP4 / WebM / MOV, max 60MB)'}</div>
        </button>
        <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={uploading} placeholder="Title (e.g. Ahsan from Lahore)"
          className="w-full mt-3 px-3 py-2.5 rounded-xl border border-border bg-card text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition disabled:opacity-60" />
        <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} disabled={uploading} placeholder="Subtitle (e.g. Got my loan in 2 days)"
          className="w-full mt-2 px-3 py-2.5 rounded-xl border border-border bg-card text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition disabled:opacity-60" />

        {uploading ? (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs font-medium text-slate-600 mb-1.5">
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                {progress < 100 ? 'Uploading your video…' : 'Processing…'}
              </span>
              <span className="tabular-nums">{progress}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full geo-gradient rounded-full transition-all duration-200 ${progress >= 100 ? 'animate-pulse' : ''}`}
                style={{ width: `${Math.max(4, progress)}%` }}
              />
            </div>
          </div>
        ) : (
          <button onClick={upload} className="mt-3 px-4 py-2.5 rounded-xl geo-gradient text-white text-sm font-semibold inline-flex items-center gap-2 hover:opacity-95 transition">
            <UploadCloud className="w-4 h-4" /> Upload Video
          </button>
        )}
      </div>

      {loading ? <Loading /> : reels.length === 0 ? <EmptyState icon={Video} text="No videos yet — upload one above" /> : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reels.map((r) => (
            <div key={r.id} className="geo-card overflow-hidden">
              <video src={r.videoPath} controls preload="metadata" className="w-full aspect-[9/16] object-cover bg-black" />
              <div className="p-3">
                <div className="font-semibold text-sm text-slate-900">{r.title}</div>
                {r.subtitle && <div className="text-xs text-muted-foreground mt-0.5">{r.subtitle}</div>}
                <button onClick={() => del(r.id)} className="mt-2 text-xs text-red-600 inline-flex items-center gap-1 hover:underline">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============ SETTINGS ============
// ---- Mobile app (APK) uploader, shown inside Settings ----
function AppApkUploader() {
  const [apk, setApk] = useState<{ apkPath: string | null; apkVersion: string | null }>({ apkPath: null, apkVersion: null })
  const [file, setFile] = useState<File | null>(null)
  const [version, setVersion] = useState('')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(() => {
    fetch('/api/admin/app', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setApk({ apkPath: d.apkPath, apkVersion: d.apkVersion }))
      .catch(() => {})
  }, [])
  useEffect(() => { load() }, [load])

  const upload = () => {
    if (!file) return toast.error('Choose an APK file')
    setUploading(true); setProgress(0)
    const fd = new FormData(); fd.append('file', file); fd.append('version', version)
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/admin/app')
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100)) }
    xhr.onload = () => {
      setUploading(false); setProgress(0)
      let d: { error?: string } = {}; try { d = JSON.parse(xhr.responseText) } catch {}
      if (xhr.status >= 200 && xhr.status < 300) {
        toast.success('App published — download button is live')
        setFile(null); setVersion(''); if (fileRef.current) fileRef.current.value = ''; load()
      } else toast.error(d.error || 'Upload failed')
    }
    xhr.onerror = () => { setUploading(false); setProgress(0); toast.error('Upload failed. Please try again.') }
    xhr.send(fd)
  }

  const remove = async () => {
    if (!window.confirm('Remove the app download from the home page?')) return
    const r = await fetch('/api/admin/app?action=remove', { method: 'POST' })
    if (r.ok) { toast.success('Removed'); load() } else toast.error('Could not remove')
  }

  return (
    <div className="geo-card p-4 max-w-xl mb-6">
      <div className="text-sm font-semibold text-slate-900 mb-1">Mobile App (Android APK)</div>
      <p className="text-xs text-muted-foreground mb-3">Upload your .apk — a “Download App” button appears on the home page.</p>

      {apk.apkPath && (
        <div className="mb-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
          <span>Live: <a href={apk.apkPath} download className="font-semibold underline">current APK</a>{apk.apkVersion ? ` · ${apk.apkVersion}` : ''}</span>
          <button onClick={remove} className="text-red-600 inline-flex items-center gap-1 hover:underline shrink-0"><Trash2 className="w-3.5 h-3.5" /> Remove</button>
        </div>
      )}

      <button onClick={() => fileRef.current?.click()} disabled={uploading} className="w-full border-2 border-dashed border-border rounded-xl p-4 text-center hover:border-primary transition disabled:opacity-60">
        <UploadCloud className="w-5 h-5 mx-auto text-primary" />
        <div className="text-xs text-slate-600 mt-1.5">{file ? file.name : 'Tap to choose .apk (max 100MB)'}</div>
      </button>
      <input ref={fileRef} type="file" accept=".apk,application/vnd.android.package-archive" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      <input value={version} onChange={(e) => setVersion(e.target.value)} disabled={uploading} placeholder="Version (optional, e.g. v1.0.0)"
        className="w-full mt-2 px-3 py-2.5 rounded-xl border border-border bg-card text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition disabled:opacity-60" />

      {uploading ? (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs font-medium text-slate-600 mb-1.5">
            <span className="inline-flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />{progress < 100 ? 'Uploading…' : 'Publishing…'}</span>
            <span className="tabular-nums">{progress}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
            <div className={`h-full geo-gradient rounded-full transition-all duration-200 ${progress >= 100 ? 'animate-pulse' : ''}`} style={{ width: `${Math.max(4, progress)}%` }} />
          </div>
        </div>
      ) : (
        <button onClick={upload} className="mt-3 px-4 py-2.5 rounded-xl geo-gradient text-white text-sm font-semibold inline-flex items-center gap-2 hover:opacity-95 transition">
          <UploadCloud className="w-4 h-4" /> Upload APK
        </button>
      )}
    </div>
  )
}

function SettingsTab() {
  const [s, setS] = useState<SettingsData | null>(null)
  const [saving, setSaving] = useState(false)
  const [packagesText, setPackagesText] = useState('')

  useEffect(() => {
    fetch('/api/admin/settings', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        setS(d.settings)
        try {
          setPackagesText(JSON.parse(d.settings.loanPackages).join(','))
        } catch {
          setPackagesText('8000,14000,18500,24000')
        }
      })
      .catch(() => {})
  }, [])

  const save = async () => {
    if (!s) return
    setSaving(true)
    try {
      const packages = JSON.stringify(packagesText.split(',').map((x) => parseInt(x.trim())).filter((n) => !isNaN(n) && n > 0))
      const r = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...s, loanPackages: packages }),
      })
      const d = await r.json()
      if (!r.ok) return toast.error(d.error || 'Failed')
      toast.success('Settings saved')
    } finally {
      setSaving(false)
    }
  }

  if (!s) return <Loading />

  return (
    <div>
      <PageTitle icon={SettingsIcon} title="Settings" subtitle="Configure company account, loan packages & admin credentials" />

      <div className="mt-5"><AppApkUploader /></div>

      <div className="mt-6 grid md:grid-cols-2 gap-4">
        {/* Company Account */}
        <div className="geo-card p-6">
          <h3 className="font-bold text-sm text-slate-900 mb-4 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary grid place-items-center">
              <Landmark className="w-4 h-4" />
            </span>
            Company Bank Account
          </h3>
          <div className="space-y-3">
            <SettingField label="Bank Name" value={s.bankName} onChange={(v) => setS({ ...s, bankName: v })} />
            <SettingField label="Account Title" value={s.accountTitle} onChange={(v) => setS({ ...s, accountTitle: v })} />
            <SettingField label="Account Number" value={s.accountNumber} onChange={(v) => setS({ ...s, accountNumber: v })} />
            <SettingField label="EasyPaisa / JazzCash" value={s.mobileAccount} onChange={(v) => setS({ ...s, mobileAccount: v })} />
          </div>
        </div>

        {/* Loan Config */}
        <div className="geo-card p-6">
          <h3 className="font-bold text-sm text-slate-900 mb-4 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 grid place-items-center">
              <Coins className="w-4 h-4" />
            </span>
            Loan Configuration
          </h3>
          <div className="space-y-3">
            <SettingField
              label="Markup %"
              type="number"
              value={String(s.markupPercent)}
              onChange={(v) => setS({ ...s, markupPercent: parseFloat(v) || 0 })}
            />
            <SettingField
              label="Down Payment %"
              type="number"
              value={String(s.downPaymentPercent)}
              onChange={(v) => setS({ ...s, downPaymentPercent: parseFloat(v) || 0 })}
            />
            <SettingField
              label="Loyalty: reduce markup by % per repaid loan"
              type="number"
              value={String(s.loyaltyDiscountPerLoan ?? 1)}
              onChange={(v) => setS({ ...s, loyaltyDiscountPerLoan: parseFloat(v) || 0 })}
            />
            <SettingField
              label="Minimum markup % (loyalty floor)"
              type="number"
              value={String(s.minMarkupPercent ?? 2)}
              onChange={(v) => setS({ ...s, minMarkupPercent: parseFloat(v) || 0 })}
            />
            <SettingField
              label="Loan Packages (comma-separated PKR amounts)"
              value={packagesText}
              onChange={setPackagesText}
            />
          </div>
        </div>

        {/* Admin Credentials */}
        <div className="geo-card p-6 md:col-span-2">
          <h3 className="font-bold text-sm text-slate-900 mb-4 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary grid place-items-center">
              <KeyRound className="w-4 h-4" />
            </span>
            Admin Credentials
          </h3>
          <div className="grid md:grid-cols-2 gap-3">
            <SettingField label="Admin Phone" value={s.adminPhone} onChange={(v) => setS({ ...s, adminPhone: v })} />
            <SettingField label="Admin Password" value={s.adminPassword} onChange={(v) => setS({ ...s, adminPassword: v })} />
          </div>
          <p className="text-xs text-muted-foreground bg-muted border border-border rounded-lg px-3 py-2 mt-4">
            Admin Phone and Password are the console login. Enter a new password to change it (stored encrypted);
            leave the password field blank to keep the current one.
          </p>
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="mt-6 px-5 py-2.5 rounded-xl geo-gradient text-white font-semibold disabled:opacity-60 inline-flex items-center gap-2 shadow-sm hover:opacity-95 transition"
      >
        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
        Save Settings
      </button>
    </div>
  )
}

// ============ HELPERS ============
function PageTitle({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl geo-gradient text-white grid place-items-center shadow-sm">
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="geo-rule-gold w-14 mt-3.5 ml-0.5" />
    </div>
  )
}

function Loading() {
  return (
    <div className="py-12 grid place-items-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  )
}

function EmptyState({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="py-16 text-center text-muted-foreground">
      <Icon className="w-10 h-10 mx-auto mb-3 opacity-30" />
      <div className="text-sm">{text}</div>
    </div>
  )
}

function SettingField({
  label, value, onChange, type = 'text',
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition"
      />
    </div>
  )
}

function statusColor(s: string) {
  if (s === 'PENDING') return 'bg-amber-50 text-amber-600 border-amber-200'
  if (s === 'APPROVED') return 'bg-emerald-50 text-emerald-600 border-emerald-200'
  if (s === 'REJECTED') return 'bg-red-50 text-red-600 border-red-200'
  return 'bg-muted text-slate-600 border-border'
}

function kycColor(s: string) {
  if (s === 'APPROVED') return 'bg-emerald-50 text-emerald-600 border-emerald-200'
  if (s === 'SUBMITTED') return 'bg-amber-50 text-amber-600 border-amber-200'
  if (s === 'REJECTED') return 'bg-red-50 text-red-600 border-red-200'
  return 'bg-muted text-slate-600 border-border'
}

function loanStatusColor(s: string) {
  const map: Record<string, string> = {
    APPROVED: 'bg-primary/10 text-primary border-primary/20',
    DOWN_PAYMENT_APPROVED: 'bg-amber-50 text-amber-600 border-amber-200',
    INST1_APPROVED: 'bg-primary/10 text-primary border-primary/20',
    WITHDRAWN: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    REPAID: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    REJECTED: 'bg-red-50 text-red-600 border-red-200',
  }
  return map[s] || 'bg-muted text-slate-600 border-border'
}
