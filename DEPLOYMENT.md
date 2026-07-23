# Agroesusu Deployment Guide

## Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click **New Project**
3. Name it `agroesusu` (or whatever you like)
4. Choose a region close to your users (e.g., EU West / Frankfurt for Nigeria)
5. Set a strong database password — save it somewhere safe
6. Click **Create Project** and wait ~2 minutes

## Step 2: Run the Schema Migration

1. In your Supabase project, go to **SQL Editor** (left sidebar)
2. Click **New Query**
3. Open `supabase/migrations/00001_initial_schema.sql` from this repo
4. Copy the ENTIRE file contents and paste into the SQL Editor
5. Click **Run**
6. You should see "Success. No rows returned."
7. Go to **Table Editor** — you should see 16 tables (profiles, wallets, loans, etc.)

## Step 3: Get Your Supabase API Keys

1. In Supabase, go to **Settings** → **API**
2. Copy these 3 values:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (click "Reveal" — keep this secret!)

## Step 4: Set Up Authentication

1. In Supabase, go to **Authentication** → **Providers**
2. Make sure **Email** is enabled (it's on by default)
3. For development, go to **Authentication** → **Settings** and disable "Confirm email" if you want instant signup
4. (Optional) Add your deployment URL to **Site URL** and **Redirect URLs** later

## Step 5: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign up/login
2. Click **Add New** → **Project**
3. Import the `legitdigitalbrand/agroesusu` GitHub repo
4. Framework should auto-detect as **Next.js**
5. **Don't deploy yet** — click **Environment Variables** and add these:

### Required Environment Variables

| Name | Value | Where to get it |
|------|-------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service_role key | Supabase → Settings → API |
| `SAFE_HAVEN_ENV` | `sandbox` | (use `production` when live) |
| `SAFE_HAVEN_API_KEY` | Your Safe Haven API key | Safe Haven dashboard |
| `SAFE_HAVEN_SECRET_KEY` | Your Safe Haven secret key | Safe Haven dashboard |
| `SAFE_HAVEN_WEBHOOK_SECRET` | Your Safe Haven webhook secret | Safe Haven dashboard |
| `CRON_SECRET` | Any random string (e.g. `my-secret-cron-key-123`) | Generate any random string |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` | Set after first deploy |

### Without Safe Haven Keys (Mock Mode)

If you don't have Safe Haven API keys yet, the app runs in **mock mode** automatically.
Just set the Supabase keys and `CRON_SECRET` — everything will work with simulated bank responses.

6. Click **Deploy**
7. Wait 1-2 minutes for the build to complete

## Step 6: Configure Auth Redirect URLs

After deployment, go back to Supabase → **Authentication** → **Settings**:
- **Site URL**: `https://your-app.vercel.app`
- **Redirect URLs**: `https://your-app.vercel.app/**`

## Step 7: Set Up Safe Haven Webhook (when you have API keys)

1. In Safe Haven dashboard, register your webhook URL:
   ```
   https://your-app.vercel.app/api/webhooks/safe-haven
   ```
2. Copy the webhook secret they give you
3. Update `SAFE_HAVEN_WEBHOOK_SECRET` in Vercel env vars

## Step 8: Create an Admin User

After signing up via the app, go to Supabase → **Table Editor** → **profiles**:
1. Find your user row
2. Change `role` from `user` to `admin`
3. Now you can access `/admin` in the app

## Verification Checklist

- [ ] Supabase project created
- [ ] Schema migration run successfully (16 tables visible)
- [ ] Supabase API keys copied
- [ ] Vercel project created and env vars set
- [ ] App deployed successfully
- [ ] Can sign up and see onboarding flow
- [ ] Can complete onboarding (BVN → Profile → KYC → Wallet → PIN)
- [ ] Can see dashboard with wallet balance
- [ ] Can apply for a loan
- [ ] Admin user created (role changed in Supabase)
- [ ] Admin can see review queue at `/admin`
