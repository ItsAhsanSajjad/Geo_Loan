'use client'

import { useEffect, useState, useCallback, useRef, type ComponentType } from 'react'
import { toast } from 'sonner'
import {
  Loader2, LogOut, Bell, Upload, Copy, CheckCircle2, AlertCircle,
  Wallet, ArrowLeft, ArrowRight, ShieldCheck, ChevronRight, Phone,
  User as UserIcon, Lock, ChevronLeft, BadgeCheck, Clock,
  Banknote, Building2, Camera, CreditCard, IdCard, Smartphone,
  ClipboardList, Send, Info, ListChecks, Home, Eye, EyeOff, HelpCircle, KeyRound, ChevronDown, X, RefreshCw,
} from 'lucide-react'
import { BrandLogo, TAGLINE_UR, TAGLINE_EN } from '@/components/brand/logo'
import { KycVerifying } from '@/components/app/kyc-verifying'
import {
  normalizePhone, isValidPhone, PHONE_HINT, PHONE_LENGTH,
  formatCnic, isValidCnic, CNIC_HINT, isValidName, sanitizeName, isValidPassword,
  normalizeAccount, isValidAccount, SECURITY_QUESTIONS, isValidAnswer,
  isValidEmail, isAdult, extractCnicCandidates, cnicFuzzyEqual,
  looksLikeCnicBack, looksLikeDocument,
} from '@/lib/validation'

// ============ TYPES ============
interface MeUser {
  id: string
  phone: string
  role: string
  fullName: string | null
  cnic: string | null
  email: string | null
  dob: string | null
  address: string | null
  kycStatus: string
  kycNote: string | null
  kycSubmittedAt: string | null
  walletBalance: number
  withdrawUnlocked: boolean
  currentLoanId: string | null
  repaidLoans?: number
  mustChangePassword?: boolean
}
interface Loan {
  id: string
  amount: number
  markupPercent: number
  totalRepayment: number
  weeklyInstallment: number
  downPayment: number
  termWeeks: number
  status: string
  installments: { id: string; weekNumber: number; amount: number; status: string; dueDate: string }[]
}
interface PendingPayment {
  id: string
  type: string
  amount: number
  status: string
  createdAt: string
}
interface Settings {
  bankName: string
  accountTitle: string
  accountNumber: string
  mobileAccount: string
  markupPercent: number
  downPaymentPercent: number
  loyaltyDiscountPerLoan?: number
  minMarkupPercent?: number
  loanPackages: string
  maintenanceMode?: boolean
  maintenanceMessage?: string | null
}
interface NotificationItem {
  id: string
  title: string
  message: string
  type: string
  read: boolean
  createdAt: string
}

// ============ COMPONENT ============
export default function UserApp() {
  const [user, setUser] = useState<MeUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [authView, setAuthView] = useState<'login' | 'register'>('login')

  const refresh = useCallback(async () => {
    const r = await fetch('/api/auth/me', { cache: 'no-store' })
    const d = await r.json()
    setUser(d.user || null)
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

  if (!user) {
    return <AuthScreen view={authView} setView={setAuthView} onAuthed={refresh} />
  }

  if (user.role === 'ADMIN') {
    return (
      <div className="min-h-screen grid place-items-center geo-surface p-4">
        <div className="max-w-md w-full geo-card rounded-2xl p-7 text-center">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-primary/10 grid place-items-center">
            <ShieldCheck className="w-6 h-6 text-primary" />
          </div>
          <h2 className="font-bold text-xl mt-4 text-slate-900">Admin Account Detected</h2>
          <p className="text-sm text-slate-600 mt-1.5">This account is for admin access. Please use the admin panel.</p>
          <div className="mt-5 flex flex-col gap-2">
            <a href="/admin" className="geo-gradient text-white px-4 py-2.5 rounded-xl font-semibold shadow-sm hover:opacity-95 transition">Go to Admin Panel</a>
            <LogoutBtn />
          </div>
        </div>
      </div>
    )
  }

  return <AppShell user={user} refresh={refresh} />
}

// Password input with a show/hide toggle.
function PwInput({
  value, onChange, placeholder, onEnter, autoComplete,
}: {
  value: string; onChange: (v: string) => void; placeholder: string;
  onEnter?: () => void; autoComplete?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onKeyDown={(e) => { if (e.key === 'Enter' && onEnter) onEnter() }}
        className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none text-sm transition"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  )
}

// ============ AUTH SCREEN ============
function AuthScreen({
  view, setView, onAuthed,
}: {
  view: 'login' | 'register'
  setView: (v: 'login' | 'register') => void
  onAuthed: () => Promise<any>
}) {
  const [phone, setPhone] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [securityQuestion, setSecurityQuestion] = useState(SECURITY_QUESTIONS[0])
  const [securityAnswer, setSecurityAnswer] = useState('')
  const [loading, setLoading] = useState(false)

  // Forgot-password (security-question reset): step 'phone' -> 'reset'
  const [forgot, setForgot] = useState(false)
  const [fStep, setFStep] = useState<'phone' | 'reset'>('phone')
  const [fQuestion, setFQuestion] = useState('')
  const [fAnswer, setFAnswer] = useState('')

  const switchView = (v: 'login' | 'register') => {
    setView(v); setPassword(''); setConfirmPassword(''); setForgot(false); setFStep('phone'); setFAnswer('')
  }

  const doLogin = async () => {
    if (!isValidPhone(phone)) return toast.error(PHONE_HINT)
    if (!password) return toast.error('Enter your password')
    setLoading(true)
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      })
      const d = await r.json()
      if (!r.ok) return toast.error(d.error || 'Login failed')
      toast.success('Welcome back!'); await onAuthed()
    } finally { setLoading(false) }
  }

  const doRegister = async () => {
    if (!isValidName(fullName)) return toast.error('Please enter your full name')
    if (!isValidPhone(phone)) return toast.error(PHONE_HINT)
    if (!isValidPassword(password)) return toast.error('Password must be at least 8 characters')
    if (password !== confirmPassword) return toast.error('Passwords do not match')
    if (!isValidAnswer(securityAnswer)) return toast.error('Please answer the security question')
    setLoading(true)
    try {
      const r = await fetch('/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password, confirmPassword, fullName, securityQuestion, securityAnswer }),
      })
      const d = await r.json()
      if (!r.ok) return toast.error(d.error || 'Could not create account')
      toast.success('Account created! Please log in to continue.')
      setPassword(''); setConfirmPassword('')
      switchView('login') // send the new user to Login (phone stays filled); after login -> KYC
    } finally { setLoading(false) }
  }

  // Forgot: look up the user's security question
  const fetchQuestion = async () => {
    if (!isValidPhone(phone)) return toast.error(PHONE_HINT)
    setLoading(true)
    try {
      const r = await fetch('/api/auth/forgot/question', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const d = await r.json()
      if (!r.ok) return toast.error(d.error || 'Could not find your account')
      setFQuestion(d.question); setFAnswer(''); setPassword(''); setConfirmPassword(''); setFStep('reset')
    } finally { setLoading(false) }
  }

  // Forgot: verify answer and set a new password (logs in on success)
  const doReset = async () => {
    if (!isValidAnswer(fAnswer)) return toast.error('Please answer the security question')
    if (!isValidPassword(password)) return toast.error('Password must be at least 8 characters')
    if (password !== confirmPassword) return toast.error('Passwords do not match')
    setLoading(true)
    try {
      const r = await fetch('/api/auth/forgot/reset', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, answer: fAnswer, password, confirmPassword }),
      })
      const d = await r.json()
      if (!r.ok) return toast.error(d.error || 'Could not reset password')
      toast.success('Password reset! Signing you in…'); await onAuthed()
    } finally { setLoading(false) }
  }

  const inputCls = 'w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none text-sm transition'

  return (
    <div className="min-h-screen geo-surface grid place-items-center p-4">
      <div className="phone-shell">
        <div className="bg-white px-7 pt-8 pb-6 text-center border-b border-slate-200 relative">
          <div className="flex justify-center">
            <BrandLogo height={52} />
          </div>
          <div className="mt-4 flex flex-col items-center gap-1">
            <span dir="rtl" className="font-urdu text-sm font-semibold text-primary">{TAGLINE_UR}</span>
            <span className="text-[11px] text-slate-500">{TAGLINE_EN}</span>
          </div>
          <div className="geo-rule-gold mt-4 mx-auto w-24" />
        </div>

        <div className="p-6">
          <div className="flex bg-slate-100 rounded-xl p-1 mb-6">
            <button
              onClick={() => switchView('login')}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${view === 'login' ? 'bg-white shadow-sm text-primary' : 'text-slate-600'}`}
            >
              Login
            </button>
            <button
              onClick={() => switchView('register')}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${view === 'register' ? 'bg-white shadow-sm text-primary' : 'text-slate-600'}`}
            >
              Register
            </button>
          </div>

          {/* ---------------- LOGIN ---------------- */}
          {view === 'login' && !forgot && (
            <>
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input value={phone} onChange={(e) => setPhone(normalizePhone(e.target.value))}
                    placeholder="03001234567" type="tel" inputMode="numeric" maxLength={PHONE_LENGTH} className={inputCls} />
                </div>
              </div>
              <div className="mb-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
                <PwInput value={password} onChange={setPassword} placeholder="Enter your password" onEnter={doLogin} autoComplete="current-password" />
              </div>
              <div className="mb-5 text-right">
                <button onClick={() => { setForgot(true); setFStep('phone') }} className="text-xs font-semibold text-primary hover:underline">
                  Forgot password?
                </button>
              </div>
              <button onClick={doLogin} disabled={loading}
                className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm hover:opacity-95 transition">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />} Login
              </button>
            </>
          )}

          {/* ---------------- FORGOT PASSWORD ---------------- */}
          {view === 'login' && forgot && (
            <>
              <div className="text-center mb-4">
                <span className="inline-grid place-items-center w-12 h-12 rounded-full bg-primary/10">
                  <KeyRound className="w-6 h-6 text-primary" />
                </span>
                <h3 className="font-bold text-slate-900 mt-2">Reset your password</h3>
                <p className="text-xs text-slate-500 mt-0.5">Answer your security question — no code needed.</p>
              </div>

              {fStep === 'phone' && (
                <>
                  <div className="mb-6">
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input value={phone} onChange={(e) => setPhone(normalizePhone(e.target.value))}
                        placeholder="03001234567" type="tel" inputMode="numeric" maxLength={PHONE_LENGTH} className={inputCls} />
                    </div>
                  </div>
                  <button onClick={fetchQuestion} disabled={loading}
                    className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm hover:opacity-95 transition">
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />} Continue
                  </button>
                </>
              )}

              {fStep === 'reset' && (
                <>
                  <div className="mb-4 p-2.5 rounded-xl bg-primary/5 border border-primary/15 text-xs text-slate-700 flex gap-2">
                    <HelpCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span>{fQuestion}</span>
                  </div>
                  <div className="mb-4">
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Your Answer</label>
                    <div className="relative">
                      <HelpCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input value={fAnswer} onChange={(e) => setFAnswer(e.target.value)}
                        placeholder="Answer to your security question" className={inputCls} />
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">New Password</label>
                    <PwInput value={password} onChange={setPassword} placeholder="At least 8 characters" autoComplete="new-password" />
                  </div>
                  <div className="mb-6">
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Confirm New Password</label>
                    <PwInput value={confirmPassword} onChange={setConfirmPassword} placeholder="Re-enter new password" onEnter={doReset} autoComplete="new-password" />
                    {confirmPassword.length > 0 && password !== confirmPassword && (
                      <p className="mt-1 text-[11px] text-amber-600">Passwords do not match</p>
                    )}
                  </div>
                  <button onClick={doReset} disabled={loading}
                    className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm hover:opacity-95 transition">
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />} Reset Password
                  </button>
                </>
              )}

              <div className="mt-4 text-center">
                <button onClick={() => { setForgot(false); setFStep('phone') }} className="text-xs text-slate-500 hover:text-primary inline-flex items-center gap-1">
                  <ArrowLeft className="w-3 h-3" /> Back to login
                </button>
              </div>
            </>
          )}

          {/* ---------------- REGISTER ---------------- */}
          {view === 'register' && (
            <>
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Full Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input value={fullName} onChange={(e) => setFullName(sanitizeName(e.target.value))}
                    placeholder="Enter your full name" className={inputCls} />
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input value={phone} onChange={(e) => setPhone(normalizePhone(e.target.value))}
                    placeholder="03001234567" type="tel" inputMode="numeric" maxLength={PHONE_LENGTH} className={inputCls} />
                </div>
                {phone.length > 0 && !isValidPhone(phone) && (
                  <p className="mt-1 text-[11px] text-amber-600">{PHONE_HINT}</p>
                )}
              </div>
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
                <PwInput value={password} onChange={setPassword} placeholder="At least 8 characters" autoComplete="new-password" />
              </div>
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Confirm Password</label>
                <PwInput value={confirmPassword} onChange={setConfirmPassword} placeholder="Re-enter your password" autoComplete="new-password" />
                {confirmPassword.length > 0 && password !== confirmPassword && (
                  <p className="mt-1 text-[11px] text-amber-600">Passwords do not match</p>
                )}
              </div>
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Security Question</label>
                <div className="relative">
                  <HelpCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select value={securityQuestion} onChange={(e) => setSecurityQuestion(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none text-sm transition appearance-none">
                    {SECURITY_QUESTIONS.map((q) => <option key={q} value={q}>{q}</option>)}
                  </select>
                </div>
              </div>
              <div className="mb-6">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Security Answer</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input value={securityAnswer} onChange={(e) => setSecurityAnswer(e.target.value)}
                    placeholder="Used if you forget your password" onKeyDown={(e) => e.key === 'Enter' && doRegister()} className={inputCls} />
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500">You&apos;ll answer this to reset your password if you forget it.</p>
              </div>
              <button onClick={doRegister} disabled={loading}
                className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm hover:opacity-95 transition">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />} Create Account
              </button>
            </>
          )}

          {!forgot && (
            <div className="mt-6 p-3 bg-primary/5 border border-primary/15 rounded-xl text-xs text-slate-700 flex gap-2">
              <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span>
                {view === 'login'
                  ? 'Log in with your phone and password. New here? Tap Register.'
                  : 'Create your account with your name, phone, and a password. After login, complete KYC to apply for a loan.'}
              </span>
            </div>
          )}

          <div className="mt-4 text-center">
            <a href="/" className="text-xs text-slate-500 hover:text-primary inline-flex items-center gap-1 transition">
              <ArrowLeft className="w-3 h-3" /> Back to home
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============ MAINTENANCE / FORCED PASSWORD CHANGE ============
function MaintenanceScreen({ message }: { message?: string | null }) {
  return (
    <div className="min-h-screen geo-surface grid place-items-center p-6">
      <div className="bg-white rounded-2xl p-8 text-center max-w-sm shadow-sm border border-slate-200">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 grid place-items-center mx-auto mb-4">
          <Clock className="w-8 h-8 text-amber-600" />
        </div>
        <h1 className="text-lg font-bold text-slate-900">System Under Maintenance</h1>
        <p className="text-sm text-slate-500 mt-2">
          {message || 'We are performing scheduled maintenance. Please check back shortly.'}
        </p>
        <a href="/" className="inline-block mt-5 text-xs text-slate-500 hover:text-primary">Back to home</a>
      </div>
    </div>
  )
}

function ForceChangePassword({ onDone }: { onDone: () => Promise<void> }) {
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    setError('')
    if (pw.length < 6) { setError('Password must be at least 6 characters'); return }
    if (pw !== confirm) { setError('Passwords do not match'); return }
    setLoading(true)
    try {
      const r = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: pw }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setError(d.error || 'Failed to update password'); return }
      toast.success('Password updated')
      await onDone()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full rounded-xl border border-slate-300 pl-9 pr-10 py-2.5 text-sm outline-none focus:border-primary'
  return (
    <div className="min-h-screen geo-surface grid place-items-center p-6">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-sm border border-slate-200">
        <div className="w-12 h-12 rounded-xl bg-primary/10 grid place-items-center mx-auto mb-3">
          <KeyRound className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-base font-bold text-slate-900 text-center">Set a New Password</h1>
        <p className="text-xs text-slate-500 text-center mt-1 mb-4">
          Your password was reset by an administrator. Choose a new one to continue.
        </p>
        <div className="space-y-3">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type={show ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" className={inputCls} />
            <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type={show ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm new password" className={inputCls} onKeyDown={(e) => e.key === 'Enter' && submit()} />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button onClick={submit} disabled={loading} className="w-full rounded-xl bg-primary text-primary-foreground font-semibold py-2.5 text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />} Update password
          </button>
        </div>
      </div>
    </div>
  )
}

// ============ APP SHELL ============
function AppShell({ user, refresh }: { user: MeUser; refresh: () => Promise<any> }) {
  const [screen, setScreen] = useState<string>('home')
  const [loan, setLoan] = useState<Loan | null>(null)
  const [pending, setPending] = useState<PendingPayment | null>(null)
  const [outstanding, setOutstanding] = useState(0)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [showNotifications, setShowNotifications] = useState(false)

  const loadData = useCallback(async () => {
    let loanR: any, pendR: any, notifR: any
    try {
      [loanR, pendR, notifR] = await Promise.all([
        fetch('/api/loan/current', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/payment/pending', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/notifications', { cache: 'no-store' }).then((r) => r.json()),
      ])
    } catch {
      return // transient network/server blip — keep current state, try again next time
    }
    if (loanR.loan) setLoan(loanR.loan)
    else setLoan(null)
    setPending(loanR.pendingPayment || pendR.pending || null)
    setOutstanding(loanR.outstanding ?? 0)
    setNotifications(notifR.notifications || [])
    if (loanR.loan) {
      const status = loanR.loan.status as string
      if (status === 'WITHDRAWN') setScreen('dashboard')
      // Withdraw screen only for THIS loan's withdraw states — never a stale per-user flag
      else if (status === 'WITHDRAW_PENDING' || status === 'INST1_APPROVED') setScreen('withdraw_ready')
      else if (status === 'DOWN_PAYMENT_APPROVED') {
        if (loanR.pendingPayment) setScreen('pending')
        else setScreen('installment_payment')
      }
      else if (status === 'APPROVED') {
        if (loanR.pendingPayment) setScreen('pending')
        else setScreen('wallet')
      }
    } else if (user.kycStatus === 'APPROVED') {
      setScreen('loan_select')
    } else if (user.kycStatus === 'SUBMITTED') {
      setScreen('kyc_pending')
    } else {
      setScreen('kyc')
    }
  }, [user.kycStatus])

  const loadSettings = useCallback(() => {
    fetch('/api/settings', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => d.settings && setSettings(d.settings))
      .catch(() => {})
  }, [])

  useEffect(() => {
    loadSettings()
    loadData()
    // Keep settings live — reflect admin changes (loan amounts, bank/title) without a manual reload.
    const t = setInterval(loadSettings, 15000)
    return () => clearInterval(t)
  }, [loadData, loadSettings])

  // Poll when pending
  useEffect(() => {
    if (!pending) return
    const t = setInterval(async () => {
      const r = await fetch('/api/payment/pending', { cache: 'no-store' })
      const d = await r.json()
      const newPending = d.pending || null
      const recent = d.recent || []
      if (!newPending && recent.length > 0) {
        const last = recent[0]
        if (last.status === 'APPROVED') {
          toast.success('Payment approved! Your balance has been updated.')
        } else if (last.status === 'REJECTED') {
          toast.error(`Payment rejected. ${last.adminNote || 'Please re-upload.'}`)
        }
        await refresh()
        await loadData()
      } else {
        setPending(newPending)
      }
    }, 5000)
    return () => clearInterval(t)
  }, [pending, refresh, loadData])

  const stepMap: Record<string, number> = {
    kyc: 0, kyc_pending: 1, loan_select: 2, wallet: 3,
    down_payment: 3, pending: 3, installment_payment: 3, withdraw_ready: 4,
    dashboard: 4,
  }
  const currentStep = stepMap[screen] ?? 0
  const steps = ['KYC', 'Verify', 'Loan', 'Pay', 'Withdraw']

  // A super-admin password reset forces a change before anything else.
  if (user.mustChangePassword) {
    return <ForceChangePassword onDone={async () => { await refresh(); await loadData() }} />
  }
  // App-wide maintenance: regular users are blocked; only super admins can use the app.
  if (settings?.maintenanceMode) {
    return <MaintenanceScreen message={settings.maintenanceMessage} />
  }

  return (
    <div className="min-h-screen geo-surface">
      <div className="phone-shell">
        <div className="bg-white relative">
          <div className="flex items-center justify-between px-5 pt-4 pb-3">
            <BrandLogo height={32} />
            <button
              onClick={() => setShowNotifications(true)}
              className="relative w-9 h-9 grid place-items-center rounded-xl bg-primary/10 text-primary hover:bg-primary/15 transition"
            >
              <Bell className="w-4 h-4" />
              {notifications.filter((n) => !n.read).length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] grid place-items-center font-bold">
                  {notifications.filter((n) => !n.read).length}
                </span>
              )}
            </button>
          </div>
          <div className="geo-gradient text-white px-5 py-4">
            <div className="text-xs text-white/75">Welcome back,</div>
            <div className="font-semibold text-base">{user.fullName || user.phone}</div>
            <span dir="rtl" className="font-urdu mt-1 block text-xs text-gold">{TAGLINE_UR}</span>
          </div>
        </div>

        <div className="flex justify-between px-4 py-3 bg-white border-b border-slate-200">
          {steps.map((s, i) => (
            <div key={s} className="flex flex-col items-center text-[9px]">
              <div
                className={`w-7 h-7 rounded-full grid place-items-center text-[11px] font-bold transition ${
                  i < currentStep
                    ? 'bg-primary text-primary-foreground'
                    : i === currentStep
                    ? 'bg-primary text-primary-foreground ring-2 ring-primary/30'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                {i < currentStep ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className={`mt-1 ${i === currentStep ? 'text-primary font-semibold' : 'text-slate-400'}`}>{s}</span>
            </div>
          ))}
        </div>

        <div className="p-4 min-h-[500px]">
          {screen === 'kyc' && <KYCScreen user={user} settings={settings} onDone={async () => { await refresh(); await loadData() }} />}
          {screen === 'kyc_pending' && <KYCPendingScreen user={user} onApproved={async () => { await refresh(); await loadData() }} />}
          {screen === 'loan_select' && <LoanSelectScreen user={user} settings={settings} onLoan={async () => { await refresh(); await loadData() }} />}
          {screen === 'wallet' && loan && (
            <WalletScreen user={user} loan={loan} settings={settings} onAttemptWithdraw={() => setScreen('down_payment')} />
          )}
          {screen === 'down_payment' && loan && (
            <DownPaymentScreen loan={loan} settings={settings} onSubmitted={() => loadData()} onBack={() => setScreen('wallet')} />
          )}
          {screen === 'pending' && pending && (
            <PendingScreen pending={pending} onResolved={async () => { await refresh(); await loadData() }} />
          )}
          {screen === 'installment_payment' && loan && (
            <InstallmentPaymentScreen loan={loan} settings={settings} onSubmitted={() => loadData()} />
          )}
          {screen === 'withdraw_ready' && loan && (
            <WithdrawReadyScreen user={user} loan={loan} onWithdrawn={async () => { await refresh(); await loadData() }} />
          )}
          {screen === 'dashboard' && loan && <DashboardScreen loan={loan} user={user} outstanding={outstanding} pending={pending} onRepay={() => setScreen('repay')} />}
          {screen === 'repay' && loan && (
            <RepayScreen loan={loan} settings={settings} outstanding={outstanding} onSubmitted={() => loadData()} onBack={() => setScreen('dashboard')} />
          )}
        </div>

        <div className="border-t border-slate-200 p-3 flex items-center justify-between bg-white">
          <button
            onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/app' }}
            className="text-xs text-slate-500 hover:text-red-600 inline-flex items-center gap-1 transition"
          >
            <LogOut className="w-3.5 h-3.5" /> Logout
          </button>
          <a href="/" className="text-xs text-slate-500 hover:text-primary inline-flex items-center gap-1 transition">
            <Home className="w-3.5 h-3.5" /> Home
          </a>
        </div>
      </div>

      {showNotifications && (
        <NotifDrawer
          notifications={notifications}
          onClose={() => setShowNotifications(false)}
          onMarkRead={async () => {
            // mark read + refresh ONLY notifications (not a full re-route, which would
            // yank the user off the withdrawal Transaction-ID screen)
            await fetch('/api/notifications', { method: 'POST' }).catch(() => {})
            try {
              const r = await fetch('/api/notifications', { cache: 'no-store' })
              const d = await r.json()
              setNotifications(d.notifications || [])
            } catch {}
          }}
        />
      )}
    </div>
  )
}

// ============ KYC SCREEN ============
function KYCScreen({ user, settings, onDone }: { user: MeUser; settings: Settings | null; onDone: () => Promise<void> }) {
  const [fullName, setFullName] = useState(user.fullName || '')
  const [cnic, setCnic] = useState(user.cnic || '')
  const [email, setEmail] = useState(user.email || '')
  const [dob, setDob] = useState(user.dob || '')
  const [address, setAddress] = useState(user.address || '')
  const [phone] = useState(user.phone)
  const [frontPath, setFrontPath] = useState<string | null>(null)
  const [backPath, setBackPath] = useState<string | null>(null)
  const [selfiePath, setSelfiePath] = useState<string | null>(null)
  const [frontVerifying, setFrontVerifying] = useState(false)
  const [backVerifying, setBackVerifying] = useState(false)
  const [selfieVerifying, setSelfieVerifying] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Free, in-browser OCR (no server cost / no native deps).
  const ocrText = async (file: File): Promise<string> => {
    const Tesseract = (await import('tesseract.js')).default
    const { data } = await Tesseract.recognize(file, 'eng')
    return data.text || ''
  }

  // FRONT — advisory OCR only (never blocks). Auto-fills CNIC if blank.
  const verifyFront = async (file: File) => {
    setFrontVerifying(true)
    try {
      const candidates = extractCnicCandidates(await ocrText(file))
      if (candidates.length > 0 && !isValidCnic(cnic)) setCnic(formatCnic(candidates[0]))
      toast.success(candidates.length > 0 ? 'CNIC front verified ✓' : 'CNIC front uploaded — our team will verify it')
    } catch {
      toast.success('CNIC front uploaded — our team will verify it')
    } finally {
      setFrontVerifying(false)
    }
  }

  // BACK — advisory OCR only (never blocks).
  const verifyBack = async (file: File) => {
    setBackVerifying(true)
    try {
      const text = await ocrText(file)
      const ok = looksLikeCnicBack(text) || (isValidCnic(cnic) && extractCnicCandidates(text).some((c) => cnicFuzzyEqual(c, cnic)))
      toast.success(ok ? 'CNIC back verified ✓' : 'CNIC back uploaded — our team will verify it')
    } catch {
      toast.success('CNIC back uploaded — our team will verify it')
    } finally {
      setBackVerifying(false)
    }
  }

  // Count faces with a free, self-hosted detector (advisory only).
  const countFaces = async (file: File): Promise<number> => {
    try {
      const faceapi = await import('@vladmandic/face-api')
      if (!faceapi.nets.tinyFaceDetector.params) {
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models')
      }
      const img = await faceapi.bufferToImage(file)
      const dets = await faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
      return dets.length
    } catch (e) {
      console.warn('[kyc] face detection unavailable', e)
      return -1
    }
  }

  // SELFIE — advisory only (never blocks); nudges if it looks like a document.
  const verifySelfie = async (file: File) => {
    setSelfieVerifying(true)
    try {
      const isDoc = looksLikeDocument(await ocrText(file))
      const faces = await countFaces(file)
      if (isDoc && faces < 1) toast.message('Tip: please upload a selfie of your face (not a document).')
      toast.success(faces >= 1 ? 'Selfie verified ✓' : 'Selfie uploaded — our team will verify it')
    } catch {
      toast.success('Selfie uploaded — our team will verify it')
    } finally {
      setSelfieVerifying(false)
    }
  }

  // Upload to the server, ACCEPT immediately (set the path), then run advisory OCR.
  const uploadFile = async (file: File, kind: 'front' | 'back' | 'selfie') => {
    const fd = new FormData()
    fd.append('file', file)
    const r = await fetch('/api/upload/kyc', { method: 'POST', body: fd })
    const d = await r.json()
    if (!r.ok) return toast.error(d.error || 'Upload failed')
    if (kind === 'front') { setFrontPath(d.path); verifyFront(file) }
    else if (kind === 'back') { setBackPath(d.path); verifyBack(file) }
    else { setSelfiePath(d.path); verifySelfie(file) }
  }

  const submit = async () => {
    if (!fullName || !cnic || !frontPath || !backPath || !selfiePath) {
      return toast.error('Please fill all required fields and upload all documents')
    }
    if (!isValidName(fullName)) return toast.error('Please enter your full name as on your CNIC')
    if (!isValidCnic(cnic)) return toast.error(CNIC_HINT)
    if (email && !isValidEmail(email)) return toast.error('Enter a valid email address (or leave it blank)')
    if (!isAdult(dob)) return toast.error('You must be at least 18 years old')
    setSubmitting(true)
    try {
      const r = await fetch('/api/kyc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName, cnic, email, dob, address, phone,
          cnicFrontPath: frontPath, cnicBackPath: backPath, selfiePath,
        }),
      })
      const d = await r.json()
      if (!r.ok) return toast.error(d.error || 'Failed')
      toast.success('KYC submitted for verification')
      await onDone()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <SectionTitle Icon={ClipboardList} title="Registration & KYC Verification" />
      <p className="text-xs text-slate-600 mb-4 mt-2">Please fill in your details to verify your identity.</p>

      {user.kycStatus === 'REJECTED' && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">Your KYC was not approved.</div>
            {user.kycNote && <div className="mt-0.5">Reason: <strong>{user.kycNote}</strong></div>}
            <div className="mt-0.5">Please correct the details below and submit again.</div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <Field label="Full Name (as per CNIC)" value={fullName} onChange={(v) => setFullName(sanitizeName(v))} placeholder="Enter your full name" />
        <Field
          label="CNIC Number"
          value={cnic}
          onChange={(v) => setCnic(formatCnic(v))}
          placeholder="35202-1234567-1"
          inputMode="numeric"
          maxLength={15}
          hint={cnic.length > 0 && !isValidCnic(cnic) ? CNIC_HINT : undefined}
        />
        <Field label="Phone Number" value={phone} onChange={() => {}} placeholder="03001234567" disabled />
        <Field
          label="Email Address (Optional)"
          value={email}
          onChange={setEmail}
          placeholder="name@example.com"
          type="email"
          inputMode="email"
          hint={email.length > 0 && !isValidEmail(email) ? 'Enter a valid email address (e.g. name@example.com)' : undefined}
        />
        <Field
          label="Date of Birth"
          value={dob}
          onChange={setDob}
          type="date"
          hint={dob && !isAdult(dob) ? 'You must be at least 18 years old' : undefined}
        />
        <Field label="Address" value={address} onChange={setAddress} placeholder="City, Area" />
      </div>

      <SectionTitle Icon={Camera} title="CNIC Upload" className="mt-6" />
      <p className="text-[11px] text-slate-500 mt-1.5">
        Take clear, well-lit photos of your CNIC (front &amp; back) and a selfie using your camera. We auto-check what we can; our team verifies the rest.
      </p>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <UploadBox label="CNIC Front" Icon={IdCard} path={frontPath} onFile={(f) => uploadFile(f, 'front')} verifying={frontVerifying} facing="environment" />
        <UploadBox label="CNIC Back" Icon={IdCard} path={backPath} onFile={(f) => uploadFile(f, 'back')} verifying={backVerifying} facing="environment" />
      </div>
      <div className="mt-2">
        <UploadBox label="Selfie with CNIC" Icon={UserIcon} path={selfiePath} onFile={(f) => uploadFile(f, 'selfie')} wide verifying={selfieVerifying} facing="user" />
      </div>

      <button
        onClick={submit}
        disabled={submitting}
        className="w-full mt-6 bg-primary text-primary-foreground py-3 rounded-xl font-semibold disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm hover:opacity-95 transition"
      >
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
        Submit KYC for Verification
      </button>
    </div>
  )
}

function KYCPendingScreen({ user, onApproved }: { user: MeUser; onApproved: () => Promise<void> }) {
  const startTs = user.kycSubmittedAt ? new Date(user.kycSubmittedAt).getTime() : Date.now()
  const [elapsed, setElapsed] = useState(Math.max(0, Math.floor((Date.now() - startTs) / 1000)))

  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const r = await fetch('/api/auth/me', { cache: 'no-store' })
        const d = await r.json()
        if (d.user && d.user.kycStatus !== 'SUBMITTED') {
          if (d.user.kycStatus === 'APPROVED') toast.success('KYC Approved! 🎉')
          else if (d.user.kycStatus === 'REJECTED') toast.error('KYC needs changes — please review the feedback.')
          await onApproved()
        }
      } catch {}
    }, 4000)
    return () => clearInterval(t)
  }, [onApproved])

  return <KycVerifying userName={user.fullName || 'there'} elapsed={elapsed} />
}

function LoanSelectScreen({ user, settings, onLoan }: { user: MeUser; settings: Settings | null; onLoan: () => Promise<void> }) {
  const [selected, setSelected] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const packages: number[] = settings ? JSON.parse(settings.loanPackages) : [8000, 14000, 18500, 24000]
  const baseMarkup = settings?.markupPercent ?? 5
  const repaid = user.repaidLoans ?? 0
  // Loyalty: lower markup for returning customers who fully repaid (mirrors server logic)
  const markup = Math.max(settings?.minMarkupPercent ?? 2, baseMarkup - repaid * (settings?.loyaltyDiscountPerLoan ?? 1))
  const isLoyal = markup < baseMarkup

  const calc = (amt: number) => {
    const total = amt + amt * (markup / 100)
    return { total, weekly: total / 4 }
  }

  const submit = async () => {
    if (selected === null) return toast.error('Please select a loan package')
    setSubmitting(true)
    try {
      const r = await fetch('/api/loan/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: selected }),
      })
      const d = await r.json()
      if (!r.ok) return toast.error(d.error || 'Failed')
      toast.success('Loan approved! Amount credited to your wallet.')
      await onLoan()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 text-center mb-4">
        <span className="inline-grid place-items-center w-11 h-11 rounded-full geo-gradient-gold shadow-sm">
          <BadgeCheck className="w-6 h-6 text-white" />
        </span>
        <h2 className="font-bold text-primary mt-2">KYC Verified!</h2>
        <p className="text-xs text-slate-600 mt-1">You are eligible for a personal loan.</p>
      </div>

      {isLoyal && (
        <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
          <div className="text-sm font-bold text-emerald-700">🎉 Loyal customer reward</div>
          <div className="text-xs text-emerald-700/90 mt-0.5">
            You repaid {repaid} loan{repaid > 1 ? 's' : ''} — your markup is reduced to <strong>{markup}%</strong> (was {baseMarkup}%).
          </div>
        </div>
      )}

      <SectionTitle Icon={Banknote} title="Select Your Loan Amount" />

      <div className="space-y-2 mt-3">
        {packages.map((amt) => {
          const c = calc(amt)
          return (
            <button
              key={amt}
              onClick={() => setSelected(amt)}
              className={`w-full text-left p-4 rounded-2xl border-2 transition ${
                selected === amt ? 'border-primary bg-primary/5 ring-2 ring-primary/15' : 'border-slate-200 hover:border-primary/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-primary text-lg">PKR {amt.toLocaleString()}</div>
                  <div className="text-[11px] text-slate-600 mt-0.5">1 Month · 4 Weekly Installments</div>
                  <div className="text-[11px] text-amber-600 font-semibold mt-0.5">Markup: {markup}% only</div>
                </div>
                <div className="text-right text-[11px]">
                  <div className="text-slate-700">Total: <strong>PKR {Math.round(c.total).toLocaleString()}</strong></div>
                  <div className="text-slate-500 mt-0.5">PKR {Math.round(c.weekly).toLocaleString()}/week</div>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {selected !== null && (
        <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
          <div className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
            <ListChecks className="w-4 h-4 text-primary" /> Installment Plan (4 Weeks)
          </div>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex justify-between text-xs py-1.5 border-b border-slate-200 last:border-0">
              <span className="text-slate-600">Week {i + 1}</span>
              <span className="font-semibold text-slate-900">PKR {Math.round(calc(selected).weekly).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={submit}
        disabled={selected === null || submitting}
        className="w-full mt-4 bg-primary text-primary-foreground py-3 rounded-xl font-semibold disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm hover:opacity-95 transition"
      >
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
        Confirm Loan
      </button>
    </div>
  )
}

const WITHDRAW_METHODS = [
  { id: 'easypaisa', name: 'EasyPaisa', Icon: Smartphone, img: '/easypaisa.png' },
  { id: 'jazzcash', name: 'JazzCash', Icon: Smartphone, img: '/jazzcash.png' },
  { id: 'bank', name: 'Bank Transfer', Icon: Building2 },
] as const

const PAKISTANI_BANKS: { name: string; slug: string }[] = [
  { name: 'Allied Bank (ABL)', slug: 'abl' }, { name: 'Askari Bank', slug: 'askari' },
  { name: 'Bank Alfalah', slug: 'alfalah' }, { name: 'Bank Al Habib', slug: 'alhabib' },
  { name: 'Bank Islami', slug: 'bankislami' }, { name: 'Bank of Khyber', slug: 'bok' },
  { name: 'Bank of Punjab (BOP)', slug: 'bop' }, { name: 'Dubai Islamic Bank', slug: 'dib' },
  { name: 'Faysal Bank', slug: 'faysal' }, { name: 'First Women Bank', slug: 'fwbl' },
  { name: 'Habib Bank (HBL)', slug: 'hbl' }, { name: 'HabibMetro Bank', slug: 'habibmetro' },
  { name: 'JS Bank', slug: 'js' }, { name: 'MCB Bank', slug: 'mcb' },
  { name: 'MCB Islamic Bank', slug: 'mcbislamic' }, { name: 'Meezan Bank', slug: 'meezan' },
  { name: 'National Bank (NBP)', slug: 'nbp' }, { name: 'Samba Bank', slug: 'samba' },
  { name: 'Silkbank', slug: 'silk' }, { name: 'Sindh Bank', slug: 'sindh' },
  { name: 'Soneri Bank', slug: 'soneri' }, { name: 'Standard Chartered', slug: 'sc' },
  { name: 'Summit Bank', slug: 'summit' }, { name: 'United Bank (UBL)', slug: 'ubl' },
  { name: 'U Microfinance Bank', slug: 'ubank' }, { name: 'Khushhali Microfinance Bank', slug: 'khushhali' },
  { name: 'Mobilink Microfinance (JazzCash)', slug: 'mobilink' }, { name: 'Telenor Microfinance (Easypaisa)', slug: 'telenor' },
  { name: 'Al Baraka Bank', slug: 'albaraka' }, { name: 'Zarai Taraqiati Bank (ZTBL)', slug: 'ztbl' },
]

// Bank logo with a clean initials fallback when no logo file exists.
function BankLogo({ slug, name, size = 24 }: { slug: string; name: string; size?: number }) {
  const [err, setErr] = useState(false)
  if (err) {
    const initials = name.replace(/\(.*?\)/g, '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
    return (
      <span className="grid place-items-center rounded-md bg-primary/10 text-primary font-bold shrink-0"
        style={{ width: size, height: size, fontSize: size * 0.38 }}>{initials}</span>
    )
  }
  return (
    <img src={`/banks/${slug}.png`} alt="" onError={() => setErr(true)}
      className="rounded-md object-contain bg-white border border-slate-100 shrink-0" style={{ width: size, height: size }} />
  )
}

// Searchable bank dropdown that shows each bank's logo.
function BankSelect({ value, onChange }: { value: string; onChange: (b: string) => void }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const selected = PAKISTANI_BANKS.find((b) => b.name === value)
  const list = PAKISTANI_BANKS.filter((b) => b.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="mt-3">
      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Select Bank</label>
      <button type="button" onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm hover:border-primary transition">
        {selected ? (
          <><BankLogo slug={selected.slug} name={selected.name} /><span className="text-slate-800">{selected.name}</span></>
        ) : (
          <span className="text-slate-400">Choose your bank…</span>
        )}
        <ChevronDown className="w-4 h-4 text-slate-400 ml-auto shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="relative z-50">
            <div className="absolute mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
              <div className="p-2 border-b border-slate-100">
                <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search bank…"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-sm outline-none focus:border-primary" />
              </div>
              <div className="max-h-56 overflow-y-auto">
                {list.length === 0 && <div className="px-3 py-3 text-xs text-slate-400 text-center">No bank found</div>}
                {list.map((b) => (
                  <button type="button" key={b.slug} onClick={() => { onChange(b.name); setOpen(false); setQ('') }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-primary/5 transition ${value === b.name ? 'bg-primary/5' : ''}`}>
                    <BankLogo slug={b.slug} name={b.name} />
                    <span className="text-slate-700">{b.name}</span>
                    {value === b.name && <CheckCircle2 className="w-4 h-4 text-primary ml-auto shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function MethodPicker({ method, setMethod, bank, setBank }: {
  method: string; setMethod: (m: string) => void; bank: string; setBank: (b: string) => void
}) {
  return (
    <>
      <div className="grid grid-cols-3 gap-2 mt-3">
        {WITHDRAW_METHODS.map((m) => (
          <button
            key={m.id}
            onClick={() => setMethod(m.id)}
            className={`p-3 rounded-xl border-2 text-center transition ${
              method === m.id ? 'border-primary bg-primary/5 ring-2 ring-primary/15' : 'border-slate-200 hover:border-primary/50'
            }`}
          >
            {'img' in m && m.img ? (
              <img src={m.img} alt={m.name} className="h-6 w-auto mx-auto object-contain" />
            ) : (
              <m.Icon className={`w-6 h-6 mx-auto ${method === m.id ? 'text-primary' : 'text-slate-500'}`} />
            )}
            <div className="text-[11px] font-semibold mt-1.5 text-slate-700">{m.name}</div>
          </button>
        ))}
      </div>

      {method === 'bank' && <BankSelect value={bank} onChange={setBank} />}
    </>
  )
}

function WalletScreen({ user, loan, settings, onAttemptWithdraw }: {
  user: MeUser; loan: Loan; settings: Settings | null; onAttemptWithdraw: () => void
}) {
  const [method, setMethod] = useState('')
  const [account, setAccount] = useState('')
  const [bank, setBank] = useState('')

  return (
    <div>
      <SectionTitle Icon={Wallet} title="My Wallet" />
      <div className="geo-gradient-emerald text-white rounded-2xl p-5 text-center mt-3 shadow-sm">
        <div className="text-xs uppercase tracking-wide text-gold font-semibold">Available Balance</div>
        <div className="text-3xl font-bold my-2">PKR {Math.round(user.walletBalance).toLocaleString()}</div>
        <div className="geo-rule-gold mx-auto w-16 my-2.5" />
        <div className="text-xs text-white/85">Loan Status: <strong>Active</strong></div>
      </div>

      <div className="mt-3 p-3 bg-primary/5 border border-primary/15 rounded-xl text-xs text-slate-700 flex gap-2">
        <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <span>Your loan has been deposited. To withdraw, please pay the 12% down payment first.</span>
      </div>

      <SectionTitle Icon={Send} title="Withdraw Funds" className="mt-5" />
      <MethodPicker method={method} setMethod={setMethod} bank={bank} setBank={setBank} />

      <div className="mt-3">
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Account Number</label>
        <input
          value={account}
          onChange={(e) => setAccount(normalizeAccount(e.target.value))}
          placeholder="Account number or IBAN"
          inputMode="text"
          maxLength={34}
          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none text-sm transition"
        />
        {account.length > 0 && !isValidAccount(account) && (
          <p className="mt-1 text-[11px] text-amber-600">Enter a valid account number (10–34 characters)</p>
        )}
      </div>

      <button
        onClick={() => {
          if (!method) return toast.error('Please select a withdrawal method')
          if (method === 'bank' && !bank) return toast.error('Please select your bank')
          if (!isValidAccount(account)) return toast.error('Enter a valid account number (10–34 characters)')
          onAttemptWithdraw()
        }}
        className="w-full mt-3 bg-primary text-primary-foreground py-3 rounded-xl font-semibold shadow-sm hover:opacity-95 transition"
      >
        Proceed to Withdraw
      </button>

      <SectionTitle Icon={ListChecks} title="Repayment Schedule" className="mt-6" />
      <div className="mt-3 space-y-1">
        {loan.installments.map((inst) => (
          <div key={inst.id} className="flex items-center gap-3 p-2.5 border-b border-slate-100 last:border-0">
            <div className={`w-6 h-6 rounded-full grid place-items-center text-[10px] font-bold ${
              inst.status === 'PAID' ? 'bg-emerald-600 text-white' : inst.weekNumber === 1 ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'
            }`}>
              {inst.status === 'PAID' ? <CheckCircle2 className="w-3.5 h-3.5" /> : inst.weekNumber}
            </div>
            <div className="flex-1">
              <div className="text-xs font-semibold text-slate-800">Week {inst.weekNumber} Installment</div>
              <div className="text-[10px] text-slate-500">
                {inst.status === 'PAID' ? 'Completed' : inst.weekNumber === 1 ? 'Due now (advance)' : `Due in ${inst.weekNumber * 7} days`}
              </div>
            </div>
            <div className="text-xs font-bold text-slate-900">PKR {Math.round(inst.amount).toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function DownPaymentScreen({ loan, settings, onSubmitted, onBack }: {
  loan: Loan; settings: Settings | null; onSubmitted: () => void; onBack: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const downPayment = loan.downPayment

  const submit = async () => {
    if (submitting) return // guard against double-submit
    if (!file) return toast.error('Please upload payment screenshot')
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('type', 'DOWN_PAYMENT')
      fd.append('amount', String(downPayment))
      fd.append('loanId', loan.id)
      const r = await fetch('/api/payment/upload', { method: 'POST', body: fd })
      const d = await r.json()
      if (!r.ok) { toast.error(d.error || 'Failed'); setSubmitting(false); return }
      toast.success('Screenshot submitted for admin approval')
      onSubmitted() // re-routes to the review screen; keep button disabled until it unmounts
    } catch {
      toast.error('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div>
      <button onClick={onBack} className="text-xs text-slate-500 hover:text-primary inline-flex items-center gap-1 mb-3 transition">
        <ArrowLeft className="w-3 h-3" /> Back
      </button>
      <SectionTitle Icon={AlertCircle} title="Down Payment Required" />

      <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 flex gap-2">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>To activate your withdrawal, pay a <strong>{settings?.downPaymentPercent ?? 12}% down payment</strong> first.</span>
      </div>

      <div className="mt-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
        <div className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1.5">
          <CreditCard className="w-4 h-4" /> Down Payment Details
        </div>
        <div className="bg-white rounded-xl p-3 space-y-1.5 border border-amber-100">
          <Row label="Loan Amount" value={`PKR ${Math.round(loan.amount).toLocaleString()}`} />
          <Row label={`Down Payment (${settings?.downPaymentPercent ?? 12}%)`} value={`PKR ${Math.round(downPayment).toLocaleString()}`} valueClass="text-amber-600 font-bold text-base" />
        </div>
      </div>

      <SectionTitle Icon={Building2} title="Company Payment Account" className="mt-5" />
      <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
        <div className="text-xs font-semibold text-slate-700 mb-2">Send payment to this account:</div>
        <div className="bg-white rounded-xl p-3 space-y-1.5 border border-slate-100">
          <Row label="Account Title" value={settings?.accountTitle || 'GEO Loan (Pvt) Ltd'} />
          <Row label="Bank" value={settings?.bankName || 'HBL'} />
          <CopyRow label="Account Number" value={settings?.accountNumber || '1234-5678-9012-3456'} />
          <CopyRow label="EasyPaisa / JazzCash" value={settings?.mobileAccount || '0300-1234567'} />
        </div>
      </div>

      <div className="mt-3 p-3 bg-primary/5 border border-primary/15 rounded-xl text-xs text-slate-700 flex gap-2">
        <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <span>Send the exact amount, then upload the payment screenshot below.</span>
      </div>

      <SectionTitle Icon={Camera} title="Upload Payment Screenshot" className="mt-5" />
      <UploadArea file={file} preview={preview} onSelect={(f, p) => { setFile(f); setPreview(p) }} />

      <button
        onClick={submit}
        disabled={!file || submitting}
        className="w-full mt-4 bg-primary text-primary-foreground py-3 rounded-xl font-semibold disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm hover:opacity-95 transition"
      >
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
        Submit for Approval
      </button>
    </div>
  )
}

function PendingScreen({ pending, onResolved }: { pending: PendingPayment; onResolved: () => Promise<void> }) {
  const startTs = pending.createdAt ? new Date(pending.createdAt).getTime() : Date.now()
  const [elapsed, setElapsed] = useState(Math.max(0, Math.floor((Date.now() - startTs) / 1000)))
  const [stepIdx, setStepIdx] = useState(0)
  const label = pending.type === 'DOWN_PAYMENT' ? 'down payment' : pending.type === 'INSTALLMENT' ? 'installment' : 'payment'
  const steps = ['Receiving your screenshot', 'Matching the amount', 'Verifying with our team', 'Finalizing review']

  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const t = setInterval(() => setStepIdx((i) => (i + 1) % steps.length), 2600)
    return () => clearInterval(t)
  }, [steps.length])

  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const r = await fetch('/api/loan/current', { cache: 'no-store' })
        const d = await r.json()
        if (!d.pendingPayment) {
          toast.success('Payment reviewed!')
          await onResolved()
        }
      } catch {}
    }, 4000)
    return () => clearInterval(t)
  }, [onResolved])

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')
  const progress = Math.min(92, 12 + elapsed * 2)

  return (
    <div className="text-center py-6">
      <div className="relative w-24 h-24 mx-auto">
        <span className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />
        <span className="absolute inset-2 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        <span className="absolute inset-0 grid place-items-center">
          <ShieldCheck className="w-9 h-9 text-primary" />
        </span>
      </div>

      <h2 className="font-bold text-lg mt-5 text-slate-900">Verifying your {label}</h2>
      <p className="text-sm text-slate-600 mt-1">Our team is reviewing your payment screenshot.</p>

      <div className="mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/5 border border-primary/15 text-primary font-mono text-sm font-semibold">
        <Clock className="w-4 h-4" /> {mm}:{ss}
      </div>

      <div className="mt-5 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full geo-gradient rounded-full transition-all duration-1000 ease-out" style={{ width: `${progress}%` }} />
      </div>

      <div className="mt-4 space-y-2 text-left max-w-xs mx-auto">
        {steps.map((s, i) => (
          <div key={s} className={`flex items-center gap-2.5 text-sm transition ${i < stepIdx ? 'text-emerald-600' : i === stepIdx ? 'text-slate-900 font-medium' : 'text-slate-400'}`}>
            {i < stepIdx ? <CheckCircle2 className="w-4 h-4 shrink-0" />
              : i === stepIdx ? <Loader2 className="w-4 h-4 shrink-0 animate-spin text-primary" />
              : <span className="w-4 h-4 shrink-0 rounded-full border border-slate-300" />}
            {s}
          </div>
        ))}
      </div>

      <div className="mt-6 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-slate-700">
        Amount: <strong>PKR {Math.round(pending.amount).toLocaleString()}</strong> · Status: <span className="font-semibold text-amber-700">PENDING REVIEW</span>
      </div>
      <p className="text-[11px] text-slate-400 mt-3">Please keep this page open — it updates automatically.</p>
    </div>
  )
}

function InstallmentPaymentScreen({ loan, settings, onSubmitted }: {
  loan: Loan; settings: Settings | null; onSubmitted: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const installmentAmount = loan.weeklyInstallment

  const submit = async () => {
    if (submitting) return // guard against double-submit
    if (!file) return toast.error('Please upload payment screenshot')
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('type', 'INSTALLMENT')
      fd.append('amount', String(installmentAmount))
      fd.append('loanId', loan.id)
      const r = await fetch('/api/payment/upload', { method: 'POST', body: fd })
      const d = await r.json()
      if (!r.ok) { toast.error(d.error || 'Failed'); setSubmitting(false); return }
      toast.success('Installment screenshot submitted')
      onSubmitted() // re-routes to the review screen; keep button disabled until it unmounts
    } catch {
      toast.error('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div>
      <SectionTitle Icon={CheckCircle2} title="Down Payment Approved!" />

      <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex gap-2">
        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
        <span>Your down payment has been verified and approved.</span>
      </div>

      <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 flex gap-2">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>Now pay the <strong>1st Installment in advance</strong> to unlock your withdrawal.</span>
      </div>

      <div className="mt-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
        <div className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1.5">
          <CreditCard className="w-4 h-4" /> 1st Installment Payment
        </div>
        <div className="bg-white rounded-xl p-3 border border-amber-100">
          <Row label="Installment Amount" value={`PKR ${Math.round(installmentAmount).toLocaleString()}`} valueClass="text-amber-600 font-bold text-base" />
        </div>
      </div>

      <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
        <div className="text-xs font-semibold text-slate-700 mb-2">Send to the same account:</div>
        <div className="bg-white rounded-xl p-3 space-y-1.5 border border-slate-100">
          <CopyRow label="Account Title" value={settings?.accountTitle || 'GEO Loan (Pvt) Ltd'} />
          <CopyRow label="Account Number" value={settings?.accountNumber || '1234-5678-9012-3456'} />
          <CopyRow label="EasyPaisa / JazzCash" value={settings?.mobileAccount || '0300-1234567'} />
        </div>
      </div>

      <SectionTitle Icon={Camera} title="Upload Screenshot" className="mt-5" />
      <UploadArea file={file} preview={preview} onSelect={(f, p) => { setFile(f); setPreview(p) }} />

      <button
        onClick={submit}
        disabled={!file || submitting}
        className="w-full mt-4 bg-primary text-primary-foreground py-3 rounded-xl font-semibold disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm hover:opacity-95 transition"
      >
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
        Submit 1st Installment
      </button>
    </div>
  )
}

type WithdrawalInfo = {
  id: string; amount: number; method: string; bank: string | null
  accountNumber: string; accountTitle: string; status: string
  transactionId: string | null; adminNote: string | null
  createdAt: string; reviewedAt: string | null
}

function WdRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground w-24 shrink-0">{label}</span>
      <span className="font-semibold text-slate-900 break-all">{value}</span>
    </div>
  )
}

function WithdrawReadyScreen({ loan, onWithdrawn }: {
  user: MeUser; loan: Loan; onWithdrawn: () => Promise<void>
}) {
  const [method, setMethod] = useState('')
  const [account, setAccount] = useState('')
  const [title, setTitle] = useState('')
  const [bank, setBank] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [wallet, setWallet] = useState<{ walletBalance: number; withdrawal: WithdrawalInfo | null } | null>(null)
  const [retry, setRetry] = useState(false)

  const loadWallet = useCallback(async () => {
    try {
      const r = await fetch('/api/wallet', { cache: 'no-store' })
      const d = await r.json()
      if (r.ok) setWallet({ walletBalance: d.walletBalance, withdrawal: d.withdrawal || null })
    } catch {}
  }, [])
  useEffect(() => { loadWallet() }, [loadWallet])

  const wd = wallet?.withdrawal || null

  // Poll while a request is pending so the Transaction ID appears as soon as admin sends it
  useEffect(() => {
    if (wd?.status !== 'PENDING') return
    const t = setInterval(loadWallet, 5000)
    return () => clearInterval(t)
  }, [wd?.status, loadWallet])

  const methodName = (w: WithdrawalInfo) =>
    w.method === 'bank' ? (w.bank || 'Bank') : w.method === 'easypaisa' ? 'EasyPaisa' : w.method === 'jazzcash' ? 'JazzCash' : w.method

  const submit = async () => {
    if (!method) return toast.error('Please select a withdrawal method')
    if (method === 'bank' && !bank) return toast.error('Please select your bank')
    if (!isValidAccount(account)) return toast.error('Enter a valid account number (10–34 characters)')
    if (!isValidName(title)) return toast.error('Enter the account holder name')
    setSubmitting(true)
    try {
      const r = await fetch('/api/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, bank, accountNumber: account, accountTitle: title }),
      })
      const d = await r.json()
      if (!r.ok) {
        if (r.status === 409) await loadWallet() // a request already exists -> advance to the pending view
        return toast.error(d.error || 'Failed')
      }
      toast.success('Withdrawal request submitted')
      setRetry(false)
      await loadWallet() // -> shows the pending screen
    } finally {
      setSubmitting(false)
    }
  }

  // Initial load
  if (!wallet) {
    return <div className="py-12 text-center"><Loader2 className="w-10 h-10 mx-auto text-primary animate-spin" /></div>
  }

  // PAID — show the real Transaction ID recorded by admin
  if (wd?.status === 'PAID') {
    return (
      <div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center mt-4">
          <span className="inline-grid place-items-center w-14 h-14 rounded-full bg-emerald-100">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </span>
          <h2 className="font-bold text-emerald-700 text-lg mt-2">Money Sent!</h2>
          <p className="text-xs text-slate-600 mt-1">
            PKR {Math.round(wd.amount).toLocaleString()} sent to your {methodName(wd)} account.
          </p>
        </div>
        <div className="geo-gradient-emerald text-white rounded-2xl p-5 text-center mt-3 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-gold font-semibold">Amount Sent</div>
          <div className="text-3xl font-bold my-2">PKR {Math.round(wd.amount).toLocaleString()}</div>
          <div className="geo-rule-gold mx-auto w-16 my-2.5" />
          <div className="text-xs">to {methodName(wd)} · {wd.accountNumber}</div>
        </div>
        <div className="mt-3 rounded-2xl border border-emerald-200 bg-card p-4">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Transaction ID</div>
          <div className="flex items-center justify-between gap-2 mt-1">
            <span className="font-bold text-slate-900 break-all">{wd.transactionId}</span>
            <button
              onClick={() => { navigator.clipboard?.writeText(wd.transactionId || '').then(() => toast.success('Copied')).catch(() => {}) }}
              className="shrink-0 inline-flex items-center gap-1 text-xs text-primary font-semibold hover:underline"
            >
              <Copy className="w-3.5 h-3.5" /> Copy
            </button>
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5">Keep this ID as proof of your payout.</p>
        </div>
        <button
          onClick={onWithdrawn}
          className="w-full mt-4 bg-primary text-primary-foreground py-3 rounded-xl font-semibold shadow-sm hover:opacity-95 transition"
        >
          Go to Dashboard
        </button>
      </div>
    )
  }

  // PENDING — request received, admin is sending the money
  if (wd?.status === 'PENDING') {
    return (
      <div>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center mt-4">
          <span className="inline-grid place-items-center w-14 h-14 rounded-full bg-amber-100">
            <Loader2 className="w-7 h-7 text-amber-600 animate-spin" />
          </span>
          <h2 className="font-bold text-amber-700 text-lg mt-2">Withdrawal Processing</h2>
          <p className="text-xs text-slate-600 mt-1">
            Our team is sending PKR {Math.round(wd.amount).toLocaleString()} to your {methodName(wd)} account.
            You&apos;ll get the Transaction ID here as soon as it&apos;s sent.
          </p>
        </div>
        <div className="mt-3 rounded-2xl border border-border bg-card p-4 text-xs space-y-1.5">
          <WdRow label="Amount" value={`PKR ${Math.round(wd.amount).toLocaleString()}`} />
          <WdRow label="Method" value={methodName(wd)} />
          <WdRow label="Account #" value={wd.accountNumber} />
          <WdRow label="Account title" value={wd.accountTitle} />
          <WdRow label="Requested" value={new Date(wd.createdAt).toLocaleString('en-PK', { dateStyle: 'short', timeStyle: 'short' })} />
        </div>
        <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-slate-500">
          <Clock className="w-3.5 h-3.5" /> This page updates automatically.
        </div>
      </div>
    )
  }

  // REJECTED — show reason + retry (balance was refunded)
  if (wd?.status === 'REJECTED' && !retry) {
    return (
      <div>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center mt-4">
          <span className="inline-grid place-items-center w-14 h-14 rounded-full bg-red-100">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </span>
          <h2 className="font-bold text-red-700 text-lg mt-2">Withdrawal Rejected</h2>
          {wd.adminNote && <p className="text-xs text-slate-600 mt-1">Reason: {wd.adminNote}</p>}
          <p className="text-xs text-slate-600 mt-1">
            PKR {Math.round(wd.amount).toLocaleString()} has been returned to your wallet.
          </p>
        </div>
        <button
          onClick={() => setRetry(true)}
          className="w-full mt-4 bg-primary text-primary-foreground py-3 rounded-xl font-semibold shadow-sm hover:opacity-95 transition"
        >
          Try Again
        </button>
      </div>
    )
  }

  // FORM (no active request, or retrying after rejection)
  return (
    <div>
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 text-center">
        <span className="inline-grid place-items-center w-11 h-11 rounded-full geo-gradient-gold shadow-sm">
          <BadgeCheck className="w-6 h-6 text-white" />
        </span>
        <h2 className="font-bold text-primary mt-2">Withdrawal Unlocked!</h2>
        <p className="text-xs text-slate-600 mt-1">Enter your account details — our team will send the money and share a Transaction ID.</p>
      </div>

      <div className="geo-gradient-emerald text-white rounded-2xl p-5 text-center mt-3 shadow-sm">
        <div className="text-xs uppercase tracking-wide text-gold font-semibold">Available for Withdrawal</div>
        <div className="text-3xl font-bold my-2">PKR {Math.round(wallet.walletBalance).toLocaleString()}</div>
        <div className="geo-rule-gold mx-auto w-16 mt-2.5" />
      </div>

      <SectionTitle Icon={Send} title="Select Withdraw Method" className="mt-5" />
      <MethodPicker method={method} setMethod={setMethod} bank={bank} setBank={setBank} />

      <div className="mt-3 space-y-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Account Number</label>
          <input
            value={account}
            onChange={(e) => setAccount(normalizeAccount(e.target.value))}
            placeholder="Account number or IBAN"
            inputMode="text"
            maxLength={34}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none text-sm transition"
          />
          {account.length > 0 && !isValidAccount(account) && (
            <p className="mt-1 text-[11px] text-amber-600">Enter a valid account number (10–34 characters)</p>
          )}
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Account Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter account title"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none text-sm transition"
          />
        </div>
      </div>

      <button
        onClick={submit}
        disabled={submitting}
        className="w-full mt-4 bg-primary text-primary-foreground py-3 rounded-xl font-semibold disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm hover:opacity-95 transition"
      >
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
        Request Withdrawal
      </button>

      <SectionTitle Icon={ListChecks} title="Remaining Installments" className="mt-6" />
      <div className="mt-3 space-y-1">
        {loan.installments.map((inst) => (
          <div key={inst.id} className="flex items-center gap-3 p-2.5 border-b border-slate-100 last:border-0">
            <div className={`w-6 h-6 rounded-full grid place-items-center text-[10px] font-bold ${
              inst.status === 'PAID' ? 'bg-emerald-600 text-white' : inst.weekNumber === 2 ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'
            }`}>
              {inst.status === 'PAID' ? <CheckCircle2 className="w-3.5 h-3.5" /> : inst.weekNumber}
            </div>
            <div className="flex-1">
              <div className="text-xs font-semibold text-slate-800">Week {inst.weekNumber}{inst.status === 'PAID' ? ' (Paid)' : ''}</div>
              <div className="text-[10px] text-slate-500">
                {inst.status === 'PAID' ? 'Completed' : inst.weekNumber === 2 ? 'Upcoming' : 'Scheduled'}
              </div>
            </div>
            <div className="text-xs font-bold text-slate-900">PKR {Math.round(inst.amount).toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function RepayScreen({ loan, settings, outstanding, onSubmitted, onBack }: {
  loan: Loan; settings: Settings | null; outstanding: number; onSubmitted: () => void; onBack: () => void
}) {
  const [mode, setMode] = useState<'full' | 'partial'>('full')
  const [amountStr, setAmountStr] = useState(String(Math.round(outstanding)))
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const amount = mode === 'full' ? outstanding : (parseFloat(amountStr) || 0)

  const submit = async () => {
    if (submitting) return
    if (amount <= 0) return toast.error('Enter a valid amount')
    if (amount > outstanding + 0.01) return toast.error('Amount exceeds the outstanding balance')
    if (!file) return toast.error('Please upload your payment screenshot')
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('type', 'REPAYMENT')
      fd.append('amount', String(Math.round(amount)))
      fd.append('loanId', loan.id)
      const r = await fetch('/api/payment/upload', { method: 'POST', body: fd })
      const d = await r.json()
      if (!r.ok) { toast.error(d.error || 'Failed'); setSubmitting(false); return }
      toast.success('Repayment submitted — under review')
      onSubmitted()
    } catch {
      toast.error('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div>
      <button onClick={onBack} className="text-xs text-slate-500 hover:text-primary inline-flex items-center gap-1 mb-2"><ArrowLeft className="w-3.5 h-3.5" /> Back</button>
      <SectionTitle Icon={Banknote} title="Repay Your Loan" />

      <div className="geo-gradient-emerald text-white rounded-2xl p-5 text-center mt-3 shadow-sm">
        <div className="text-xs uppercase tracking-wide text-gold font-semibold">Outstanding Balance</div>
        <div className="text-3xl font-bold my-2">PKR {Math.round(outstanding).toLocaleString()}</div>
      </div>

      <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 flex gap-2">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>Repay anytime — partial or full. The full markup is already included; paying early does not reduce it.</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button onClick={() => { setMode('full'); setAmountStr(String(Math.round(outstanding))) }} className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition ${mode === 'full' ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 text-slate-600 hover:border-primary/50'}`}>Pay Full</button>
        <button onClick={() => setMode('partial')} className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition ${mode === 'partial' ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 text-slate-600 hover:border-primary/50'}`}>Pay Partial</button>
      </div>
      {mode === 'partial' && (
        <div className="mt-3">
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Amount to pay (PKR)</label>
          <input value={amountStr} onChange={(e) => setAmountStr(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" placeholder="e.g. 5000"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none text-sm transition" />
          {amount > outstanding && <p className="mt-1 text-[11px] text-amber-600">Max is PKR {Math.round(outstanding).toLocaleString()}</p>}
        </div>
      )}

      <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
        <div className="text-xs font-semibold text-slate-700 mb-2">Send your payment to:</div>
        <div className="bg-white rounded-xl p-3 space-y-1.5 border border-slate-100">
          <CopyRow label="Account Title" value={settings?.accountTitle || 'GEO Loan (Pvt) Ltd'} />
          <CopyRow label="Account Number" value={settings?.accountNumber || '1234-5678-9012-3456'} />
          <CopyRow label="EasyPaisa / JazzCash" value={settings?.mobileAccount || '0300-1234567'} />
        </div>
      </div>

      <SectionTitle Icon={Camera} title="Upload Payment Screenshot" className="mt-5" />
      <UploadArea file={file} preview={preview} onSelect={(f, p) => { setFile(f); setPreview(p) }} />

      <button onClick={submit} disabled={!file || submitting || amount <= 0}
        className="w-full mt-4 bg-primary text-primary-foreground py-3 rounded-xl font-semibold disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm hover:opacity-95 transition">
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
        Submit Payment{amount > 0 ? ` · PKR ${Math.round(amount).toLocaleString()}` : ''}
      </button>
    </div>
  )
}

function DashboardScreen({ loan, outstanding, pending, onRepay }: {
  loan: Loan; user: MeUser; outstanding: number; pending: PendingPayment | null; onRepay: () => void
}) {
  const repayPending = pending?.type === 'REPAYMENT'
  return (
    <div>
      <SectionTitle Icon={Home} title="Dashboard" />
      <div className="geo-gradient-emerald text-white rounded-2xl p-5 text-center mt-3 shadow-sm">
        <div className="text-xs uppercase tracking-wide text-gold font-semibold">Total Repayable</div>
        <div className="text-3xl font-bold my-2">PKR {Math.round(loan.totalRepayment).toLocaleString()}</div>
        <div className="geo-rule-gold mx-auto w-16 my-2.5" />
        <div className="text-xs text-white/85">Status: <strong>Active</strong></div>
      </div>

      {/* Outstanding balance + early repayment */}
      <div className="mt-4 geo-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs text-muted-foreground">Outstanding balance</div>
            <div className="text-2xl font-bold text-slate-900">PKR {Math.round(outstanding).toLocaleString()}</div>
          </div>
          {outstanding > 0 ? (
            repayPending ? (
              <span className="text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center">Repayment<br />under review</span>
            ) : (
              <button onClick={onRepay} className="geo-gradient text-white px-4 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center gap-1.5 hover:opacity-95 shadow-sm transition shrink-0">
                <Banknote className="w-4 h-4" /> Repay Now
              </button>
            )
          ) : (
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Fully repaid</span>
          )}
        </div>
        <p className="text-[11px] text-slate-500 mt-2.5">Pay early anytime — <strong>partial or full</strong>. The full markup applies regardless of how soon you repay.</p>
      </div>

      <SectionTitle Icon={ListChecks} title="Installment Tracker" className="mt-5" />
      <div className="mt-3 space-y-1">
        {loan.installments.map((inst) => {
          const repaid = Math.max(0, loan.totalRepayment - outstanding)
          const weekly = inst.amount
          // amount still owed for THIS week (after spreading the paid amount across weeks)
          const dueThisWeek = Math.max(0, Math.min(weekly, inst.weekNumber * weekly - repaid))
          const paid = inst.status === 'PAID' || dueThisWeek <= 0.01
          const partial = !paid && dueThisWeek < weekly - 0.01 // the active week, partly covered
          const amountShown = paid ? weekly : dueThisWeek
          return (
            <div key={inst.id} className="flex items-center gap-3 p-2.5 border-b border-slate-100 last:border-0">
              <div className={`w-6 h-6 rounded-full grid place-items-center text-[10px] font-bold ${
                paid ? 'bg-emerald-600 text-white' : partial ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                {paid ? <CheckCircle2 className="w-3.5 h-3.5" /> : inst.weekNumber}
              </div>
              <div className="flex-1">
                <div className="text-xs font-semibold text-slate-800">Week {inst.weekNumber}{paid ? ' (Paid)' : ''}</div>
                <div className="text-[10px] text-slate-500">{paid ? 'Completed' : partial ? 'Remaining due' : 'Scheduled'}</div>
              </div>
              <div className={`text-xs font-bold ${partial ? 'text-amber-600' : 'text-slate-900'}`}>PKR {Math.round(amountShown).toLocaleString()}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============ REUSABLE COMPONENTS ============
function SectionTitle({
  Icon, title, className = '',
}: {
  Icon: ComponentType<{ className?: string }>; title: string; className?: string
}) {
  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <span className="w-7 h-7 rounded-lg bg-primary/10 grid place-items-center shrink-0">
          <Icon className="w-4 h-4 text-primary" />
        </span>
        <h2 className="text-sm font-bold text-slate-800">{title}</h2>
      </div>
      <div className="geo-rule-gold mt-2 w-12" />
    </div>
  )
}

function Field({
  label, value, onChange, placeholder, type = 'text', disabled = false,
  inputMode, maxLength, hint,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; disabled?: boolean;
  inputMode?: 'text' | 'numeric' | 'tel' | 'email'; maxLength?: number; hint?: string
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        inputMode={inputMode}
        maxLength={maxLength}
        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none text-sm transition disabled:bg-slate-50 disabled:text-slate-500"
      />
      {hint && <p className="mt-1 text-[11px] text-amber-600">{hint}</p>}
    </div>
  )
}

// In-app camera capture (live preview + shutter). Works on mobile & desktop over HTTPS/localhost.
function CameraCapture({ facing, label, onCapture, onClose }: {
  facing: 'user' | 'environment'; label: string; onCapture: (f: File) => void; onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>(facing)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const start = async () => {
      setErr(null)
      try {
        if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop())
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: false })
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}) }
      } catch {
        setErr('Could not access the camera. Allow camera permission, or use “Choose from gallery”.')
      }
    }
    start()
    return () => { active = false; streamRef.current?.getTracks().forEach((t) => t.stop()) }
  }, [facingMode])

  const capture = () => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    const c = document.createElement('canvas')
    c.width = v.videoWidth; c.height = v.videoHeight
    c.getContext('2d')?.drawImage(v, 0, 0)
    c.toBlob((blob) => { if (blob) onCapture(new File([blob], 'capture.jpg', { type: 'image/jpeg' })) }, 'image/jpeg', 0.92)
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col">
      <div className="flex items-center justify-between p-3 text-white">
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10"><X className="w-5 h-5" /></button>
        <span className="text-sm font-semibold">{label}</span>
        <button onClick={() => setFacingMode((f) => (f === 'user' ? 'environment' : 'user'))} className="p-2 rounded-lg hover:bg-white/10">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 relative grid place-items-center overflow-hidden">
        {err ? (
          <div className="text-center text-white/80 px-8 text-sm">{err}</div>
        ) : (
          <>
            <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
            <div className={`absolute border-2 border-white/70 rounded-2xl pointer-events-none ${facingMode === 'user' ? 'inset-x-16 inset-y-10 rounded-full' : 'inset-x-6 top-1/4 bottom-1/4'}`} />
            <div className="absolute bottom-24 left-0 right-0 text-center text-white/80 text-xs px-6">
              {facingMode === 'user' ? 'Center your face in the circle' : 'Fit your CNIC inside the frame'}
            </div>
          </>
        )}
      </div>
      <div className="p-5 grid place-items-center bg-black">
        <button onClick={capture} disabled={!!err} className="w-16 h-16 rounded-full bg-white ring-4 ring-white/30 disabled:opacity-40 grid place-items-center active:scale-95 transition">
          <Camera className="w-7 h-7 text-slate-900" />
        </button>
        <p className="text-white/60 text-xs mt-2">Tap to capture</p>
      </div>
    </div>
  )
}

function UploadBox({
  label, Icon, path, onFile, wide = false, verifying = false, facing,
}: {
  label: string; Icon: ComponentType<{ className?: string }>; path: string | null;
  onFile: (f: File) => void; wide?: boolean; verifying?: boolean; facing?: 'user' | 'environment'
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [camOpen, setCamOpen] = useState(false)

  const handle = (f: File) => {
    setPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(f) })
    onFile(f)
  }

  return (
    <div className="w-full">
      <button
        onClick={() => (facing ? setCamOpen(true) : inputRef.current?.click())}
        className={`p-3 rounded-xl border-2 border-dashed text-center transition w-full ${
          path || preview ? 'border-primary bg-primary/5' : 'border-slate-300 hover:border-primary/50 hover:bg-slate-50'
        }`}
      >
        {preview ? (
          <div className="relative">
            <img src={preview} alt={label} className={`w-full ${wide ? 'h-40' : 'h-24'} object-cover rounded-lg border border-primary/20`} />
            {verifying ? (
              <span className="absolute top-1 right-1 bg-white rounded-full p-0.5 shadow"><Loader2 className="w-3.5 h-3.5 text-primary animate-spin" /></span>
            ) : path ? (
              <span className="absolute top-1 right-1 bg-emerald-600 text-white rounded-full p-0.5 shadow"><CheckCircle2 className="w-3.5 h-3.5" /></span>
            ) : null}
            <div className="text-[11px] mt-1.5 text-slate-700 font-semibold">{label}</div>
            <div className="text-[10px] text-primary mt-0.5">Tap to retake</div>
          </div>
        ) : (
          <>
            <span className="inline-grid place-items-center w-9 h-9 rounded-lg bg-primary/10 mx-auto">
              <Camera className="w-5 h-5 text-primary" />
            </span>
            <div className="text-[11px] mt-1.5 text-slate-700 font-semibold">{label}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">{facing ? 'Tap to open camera' : 'Tap to upload'}</div>
          </>
        )}
      </button>
      {facing && (
        <button type="button" onClick={() => inputRef.current?.click()} className="mt-1 w-full text-center text-[10px] text-primary hover:underline">
          or choose from gallery
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handle(e.target.files[0])} />
      {camOpen && facing && (
        <CameraCapture facing={facing} label={label} onClose={() => setCamOpen(false)} onCapture={(f) => { setCamOpen(false); handle(f) }} />
      )}
    </div>
  )
}

function UploadArea({
  file, preview, onSelect,
}: {
  file: File | null; preview: string | null;
  onSelect: (f: File, preview: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div>
      <button
        onClick={() => inputRef.current?.click()}
        className="w-full p-6 rounded-2xl border-2 border-dashed border-slate-300 text-center hover:border-primary hover:bg-primary/5 transition"
      >
        <span className="inline-grid place-items-center w-12 h-12 rounded-xl bg-primary/10">
          <Camera className="w-6 h-6 text-primary" />
        </span>
        <div className="text-xs text-slate-700 mt-2">{file ? file.name : 'Tap to upload payment screenshot'}</div>
        <div className="text-[10px] text-slate-400 mt-0.5">JPG, PNG (Max 5MB)</div>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) {
            const reader = new FileReader()
            reader.onload = (ev) => onSelect(f, ev.target?.result as string)
            reader.readAsDataURL(f)
          }
        }}
      />
      {preview && (
        <div className="mt-3">
          <img src={preview} alt="preview" className="w-full rounded-xl border-2 border-primary" />
          <div className="text-[10px] text-primary text-center mt-1 inline-flex items-center gap-1 w-full justify-center">
            <CheckCircle2 className="w-3 h-3" /> Screenshot uploaded
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value, valueClass = '' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-slate-600">{label}</span>
      <span className={`font-semibold text-slate-900 ${valueClass}`}>{value}</span>
    </div>
  )
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      toast.success('Copied!')
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold text-slate-900 flex items-center gap-1.5">
        {value}
        <button onClick={copy} className="text-[10px] bg-primary text-primary-foreground px-1.5 py-1 rounded-md hover:opacity-90 transition">
          {copied ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        </button>
      </span>
    </div>
  )
}

function LogoutBtn() {
  const [loading, setLoading] = useState(false)
  return (
    <button
      onClick={async () => {
        setLoading(true)
        await fetch('/api/auth/logout', { method: 'POST' })
        window.location.href = '/app'
      }}
      disabled={loading}
      className="text-sm text-slate-700 px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 inline-flex items-center gap-2 justify-center transition"
    >
      <LogOut className="w-4 h-4" /> Logout
    </button>
  )
}

function NotifDrawer({
  notifications, onClose, onMarkRead,
}: {
  notifications: NotificationItem[]
  onClose: () => void
  onMarkRead: () => Promise<void>
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-white h-full overflow-y-auto p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg text-slate-900">Notifications</h3>
          <div className="flex items-center gap-3">
            <button onClick={() => onMarkRead()} className="text-xs text-primary font-semibold hover:opacity-80 transition">
              Mark all read
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition" aria-label="Close">✕</button>
          </div>
        </div>
        {notifications.length === 0 ? (
          <div className="text-center text-sm text-slate-500 py-8">No notifications</div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`p-3 rounded-xl border ${
                  n.read ? 'bg-white border-slate-200' : 'bg-primary/5 border-primary/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-sm text-slate-900">{n.title}</div>
                  <div className="text-[10px] text-slate-500">
                    {new Date(n.createdAt).toLocaleString('en-PK', { dateStyle: 'short', timeStyle: 'short' })}
                  </div>
                </div>
                <div className="text-xs text-slate-600 mt-1">{n.message}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
