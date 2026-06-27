# Deploy — Super Admin release

This release adds the SUPER_ADMIN role, control panel, maintenance kill-switch,
password reset, account impersonation, and an audit log.

Bundle: `geoloan-superadmin-deploy.tar.gz` (Next.js `output: standalone`).
It contains `server.js`, the built app, Prisma engines, `public/`, and a one-off
migration script `migrate-superadmin.mjs`. **No secrets are inside** — credentials
are set as environment variables on the server.

---

## 1. Upload & extract

Upload `geoloan-superadmin-deploy.tar.gz` to your app folder (e.g.
`/home/<cpaneluser>/geoloan`) via cPanel File Manager, then **Extract**.
After extraction you should see `server.js`, `migrate-superadmin.mjs`, `.next/`,
`node_modules/`, `public/`.

> Keep your existing `db/` folder and uploads — do NOT overwrite the live database.

## 2. Environment variables (cPanel → Setup Node.js App → Environment variables)

| Variable | Value |
|---|---|
| `DATABASE_URL` | `file:/home/<cpaneluser>/geoloan/db/custom.db` (your live DB path) |
| `SESSION_SECRET` | your existing 32+ char secret (unchanged) |
| `UPLOADS_DIR` | `/home/<cpaneluser>/private_uploads` |
| `NODE_ENV` | `production` |
| `SUPERADMIN_PHONE` | `03xxxxxxxxx` |
| `SUPERADMIN_PASSWORD_HASH` | the bcrypt hash (see step 4) |
| `NODE_OPTIONS` | `--max-old-space-size=256` |
| `UV_THREADPOOL_SIZE` | `2` |

Notes:
- In the cPanel env-var UI you paste the **raw bcrypt hash** — no `$` escaping needed.
- Use `SUPERADMIN_PASSWORD_HASH` (not the plaintext `SUPERADMIN_PASSWORD`) in production.
- Leave the SUPERADMIN_* vars unset to disable the super admin entirely.

## 3. Migrate the live database (non-destructive)

The schema gained `User.mustChangePassword`, `Setting.maintenanceMode`,
`Setting.maintenanceMessage`, and the `AuditLog` table. Apply them to the EXISTING DB
(keeps all data). From the app folder, in the cPanel Terminal (or "Run JS Script"):

```
cd /home/<cpaneluser>/geoloan
DATABASE_URL="file:/home/<cpaneluser>/geoloan/db/custom.db" node migrate-superadmin.mjs
```

Expected output: `OK`/`SKIP` lines then `Migration complete.` It is safe to run twice.

## 4. Generate the production password hash

On any machine with Node + bcryptjs (or locally in the project):

```
node -e "console.log(require('bcryptjs').hashSync(process.argv[1],10))" 'YourStrongPassword'
```

Copy the output (`$2a$10$....`) into `SUPERADMIN_PASSWORD_HASH`. Pick a long, unique
password — never reuse `password@123`.

## 5. Restart & verify

- cPanel → **Restart** the Node app (Passenger startup file = `server.js`).
- Visit `https://<your-domain>/superadmin` → log in with the phone + password.
- Confirm: dashboard loads, account list shows, audit log records `SUPERADMIN_LOGIN`.

## 6. Security checklist

- [ ] Strong, unique super-admin password (not the dev default).
- [ ] Credentials only in server env vars — never committed.
- [ ] `SESSION_SECRET` is set (required in production).
- [ ] HTTPS enabled (session cookie is `secure` in production).
- [ ] `/admin` and `/superadmin` are reachable only by direct URL (no public links).
- [ ] Migration ran (`AuditLog` table exists) — test a reset/impersonate and check the log.

## Note on hosting memory (unresolved)

The previous suspension was a host vmem limit (512 MB) vs Node's reserved virtual
memory — not a code leak. `NODE_OPTIONS`/`UV_THREADPOOL_SIZE` lower resident memory but
cannot satisfy a sub-~1 GB vmem cap. Ask the host to raise vmem (or enforce physical
memory), or move to a platform like Vercel + a hosted Postgres (Neon) where this limit
does not apply.
