#!/usr/bin/env bash
# Stand up Uptime Kuma at status.velocit.ee on the velocitee VM.
#
# This script is idempotent — re-run safely. It:
#   1. Installs Docker + the compose plugin if not already present.
#   2. Writes a docker-compose.yml under /opt/uptime-kuma/.
#   3. Starts the stack (binds to 127.0.0.1:3001 — Cloudflare Tunnel exposes it).
#   4. Adds an Ingress rule to the existing Cloudflare Tunnel mapping
#      status.velocit.ee → http://localhost:3001.
#   5. Prints next steps for finishing setup in the Uptime Kuma UI.
#
# Run on the velocitee VM (172.16.10.60) as root or with sudo.
#
# Required env vars (or pass via flags):
#   CLOUDFLARE_TUNNEL_NAME=velocitee   (existing tunnel name)
#
# Optional:
#   STATUS_HOSTNAME=status.velocit.ee
#   STATUS_PORT=3001
set -euo pipefail

STATUS_HOSTNAME="${STATUS_HOSTNAME:-status.velocit.ee}"
STATUS_PORT="${STATUS_PORT:-3001}"
TUNNEL_NAME="${CLOUDFLARE_TUNNEL_NAME:-velocitee}"
INSTALL_DIR="/opt/uptime-kuma"

if [[ $EUID -ne 0 ]]; then
  echo "error: run as root (sudo bash setup-status.sh)" >&2
  exit 1
fi

# ── 1. Docker + compose plugin ────────────────────────────────────────────────
if ! command -v docker >/dev/null 2>&1; then
  echo "[1/5] installing Docker …"
  curl -fsSL https://get.docker.com | sh
else
  echo "[1/5] Docker already installed."
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "      installing docker compose plugin …"
  apt-get install -y docker-compose-plugin
fi

# ── 2. compose stack ──────────────────────────────────────────────────────────
echo "[2/5] writing $INSTALL_DIR/docker-compose.yml …"
mkdir -p "$INSTALL_DIR"
cat > "$INSTALL_DIR/docker-compose.yml" <<EOF
# velocit.ee status — Uptime Kuma.
# Bound to 127.0.0.1 only; Cloudflare Tunnel terminates publicly at
# https://${STATUS_HOSTNAME}.
services:
  uptime-kuma:
    image: louislam/uptime-kuma:1.23.13
    container_name: uptime-kuma
    restart: unless-stopped
    ports:
      - "127.0.0.1:${STATUS_PORT}:3001"
    volumes:
      - kuma-data:/app/data
    environment:
      - UPTIME_KUMA_PORT=3001
      - UPTIME_KUMA_HOST=0.0.0.0
    healthcheck:
      test: ["CMD", "node", "extra/healthcheck.js"]
      interval: 60s
      timeout: 30s
      start_period: 180s
volumes:
  kuma-data:
EOF

# ── 3. start ──────────────────────────────────────────────────────────────────
echo "[3/5] starting Uptime Kuma …"
( cd "$INSTALL_DIR" && docker compose up -d )

# ── 4. Cloudflare tunnel ingress ──────────────────────────────────────────────
echo "[4/5] configuring Cloudflare tunnel ingress …"

CONFIG_FILE=""
for candidate in /etc/cloudflared/config.yml /home/cloudflared/.cloudflared/config.yml /root/.cloudflared/config.yml; do
  if [[ -f "$candidate" ]]; then
    CONFIG_FILE="$candidate"
    break
  fi
done

if [[ -z "$CONFIG_FILE" ]]; then
  cat <<MSG
warning: could not locate cloudflared config.yml on this host. Add this
ingress entry by hand to your tunnel config (above the catch-all):

  - hostname: ${STATUS_HOSTNAME}
    service: http://localhost:${STATUS_PORT}

Then: systemctl restart cloudflared

Skipping automatic config edit.
MSG
else
  echo "      found config: $CONFIG_FILE"
  if grep -q "hostname: ${STATUS_HOSTNAME}" "$CONFIG_FILE"; then
    echo "      already routed — skipping."
  else
    # Insert before the catch-all '- service: http_status:404' line. If
    # there's no catch-all, append to ingress block.
    if grep -q "service: http_status:404" "$CONFIG_FILE"; then
      sed -i "/service: http_status:404/i\\  - hostname: ${STATUS_HOSTNAME}\\n    service: http://localhost:${STATUS_PORT}" "$CONFIG_FILE"
    else
      cat >> "$CONFIG_FILE" <<EOF

  - hostname: ${STATUS_HOSTNAME}
    service: http://localhost:${STATUS_PORT}
EOF
    fi
    echo "      added ingress rule."
    systemctl restart cloudflared || echo "      warning: cloudflared restart failed"
  fi

  cat <<MSG

      DNS: also create a CNAME for ${STATUS_HOSTNAME} pointing at the tunnel:
        cloudflared tunnel route dns ${TUNNEL_NAME} ${STATUS_HOSTNAME}
MSG
fi

# ── 5. next steps ─────────────────────────────────────────────────────────────
echo
echo "[5/5] done."
cat <<MSG

  next steps:
    1. point your browser at https://${STATUS_HOSTNAME} once DNS propagates
       (usually 30–60 seconds).
    2. complete the Uptime Kuma setup wizard — pick a strong admin password.
    3. add monitors for:
         - https://velocit.ee/health           (HTTP, expects 200)
         - https://velocit.ee                  (HTTP, expects 200)
         - https://docs.velocit.ee             (HTTP, expects 200)
    4. publish a status page at https://${STATUS_HOSTNAME}/status/velocitee
       (Settings → Status Pages → create).

  data lives in the 'kuma-data' Docker volume — back it up if you care
  about historical metrics.

MSG
