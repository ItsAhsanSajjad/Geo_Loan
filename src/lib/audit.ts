import { db } from '@/lib/db'
import type { SessionUser } from '@/lib/auth'

// Best-effort client IP from the standard proxy headers (LiteSpeed / cPanel set these).
export function getClientIp(req: Request): string | null {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip') || req.headers.get('cf-connecting-ip') || null
}

interface AuditInput {
  actor: Pick<SessionUser, 'id' | 'phone' | 'role'> | null
  action: string
  target?: string | null
  detail?: string | null
  ip?: string | null
}

// Append-only record of privileged actions. Must NEVER receive secrets or plaintext
// passwords in `detail`. Failures are swallowed so logging can't break the action.
export async function writeAudit({ actor, action, target, detail, ip }: AuditInput): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId: actor?.id ?? null,
        actorPhone: actor?.phone ?? null,
        role: actor?.role ?? null,
        action,
        target: target ?? null,
        detail: detail ?? null,
        ip: ip ?? null,
      },
    })
  } catch {
    // never throw from the audit path
  }
}
