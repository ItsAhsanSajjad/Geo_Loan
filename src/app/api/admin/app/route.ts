import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/session'

const MAX_BYTES = 100 * 1024 * 1024 // 100MB

// GET /api/admin/app -> current APK info
export async function GET() {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin
  const s = await db.setting.findUnique({ where: { id: 'default' }, select: { apkPath: true, apkVersion: true } })
  return NextResponse.json({ apkPath: s?.apkPath || null, apkVersion: s?.apkVersion || null })
}

// POST /api/admin/app  (multipart: file=.apk, version?)
// POST /api/admin/app?action=remove  -> remove the current APK (host blocks DELETE)
export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin

  if (req.nextUrl.searchParams.get('action') === 'remove') {
    const prev = await db.setting.findUnique({ where: { id: 'default' }, select: { apkPath: true } })
    if (prev?.apkPath?.startsWith('/downloads/')) {
      try { await fs.unlink(path.join(process.cwd(), 'public', prev.apkPath.replace(/^\//, ''))) } catch {}
    }
    await db.setting.update({ where: { id: 'default' }, data: { apkPath: null, apkVersion: null } })
    return NextResponse.json({ ok: true })
  }

  const fd = await req.formData()
  const file = fd.get('file') as File | null
  const version = String(fd.get('version') || '').trim()

  if (!file) return NextResponse.json({ error: 'Choose an APK file' }, { status: 400 })
  if (!(file.name || '').toLowerCase().endsWith('.apk')) {
    return NextResponse.json({ error: 'File must be an Android .apk' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'APK must be 100MB or smaller' }, { status: 400 })
  }

  const dir = path.join(process.cwd(), 'public', 'downloads')
  await fs.mkdir(dir, { recursive: true })

  const prev = await db.setting.findUnique({ where: { id: 'default' }, select: { apkPath: true } })
  const filename = `geoloan-${Date.now()}.apk`
  await fs.writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()))
  // remove the previous APK file
  if (prev?.apkPath?.startsWith('/downloads/')) {
    try { await fs.unlink(path.join(process.cwd(), 'public', prev.apkPath.replace(/^\//, ''))) } catch {}
  }

  const s = await db.setting.upsert({
    where: { id: 'default' },
    update: { apkPath: `/downloads/${filename}`, apkVersion: version || null },
    create: { id: 'default', apkPath: `/downloads/${filename}`, apkVersion: version || null },
  })
  return NextResponse.json({ ok: true, apkPath: s.apkPath, apkVersion: s.apkVersion })
}
