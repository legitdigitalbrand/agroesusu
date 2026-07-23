#!/bin/bash
# Agroesusu Setup Script
# Run this after creating your Supabase project to apply the migration

set -e

echo "=== Agroesusu Setup ==="
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
  echo "Creating .env.local from .env.example..."
  cp .env.example .env.local
  echo ""
  echo "Please fill in your .env.local file with your Supabase and Safe Haven credentials."
  echo "Then run this script again."
  exit 1
fi

# Check if Supabase URL is set
if grep -q "NEXT_PUBLIC_SUPABASE_URL=$" .env.local 2>/dev/null || ! grep -q "NEXT_PUBLIC_SUPABASE_URL=https" .env.local; then
  echo "Please set NEXT_PUBLIC_SUPABASE_URL in .env.local"
  exit 1
fi

echo "✓ .env.local configured"
echo ""

# Install dependencies if needed
if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi

echo "✓ Dependencies installed"
echo ""

# Run the build to check for errors
echo "Building the project..."
npm run build 2>&1 | tail -20

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "1. Run 'npm run dev' to start the dev server"
echo "2. Go to http://localhost:3000"
echo "3. Sign up and test the onboarding flow"
echo "4. For production, deploy to Vercel (see DEPLOYMENT.md)"
