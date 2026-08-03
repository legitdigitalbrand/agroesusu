# Accessing the /dev Admin Portal

## Why you couldn't access it

`/dev` is gated by `is_staff()` (checks the `staff_users` table via
`middleware.ts` → `ADMIN_ROUTES`). Nobody could get in because **no row
existed in `staff_users` yet** — there was no seeded admin account.

The app *does* ship a bootstrap endpoint for exactly this situation
(`POST /api/dev/bootstrap`), but the original version had a critical bug:
it would promote **any authenticated user** to `super_admin` with no
gating at all — a live privilege-escalation hole in production. This has
been fixed (commit in this PR): the endpoint now requires an
`ADMIN_BOOTSTRAP_SECRET` header AND only works while `staff_users` is
completely empty. After the first admin is created, the endpoint
permanently refuses to run again — it can never be used to add a second
admin.

## How to become the first admin (one-time)

1. **Set the secret** — add `ADMIN_BOOTSTRAP_SECRET` to your production
   env (Vercel → Project → Settings → Environment Variables) with a long
   random value, e.g. generate one with `openssl rand -hex 32`. Redeploy.
2. **Log in normally** at `https://agriqcap.vercel.app/login` with your
   existing customer account (email + password).
3. **Call the bootstrap endpoint once**, while your browser session is
   active, from a terminal (replace `<SECRET>` with the value you set):

   ```bash
   curl -X POST https://agriqcap.vercel.app/api/dev/bootstrap \
     -H "x-bootstrap-secret: <SECRET>" \
     -H "Cookie: <paste your browser's cookie header for the site>"
   ```

   Easiest way to get the cookie header: open DevTools → Network tab on
   the site while logged in → any request → copy the `Cookie` request
   header.

   You should get back:
   ```json
   { "message": "Super Admin created successfully. This bootstrap endpoint is now permanently locked.", ... }
   ```
4. **Log out and back in**, then visit `https://agriqcap.vercel.app/dev`.
   You now have `super_admin` — full access to Dashboard, Products, Loan
   Review, Cooperatives, Audit Log, Compliance, and Staff & RBAC.
5. **Remove `ADMIN_BOOTSTRAP_SECRET`** from your env once done (optional —
   the endpoint is already self-locking, but removing it is defense in depth).

## Adding more staff later

Once you're in, use `/dev/staff` (Staff & RBAC) to invite and role-assign
additional team members — no more bootstrap secrets needed.

## Required role

- Route guard: `is_staff()` Postgres function checks `staff_users.employment_status = 'active'`.
- Role needed for full access: `super_admin` (see `staff_role_assignments`).
- Other roles available (least to most privilege as needed): `customer_support`, `marketing`, `compliance`, `finance`, `loan_officer`, `operations`, `super_admin`.
