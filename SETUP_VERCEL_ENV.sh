#!/bin/bash
# ================================================================
# AgroEsusu — Vercel Environment Variable Setup Script
# Run this locally with: bash SETUP_VERCEL_ENV.sh
# Requires: vercel CLI installed + logged in (vercel login)
# ================================================================

set -e

PROJECT="agroesusu"
CRON_SECRET="QzyKBcJeEGP/lvl3osAUiOugvZEfdwmrQVAFn+CUaa8="

echo "Setting up Vercel environment variables for $PROJECT..."

# CRON_SECRET — used by all cron routes + GitHub Actions backup
echo "$CRON_SECRET" | vercel env add CRON_SECRET production --force 2>/dev/null ||   vercel env rm CRON_SECRET production --yes 2>/dev/null && echo "$CRON_SECRET" | vercel env add CRON_SECRET production

echo ""
echo "✅ CRON_SECRET set in Vercel production environment"
echo ""
echo "Verify with: vercel env ls production"
echo ""
echo "Your CRON_SECRET (also set in GitHub Actions secrets):"
echo "$CRON_SECRET"
