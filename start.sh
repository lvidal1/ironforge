#!/bin/bash
# Start the full stack — inference server and all consumers

set -euo pipefail

cd "$(dirname "$0")"

echo "=== Starting Inference Server ==="
docker compose -f docker-compose.llama.yaml up -d
echo ""

echo "=== Starting Consumer Services ==="
docker compose up -d
echo ""

echo "=== All services running ==="
docker compose -f docker-compose.llama.yaml ps
docker compose ps
