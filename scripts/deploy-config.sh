#!/bin/bash
# Deploy OpenClaw gateway config into the Docker volume
# Reads token from .env file and applies the config template

set -euo pipefail

cd "$(dirname "$0")/.."

# Check .env exists
if [ ! -f .env ]; then
    echo "❌ .env not found. Copy .env.example to .env and set OPENCLAW_GATEWAY_TOKEN first."
    exit 1
fi

# Read token from .env
source .env
if [ -z "${OPENCLAW_GATEWAY_TOKEN:-}" ]; then
    echo "❌ OPENCLAW_GATEWAY_TOKEN not set in .env"
    exit 1
fi

# Read LAN IP for config
LAN_IP=$(hostname -I | awk '{print $1}' | grep -oE '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' || echo "192.168.1.1")
echo "Detected LAN IP: $LAN_IP"

# Generate config with token substitution
echo "Generating openclaw.json with token..."
cat openclaw-config/openclaw.json.example | sed "s/<replace-with-gateway-token-from-.env>/${OPENCLAW_GATEWAY_TOKEN}/g" | \
    sed "s/<replace-with-current-timestamp>/$(/bin/date -u +%Y-%m-%dT%H:%M:%S.000Z)/g" > /tmp/openclaw-config.json

# Deploy to Docker volume
echo "Deploying to openclaw container..."
docker cp /tmp/openclaw-config.json openclaw:/home/node/.openclaw/openclaw.json
rm -f /tmp/openclaw-config.json

echo "✅ OpenClaw config deployed successfully"
echo ""
echo "Next steps:"
echo "  1. Restart OpenClaw: docker compose restart openclaw"
echo "  2. Apply frontend patch: bash openclaw-patches/fix-duplicates.sh"
echo "  3. Access UI: http://localhost:18789"
