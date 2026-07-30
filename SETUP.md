# Agriqcap — Local Development Setup

## Prerequisites

- Node.js 18+ (recommend 20 LTS)
- npm or yarn
- A Supabase project (see below)
- Git

## 1. Clone and Install

```bash
git clone https://github.com/legitdigitalbrand/agroesusu.git
cd agroesusu  # repo is still named agroesusu on GitHub
npm install
```

## 2. Supabase Project Setup

### Option A: Use Existing Project

The project already has a Supabase project configured:
- **Project Ref:** `vhzsnsovfjnztawzuueo`
- **URL:** `https://vhzsnsovfjnztawzuueo.supabase.co`
- **Region:** eu-west-1

If you have access to this project, skip to Step 3.

### Option B: Create New Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Note the **Project URL** and **API Keys** (anon + service_role).
3. Email confirmation is disabled for sandbox development (enable for production).

## 3. Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# REQUIRED — Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# REQUIRED — App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# REQUIRED — Cron job auth (generate a random string)
CRON_SECRET=your-random-secret

# OPTIONAL — Safe Haven (Phase 2+)
SAFE_HAVEN_ENV=sandbox
# SAFE_HAVEN_API_KEY=
# SAFE_HAVEN_SECRET_KEY=
# SAFE_HAVEN_WEBHOOK_SECRET=
```

**Never commit `.env.local` to git.** It's in `.gitignore`.

## 4. Apply Database Migrations

Migrations are in `supabase/migrations/`. Apply them in order:

### Using Supabase CLI (recommended)

```bash
npm install -g supabase
supabase login
supabase link --project-ref your-project-ref

# Apply each migration in order
supabase db push
```

### Using the Supabase Management API (alternative)

If the CLI is blocked by Cloudflare, use the Management API with a custom User-Agent:

```bash
# See scripts/apply-migrations.sh (if created)
# Or apply manually via the Supabase Dashboard SQL Editor
```

### Migration Order

| # | File | Description |
|---|---|---|
| 00001 | `00001_initial_schema.sql` | **SKIP** — prototype tables (already applied, will be dropped) |
| 00002 | `00002_drop_prototype_tables.sql` | Drops all prototype tables from 00001 |
| 00003 | `00003_rbac_foundation.sql` | Enterprise RBAC: roles, permissions, staff_users, assignments |
| 00004 | `00004_customer_skeleton.sql` | Customer identity skeleton (from Volume 05 Part 5.3) |
| 00005 | `00005_audit_log.sql` | Append-only audit log (from Volume 04 Part 4.15) |

## 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## 6. Verify the Setup

1. **Auth:** Go to `/signup` and create an account. Check Supabase Dashboard → Authentication → Users.
2. **Customer:** After signup, a row should appear in `public.customers` (once the auto-creation trigger is set up in Phase 2).
3. **RBAC:** To create a staff user, manually insert into `staff_users` and assign a role via `staff_role_assignments` (admin tooling comes in Phase 2).

## Project Structure

```
/src
  /app                    # Next.js App Router (pages + API routes)
    /(auth)               # Auth pages (login, signup, onboarding)
    /(marketing)          # Public marketing pages
    /(app)                # Authenticated app pages
    /api                  # API routes (BFF layer)
  /modules                # DDD bounded contexts (Phase 1: empty placeholders)
    /identity
    /membership
    /compliance
    /wallet
    /ledger
    /savings
    /loans
    /investments
    /group-savings
    /communications
    /reporting
    /administration
    /configuration
    /audit
    /risk
    /integrations
  /shared                 # Cross-cutting utilities and types
  /bff                    # Backend-for-Frontend API handlers
  /components             # React UI components
  /lib                    # Infrastructure (Supabase clients, etc.)
  /middleware.ts          # Auth middleware (session refresh + route protection)
/supabase
  /migrations             # SQL migrations (apply in order)
/docs                     # Architecture docs (RLS strategy, etc.)
ARCHITECTURE_DECISIONS.md # ADR records
SETUP.md                  # This file
```

## Key Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npm run type-check   # TypeScript type checking (tsc --noEmit)
```

## Architecture References

- **Volume 01-03:** Business requirements and platform architecture
- **Volume 04:** Detailed domain architecture (23 sections)
- **Volume 05:** Enterprise data model and domain schemas
- **ARCHITECTURE_DECISIONS.md:** Key technical decisions and rationale
- **docs/RLS_STRATEGY.md:** Row-Level Security approach and policy conventions

## Troubleshooting

### Signup hangs indefinitely
Ensure all env vars are set in `.env.local`. The Supabase client throws if `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` are missing.

### "Not authenticated" on onboarding
The middleware refreshes the Supabase session on every route. If this fails, check that the Supabase URL and anon key are correct.

### Migration fails with Cloudflare 1010 error
Use the Supabase Management API with `User-Agent: SupabaseCLI/2.0.0` header, or apply via the Supabase Dashboard SQL Editor.
