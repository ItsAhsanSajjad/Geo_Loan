'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, Power, KeyRound, RefreshCw, LogOut, Loader2, UserCog, LogIn } from 'lucide-react'

interface SaUser {
  id: string
  phone: string
  fullName: string | null
  cnic: string | null
  email: string | null
  role: string
  kycStatus: string
  walletBalance: number
  mustChangePassword: boolean
  createdAt: string
  _count: { loans: number; payments: number; withdrawals: number }
}
interface AuditRow {
  id: string
  actorPhone: string | null
  role: string | null
  action: string
  target: string | null
  detail: string | null
  ip: string | null
  createdAt: string
}

export default function SuperAdminDashboard() {
  const router = useRouter()
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [users, setUsers] = useState<SaUser[]>([])
  const [logs, setLogs] = useState<AuditRow[]>([])
  const [maint, setMaint] = useState({ mode: false, message: '' })
  const [tempPw, setTempPw] = useState<{ phone: string; pw: string } | null>(null)
  const [busy, setBusy] = useState('')

  const loadAll = useCallback(async () => {
    const [uR, mR, aR] = await Promise.all([
      fetch('/api/superadmin/users', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/superadmin/maintenance', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/superadmin/audit', { cache: 'no-store' }).then((r) => r.json()),
    ])
    setUsers(uR.users || [])
    setMaint({ mode: !!mR.mode, message: mR.message || '' })
    setLogs(aR.logs || [])
  }, [])

  useEffect(() => {
    fetch('/api/superadmin/me', { cache: 'no-store' }).then((r) => {
      if (!r.ok) {
        router.replace('/superadmin')
        return
      }
      setAuthed(true)
      loadAll()
    })
  }, [router, loadAll])

  async function saveMaintenance(enabled: boolean) {
    setBusy('maint')
    await fetch('/api/superadmin/maintenance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled, message: maint.message }),
    })
    setMaint((m) => ({ ...m, mode: enabled }))
    setBusy('')
    loadAll()
  }

  async function resetPw(u: SaUser) {
    if (!confirm(`Reset password for ${u.phone}? They will get a new temporary password and must change it on next login.`)) return
    setBusy('reset' + u.id)
    const r = await fetch(`/api/superadmin/users/${u.id}/reset-password`, { method: 'POST' })
    const d = await r.json().catch(() => ({}))
    setBusy('')
    if (r.ok && d.tempPassword) {
      setTempPw({ phone: u.phone, pw: d.tempPassword })
      loadAll()
    } else {
      alert(d.error || 'Failed to reset')
    }
  }

  async function setRole(u: SaUser, role: string) {
    if (role === u.role) return
    setBusy('role' + u.id)
    const r = await fetch(`/api/superadmin/users/${u.id}/role`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    setBusy('')
    if (!r.ok) {
      const d = await r.json().catch(() => ({}))
      alert(d.error || 'Failed to set role')
    }
    loadAll()
  }

  async function impersonate(u: SaUser) {
    if (!confirm(`Open ${u.phone}'s account as ${u.role}? You'll be signed in as them (this is logged). Use "Exit" to return.`)) return
    setBusy('imp' + u.id)
    const r = await fetch(`/api/superadmin/users/${u.id}/impersonate`, { method: 'POST' })
    const d = await r.json().catch(() => ({}))
    setBusy('')
    if (r.ok && d.redirect) window.location.href = d.redirect
    else alert(d.error || 'Failed to open account')
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.replace('/superadmin')
  }

  if (authed === null) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-950 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 grid place-items-center">
            <Shield className="w-5 h-5 text-amber-400" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Super Admin</h1>
            <p className="text-xs text-slate-400">Full control panel — every action is logged</p>
          </div>
          <button onClick={loadAll} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs inline-flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button onClick={logout} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs inline-flex items-center gap-1.5">
            <LogOut className="w-3.5 h-3.5" /> Logout
          </button>
        </div>

        {/* Temp password reveal */}
        {tempPw && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
            <p className="text-sm font-semibold text-amber-300">Temporary password for {tempPw.phone}</p>
            <p className="text-xs text-slate-400 mt-1">Share it securely. Shown once — the user must change it on next login.</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="px-3 py-1.5 rounded bg-slate-950 border border-slate-700 text-amber-200 text-sm">{tempPw.pw}</code>
              <button onClick={() => navigator.clipboard?.writeText(tempPw.pw)} className="text-xs text-slate-400 hover:text-slate-200">Copy</button>
              <button onClick={() => setTempPw(null)} className="text-xs text-slate-500 hover:text-slate-300 ml-auto">Dismiss</button>
            </div>
          </div>
        )}

        {/* Maintenance / kill switch */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Power className={`w-4 h-4 ${maint.mode ? 'text-red-400' : 'text-emerald-400'}`} />
            <h2 className="text-sm font-semibold">Maintenance / Shutdown</h2>
            <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full ${maint.mode ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
              {maint.mode ? 'OFFLINE — only super admin' : 'ONLINE'}
            </span>
          </div>
          <input
            value={maint.message}
            onChange={(e) => setMaint((m) => ({ ...m, message: e.target.value }))}
            placeholder="Message shown to users while offline"
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-amber-500 mb-3"
          />
          <div className="flex gap-2">
            <button
              onClick={() => saveMaintenance(true)}
              disabled={busy === 'maint'}
              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-60 text-xs font-semibold"
            >
              Take app offline
            </button>
            <button
              onClick={() => saveMaintenance(false)}
              disabled={busy === 'maint'}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-xs font-semibold"
            >
              Bring online
            </button>
          </div>
        </div>

        {/* Users */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="flex items-center gap-2 mb-3">
            <UserCog className="w-4 h-4 text-slate-300" />
            <h2 className="text-sm font-semibold">All Accounts ({users.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-slate-500 text-left">
                <tr className="border-b border-slate-800">
                  <th className="py-2 pr-3">Phone</th>
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">KYC</th>
                  <th className="py-2 pr-3">Wallet</th>
                  <th className="py-2 pr-3">Loans</th>
                  <th className="py-2 pr-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-slate-800/60">
                    <td className="py-2 pr-3 font-mono">{u.phone}</td>
                    <td className="py-2 pr-3">{u.fullName || '—'}</td>
                    <td className="py-2 pr-3">
                      {u.role === 'SUPER_ADMIN' ? (
                        <span className="text-amber-400 font-semibold">SUPER_ADMIN</span>
                      ) : (
                        <select
                          value={u.role}
                          onChange={(e) => setRole(u, e.target.value)}
                          disabled={busy === 'role' + u.id}
                          className="bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-xs"
                        >
                          <option value="USER">USER</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                      )}
                    </td>
                    <td className="py-2 pr-3">{u.kycStatus}</td>
                    <td className="py-2 pr-3">{Math.round(u.walletBalance).toLocaleString()}</td>
                    <td className="py-2 pr-3">{u._count.loans}</td>
                    <td className="py-2 pr-3">
                      {u.role !== 'SUPER_ADMIN' && (
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => impersonate(u)}
                            disabled={busy === 'imp' + u.id}
                            className="px-2 py-1 rounded bg-amber-600 hover:bg-amber-500 text-slate-950 font-medium inline-flex items-center gap-1 disabled:opacity-60"
                          >
                            <LogIn className="w-3 h-3" /> Login as
                          </button>
                          <button
                            onClick={() => resetPw(u)}
                            disabled={busy === 'reset' + u.id}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 inline-flex items-center gap-1 disabled:opacity-60"
                          >
                            <KeyRound className="w-3 h-3" /> Reset PW
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Audit log */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="text-sm font-semibold mb-3">Audit Log (latest {logs.length})</h2>
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {logs.map((l) => (
              <div key={l.id} className="text-[11px] text-slate-400 border-b border-slate-800/40 py-1.5 flex flex-wrap gap-x-3">
                <span className="text-slate-500">{new Date(l.createdAt).toLocaleString()}</span>
                <span className="text-amber-400 font-medium">{l.action}</span>
                {l.target && <span>→ {l.target}</span>}
                {l.detail && <span className="text-slate-500">{l.detail}</span>}
                {l.actorPhone && <span className="ml-auto text-slate-600">{l.actorPhone}{l.ip ? ` · ${l.ip}` : ''}</span>}
              </div>
            ))}
            {logs.length === 0 && <p className="text-xs text-slate-600">No actions logged yet.</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
