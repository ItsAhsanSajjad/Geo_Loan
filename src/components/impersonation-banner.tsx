'use client'

import { useEffect, useState } from 'react'

// Shows a fixed banner whenever the current session is a super admin impersonating
// another account, with one-click return. Mounted globally in the root layout.
export default function ImpersonationBanner() {
  const [on, setOn] = useState(false)
  const [phone, setPhone] = useState('')
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return
        if (d.impersonating && d.user) {
          setOn(true)
          setPhone(d.user.phone)
        }
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  if (!on) return null

  async function exit() {
    setExiting(true)
    try {
      const r = await fetch('/api/auth/stop-impersonating', { method: 'POST' })
      const d = await r.json().catch(() => ({}))
      window.location.href = d.redirect || '/superadmin/dashboard'
    } catch {
      setExiting(false)
    }
  }

  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 rounded-full bg-amber-500 text-slate-950 px-4 py-2 shadow-lg text-xs font-medium">
      <span>
        Viewing as <strong>{phone}</strong> · super-admin session
      </span>
      <button
        onClick={exit}
        disabled={exiting}
        className="rounded-full bg-slate-950 text-amber-300 px-3 py-1 font-semibold hover:bg-slate-800 disabled:opacity-60"
      >
        {exiting ? 'Exiting…' : 'Exit'}
      </button>
    </div>
  )
}
