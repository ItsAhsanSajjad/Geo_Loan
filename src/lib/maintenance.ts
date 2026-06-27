import { db } from '@/lib/db'

// Short in-memory cache so the maintenance flag isn't a DB hit on every request.
let cache: { mode: boolean; message: string | null; at: number } | null = null
const TTL_MS = 5000

export interface MaintenanceState {
  mode: boolean
  message: string | null
}

export async function getMaintenance(): Promise<MaintenanceState> {
  const now = Date.now()
  if (cache && now - cache.at < TTL_MS) return { mode: cache.mode, message: cache.message }
  try {
    const s = await db.setting.findUnique({
      where: { id: 'default' },
      select: { maintenanceMode: true, maintenanceMessage: true },
    })
    cache = { mode: !!s?.maintenanceMode, message: s?.maintenanceMessage ?? null, at: now }
  } catch {
    // On any read failure, fail OPEN (app stays up) rather than locking everyone out.
    cache = { mode: false, message: null, at: now }
  }
  return { mode: cache.mode, message: cache.message }
}

// Call after toggling the flag so the next request sees the change immediately.
export function invalidateMaintenanceCache() {
  cache = null
}

export const MAINTENANCE_MESSAGE_FALLBACK = 'System under maintenance. Please check back shortly.'
