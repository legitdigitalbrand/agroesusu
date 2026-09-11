# Launch Checklist — AgroPocket

Born from the 2026-09-11 incident: the app was deployed with database
migrations lagging behind the code. Deposits arrived at Safe Haven but the
journal-posting fix (00052) was never applied, so nothing ever posted to the
ledger — every balance read ₦0 and the wallet read "No wallet found", with
**no error anywhere in the UI**. Users found it before monitoring did.

This checklist exists so that class of failure cannot ship silently again.

---

## The guard (already in place)

| Layer | What it does |
|---|---|
| `src/lib/db-version.ts` | `REQUIRED_MIGRATION` — the minimum DB version the deployed code needs. **Bump it in the same PR** that adds a migration the code depends on. |
| `/api/health` (public) | Compares the DB's actual latest migration (via the `db_migration_status` view) against `REQUIRED_MIGRATION`. Returns **503 when the DB is behind**, plus stuck-event and failed-transaction counts. |
| `.github/workflows/health-guard.yml` | After every deploy to main, polls `/api/health` and **fails the check** on 503. Add "health" as a required status check on main. |
| Migrations table view (00057) | Exposes the DB's latest applied migration so the app can self-report. If the view is missing, health reports 503 — fail-closed. |

**Monitoring:** point uptime monitoring at `https://agriqcap.vercel.app/api/health`.
Alert on 503. Watch `money_movement.stuck_events` — anything above 0 for more
than a few minutes means money arrived but was never credited (the exact
incident signature).

---

## Every deploy

1. **Migrations travel with code.** Run `supabase db push` **before** (or in the
   same window as) deploying to production. Code that needs a migration must
   not run against a database that lacks it.
2. Confirm the GitHub **"health" check passed** for the deploy commit. If it
   failed with 503: apply pending migrations, do not ship.
3. If deposits are live: watch `/api/health` `stuck_events` for 10 minutes.

## Before public launch (one-time)

1. **End-to-end money test with real ₦50–100:**
   - Deposit via bank transfer to the DVA.
   - Verify: `journal_entries` gets a **posted** entry (status `posted`,
     `posted_at` set) — this is the step that was broken in the incident.
   - Verify: wallet balance updates in the UI, transaction history shows the
     credit, `/api/health` shows `stuck_events: 0`.
   - Verify: transfer out with the PIN flow works end-to-end.
2. **Resolve all stuck events:** `GET /api/cron/process-events` (Bearer
   CRON_SECRET) until `stuck_events` is 0. Every event older than an hour is
   money sitting uncredited.
3. **Reconcile:** run wallet reconciliation (`/api/cron/reconcile`) and confirm
   no new flags. Escrow accounts should be zero after settlements complete.
4. **Backups:** confirm Supabase PITR / daily backups are on. Test one restore
   into a staging project — an untested backup is not a backup.
5. **Verify these are set in Supabase + Vercel:** CRON_SECRET, Safe Haven
   credentials, Resend/OTP config, and that Vercel cron jobs for
   `/api/cron/*` are active (process-events should run every few minutes).

## If balances show ₦0 / "No wallet found" again

1. `curl https://agriqcap.vercel.app/api/health` — 503 means migrations are
   behind: apply them (`supabase db push`), then reprocess events (step 2).
2. `GET /api/cron/process-events` (Bearer CRON_SECRET) — re-credits stuck
   deposits idempotently (safe to run repeatedly).
3. If the wallet row itself is missing: the money is still at Safe Haven in
   the DVA. Recreate the wallet (bootstrap flow) or restore the row, then
   reprocess events. **The DVA balance is the source of truth for customer
   money; the ledger must be made to match it, never the other way round.**
4. After any manual ledger correction, run reconciliation and document the
   correction in the audit log.

---

## Money-safety rules (non-negotiable)

- The ledger is the financial record of truth. If a balance disagrees with the
  ledger, the *display* is wrong — never "patch" a balance number.
- Deposits are credited only from verified Safe Haven webhook events, exactly
  once (idempotent by `external_event_id` + FT references). Never credit on
  unconfirmed data.
- Before any schema-affecting deploy, `supabase db push` first; if it fails,
  stop — do not deploy the code that depends on it.
