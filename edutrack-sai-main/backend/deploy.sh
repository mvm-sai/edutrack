#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# Quick deploy helper for Fly.io. Requires flyctl installed and authenticated.
# Usage: DATABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." JWT_SECRET="..." ./deploy.sh

echo "Setting secrets on Fly (use environment vars)..."
flyctl secrets set DATABASE_URL="$DATABASE_URL" SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" JWT_SECRET="${JWT_SECRET:-changeme}"

echo "Deploying to Fly..."
flyctl deploy

echo "Done. Backend should be available at the Fly app's public URL." 
