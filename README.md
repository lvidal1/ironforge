# Command Center

Local AI assistant infrastructure: llama.cpp inference server with MTP speculative decoding + OpenClaw gateway UI.

## Architecture

```
┌─────────────────┐     ┌──────────────────────┐     ┌──────────────┐
│   Browser        │     │  OpenClaw Gateway    │     │ llama.cpp    │
│  localhost:18789 │────▶│  openclaw:18789      │────▶│ llama_backend│
│  (Control UI)    │     │  (WebSocket/REST)    │     │ :8081        │
└─────────────────┘     └──────────────────────┘     └──────────────┘
                                                          │
                                                    ┌───────────┐
                                                    │ CUDA GPU  │
                                                    └───────────┘
```

### Services
- **llama-backend** — Inference server using llama.cpp with MTP (Multi-Token Prediction) speculative decoding. Exposes OpenAI-compatible API at `/v1`.
- **openclaw** — Gateway providing a web UI and agent framework. Routes to llama-backend via Docker network.

## Prerequisites

- Docker + Docker Compose
- NVIDIA GPU with CUDA support (tested: RTX 4090)
- NVIDIA Container Toolkit
- 30GB+ free disk space for model weights
- Port 8081 available (llama-backend API)
- Port 18789 available (OpenClaw UI)

## Quick Start

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Generate a gateway token
echo "OPENCLAW_GATEWAY_TOKEN=$(openssl rand -hex 32)" > .env
# Or set manually: OPENCLAW_GATEWAY_TOKEN=<your-secret>

# 3. Pull images and start
docker compose up -d

# 4. Deploy OpenClaw gateway config (one-time, see below)
bash scripts/deploy-config.sh

# 5. Verify
curl http://localhost:8081/v1/models        # Should return model info
curl http://localhost:18789/                  # Should return gateway UI
```

## Configuration

### Environment Variables

See `.env.example`. The only required variable is `OPENCLAW_GATEWAY_TOKEN`.

### Docker Compose

`docker-compose.yaml` defines two services:
- `llama-backend`: GPU inference with MTP enabled (`--spec-type draft-mtp`, `--spec-draft-n-max 2`)
- `openclaw`: Gateway UI with token auth

### OpenClaw Gateway Config ⚠️

**This configuration is stored in a Docker volume, NOT in the repository.**

When deploying fresh, restore the gateway config from `openclaw-config/openclaw.json.example`:

```bash
# Deploy via helper script (recommended)
bash scripts/deploy-config.sh

# Or manually:
docker cp openclaw-config/openclaw.json.example openclaw:/home/node/.openclaw/openclaw.json
docker compose restart openclaw
```

**Why is this outside the repo?**
- Contains sensitive auth token matching `.env`
- Must be installed into Docker volume `openclaw-data` at `/home/node/.openclaw/openclaw.json`
- Survives container rebuilds (persistent volume)
- Never committed to git

**Key config fields:**
- `gateway.auth.token` — must match `OPENCLAW_GATEWAY_TOKEN` in `.env`
- `gateway.bind` — set to `lan` for LAN access
- Device pairing — enabled by default

### Model Weights

The inference server expects a GGUF model file in the `models/` directory.

We recommend [unsloth/Qwen3.6-35B-A3B-MTP-GGUF](https://huggingface.co/unsloth/Qwen3.6-35B-A3B-MTP-GGUF) — a Qwen3.6-35B-A3B variant trained with MTP (Multi-Token Prediction) for faster inference.

To download:
```bash
# Install huggingface-cli
pip install huggingface_hub

# Download a quantized variant (e.g., Q5_K_XL ~27GB)
huggingface-cli download unsloth/Qwen3.6-35B-A3B-MTP-GGUF \
  Qwen3.6-35B-A3B-UD-Q5_K_XL.gguf \
  --local-dir models/
```

Any GGUF model works — just update the `-m` flag in `docker-compose.yaml` to match your file.

## Frontend Patching

OpenClaw has a known bug causing duplicate messages in the Control UI. A patch is applied at runtime:

```bash
# Apply the patch to the running container
bash openclaw-patches/fix-duplicates.sh
docker compose restart openclaw
```

The patch modifies the minified JS bundle to unconditionally clear `chatStreamSegments` before history reload.

## Troubleshooting

### Health check failing
Ensure `curl` is available inside the container image. The health check probes `http://localhost:8081/v1/models`.

### Duplicate messages in UI
Apply the frontend patch: `bash openclaw-patches/fix-duplicates.sh && docker compose restart openclaw`

### Gateway not starting
Check that `gateway.auth.token` in `openclaw.json` matches `OPENCLAW_GATEWAY_TOKEN` in `.env`. The token must also be set via environment variable for the container to read it at startup.

### Connection refused on port 8081
Ensure the model file path in `docker-compose.yaml` matches the actual file in `models/`. Check `docker logs llama-backend` for model loading errors.

### MTP not active
Verify `--spec-type draft-mtp` is present in the llama-backend command. Check logs for `draft acceptance rate` — if missing, MTP is not enabled.

## License

Model weights: Apache 2.0 (Qwen)
Code: (add your license here)
