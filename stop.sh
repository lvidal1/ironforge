#!/bin/bash
# Stop the full stack — inference server and all consumers

set -euo pipefail

cd "$(dirname "$0")"

echo "=== Stopping Consumer Services ==="
docker compose down
echo ""

echo "=== Stopping Inference Server ==="
docker compose -f docker-compose.llama.yaml down
echo ""

echo "=== All services stopped ==="
