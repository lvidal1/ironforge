# Command Center

Local AI assistant infrastructure: llama.cpp inference server + OpenClaw gateway UI.

## Architecture

```
┌─────────────┐     ┌──────────────────────┐     ┌──────────────────┐
│   OpenClaw   │     │  Inference Server     │     │ CUDA GPU         │
│  :18789      │────▶│  :8081 (llama.cpp)    │────▶│ RTX 4090         │
│  (UI/Agent)  │     │  (MTP + spec decode)  │     │                  │
│              │     │                      │     │                  │
│  ┌────────┐  │     │                      │     │                  │
│  │ Discord│──┘     │                      │     │                  │
│  │  Slack │        │                      │     │                  │
│  └────────┘        │                      │     │                  │
└─────────────────────┘                      │     │                  │
                                             │     │                  │
                                     ┌──────────────────┐            │
                                     │  Discord + Slack  │◀───────────┘
                                     │  (APIs)           │
                                     └──────────────────┘
         ▲
         │
    ┌─────────┐
    │   Pi    │
    │  (API)  │
    └─────────┘
```

### Services
- **llama-backend** — Inference server using llama.cpp with MTP (Multi-Token Prediction). Exposes OpenAI-compatible API at `/v1`.
- **openclaw** — Gateway providing a web UI and agent framework. Routes to llama-backend via Docker network.
- **Discord** — Bot integration via `DISCORD_BOT_TOKEN` env var (Socket Mode equivalent).
- **Slack** — Bot integration via `SLACK_APP_TOKEN` + `SLACK_BOT_TOKEN` env vars (Socket Mode).
- **Pi** — Consumes the inference API on port 8081 (not managed by this repo).

### Stack Separation

The stack is split into two independent Docker Compose projects:

| File | Services | Lifecycle |
|------|----------|-----------|
| `docker-compose.llama.yaml` | llama-backend | Stable, runs independently |
| `docker-compose.yaml` | openclaw (and future consumers) | Frequent upgrades, no inference impact |

This ensures that OpenClaw upgrades or restarts never interrupt the inference layer.

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

# 3. Create the shared Docker network (one-time)
docker network create command-center-net

# 4. Start the inference server
docker compose -f docker-compose.llama.yaml up -d

# 5. Deploy OpenClaw gateway config (one-time, see below)
bash scripts/deploy-config.sh

# 6. Start OpenClaw
docker compose up -d

# 7. Verify
curl http://localhost:8081/v1/models        # Should return model info
curl http://localhost:18789/                  # Should return gateway UI
```

### Convenience Scripts

```bash
# Start everything
./start.sh

# Stop everything
./stop.sh
```

## Configuration

### Environment Variables

See `.env.example`. Required variables:
- `OPENCLAW_GATEWAY_TOKEN` — Gateway authentication token

Optional variables (set to connect messaging channels):
- `DISCORD_BOT_TOKEN` — Discord bot token (optional, for Discord integration)
- `SLACK_APP_TOKEN` — Slack App-Level Token with `connections:write` scope (optional, Socket Mode)
- `SLACK_BOT_TOKEN` — Slack Bot Token (optional, Socket Mode)

### Docker Compose — Inference Server

`docker-compose.llama.yaml` defines:
- **llama-backend**: GPU inference with MTP enabled (`--spec-type draft-mtp`, `--spec-draft-n-max 2`)
- `restart: unless-stopped` — automatic recovery from crashes
- External network: `command-center-net`

### Docker Compose — Consumers

`docker-compose.yaml` defines:
- **openclaw**: Gateway UI with token auth
- No `depends_on` — starts immediately, handles connection retry
- External network: `command-center-net`

### OpenClaw Gateway Config

**Configuration is stored in a Docker volume** (`openclaw-data`), with **secrets injected via environment variables**.

When deploying fresh:

```bash
# Deploy via helper script (recommended)
bash scripts/deploy-config.sh
```

**Key config fields:**
- `gateway.auth.token` — must match `OPENCLAW_GATEWAY_TOKEN` in `.env`
- `gateway.bind` — set to `lan` for LAN access
- `channels.discord.accounts.default.token` — uses env var reference `{source: "env", id: "DISCORD_BOT_TOKEN"}`
- `channels.slack.appToken` — uses env var reference `{source: "env", id: "SLACK_APP_TOKEN"}`
- `channels.slack.botToken` — uses env var reference `{source: "env", id: "SLACK_BOT_TOKEN"}`
- `plugins.entries.discord.enabled` / `plugins.entries.slack.enabled` — toggle channel plugins

**Security model**: Tokens are injected at runtime via Docker environment variables and read by OpenClaw's env var resolver. No secrets are persisted in config files or volumes.

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

Any GGUF model works — just update the `-m` flag in `docker-compose.llama.yaml` to match your file.

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

### Discord bot not responding
1. Ensure `DISCORD_BOT_TOKEN` is set in `.env` (not empty)
2. Restart: `docker compose restart openclaw`
3. Check logs: `docker logs openclaw | grep discord`
4. Verify the bot uses Discord's `@` mention dropdown (plain `@Name` text is not recognized)

### Slack bot not responding
1. Ensure `SLACK_APP_TOKEN` and `SLACK_BOT_TOKEN` are set in `.env` (not empty)
2. Install plugin: `docker exec openclaw openclaw plugins install @openclaw/slack`
3. Restart: `docker compose restart openclaw`
4. Check logs: `docker logs openclaw | grep -i slack`
5. Verify Socket Mode is enabled in your Slack App dashboard
6. Confirm the app-level token has the `connections:write` scope

### Connection refused on port 8081
Ensure the model file path in `docker-compose.llama.yaml` matches the actual file in `models/`. Check `docker logs llama_backend` for model loading errors.

### MTP not active
Verify `--spec-type draft-mtp` is present in the llama-backend command. Check logs for `draft acceptance rate` — if missing, MTP is not enabled.

### Inference server down when restarting OpenClaw
This should not happen with the split architecture. If you see this, verify both containers are on the `command-center-net` network:

```bash
docker network inspect command-center-net
```

If a container is missing, reconnect it:
```bash
docker network connect command-center-net <container_name>
```

## Plugin Installation

After deploying config, install channel plugins via CLI:

```bash
# Discord plugin (pre-installed with OpenClaw)
# No additional install needed

# Slack plugin
openclaw plugins install @openclaw/slack
```

## License

Model weights: Apache 2.0 (Qwen)
Code: (add your license here)
