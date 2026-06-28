// Runs once at server startup (before requests are served). Used to self-migrate
// the database schema on a fresh deploy, so no shell/SSH step is required.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  try {
    const { ensureSchema } = await import('@/lib/ensure-schema')
    await ensureSchema()
  } catch {
    // never block server startup on this
  }
}
