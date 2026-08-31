#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# velocit.ee — VM provisioning script
# Ubuntu 24.04 LTS — idempotent, safe to run more than once
#
# Usage (run as root on the fresh VM):
#   sudo bash setup.sh
#
# To also install the Cloudflare Tunnel in one pass, set the token first:
#   export CLOUDFLARE_TUNNEL_TOKEN="eyJ..."
#   sudo -E bash setup.sh
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
APP_USER="velocitee"
APP_DIR="/home/${APP_USER}/velocitee"
REPO_URL="${REPO_URL:-https://github.com/YOUR_USERNAME/velocitee.git}"
NODE_MAJOR="22"
PG_VERSION="16"
MGMT_CIDR="192.168.1.0/24"   # management subnet — override via MGMT_CIDR env var

# ── Colours ───────────────────────────────────────────────────────────────────
GRN='\033[0;32m' YLW='\033[1;33m' RED='\033[0;31m' NC='\033[0m'
log()  { echo -e "${GRN}[$(date +%H:%M:%S)]${NC} $*"; }
warn() { echo -e "${YLW}[WARN]${NC} $*"; }
die()  { echo -e "${RED}[FAIL]${NC} $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Run as root: sudo bash setup.sh"

# ─────────────────────────────────────────────────────────────────────────────
# 1. System update
# ─────────────────────────────────────────────────────────────────────────────
log "Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq

log "Installing base utilities..."
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
  curl wget gnupg2 ca-certificates lsb-release git \
  ufw fail2ban unattended-upgrades apt-listchanges

# ─────────────────────────────────────────────────────────────────────────────
# 2. Node.js (via NodeSource)
# ─────────────────────────────────────────────────────────────────────────────
CURRENT_NODE_MAJOR=$(node --version 2>/dev/null | sed 's/v//' | cut -d. -f1 || echo 0)
if [[ "$CURRENT_NODE_MAJOR" -lt "$NODE_MAJOR" ]]; then
  log "Installing Node.js ${NODE_MAJOR}..."
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - 2>/dev/null
  apt-get install -y nodejs
else
  log "Node.js $(node --version) already installed — skipping"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 3. PostgreSQL 16
# ─────────────────────────────────────────────────────────────────────────────
if ! dpkg -l "postgresql-${PG_VERSION}" &>/dev/null; then
  log "Installing PostgreSQL ${PG_VERSION}..."
  apt-get install -y "postgresql-${PG_VERSION}"
else
  log "PostgreSQL ${PG_VERSION} already installed — skipping"
fi

systemctl enable postgresql
systemctl start postgresql

# ─────────────────────────────────────────────────────────────────────────────
# 4. PM2
# ─────────────────────────────────────────────────────────────────────────────
if ! command -v pm2 &>/dev/null; then
  log "Installing PM2..."
  npm install -g pm2 --quiet
else
  log "PM2 $(pm2 --version) already installed — skipping"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 5. cloudflared
# ─────────────────────────────────────────────────────────────────────────────
if ! command -v cloudflared &>/dev/null; then
  log "Installing cloudflared..."
  mkdir -p --mode=0755 /usr/share/keyrings
  curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
    | tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
  echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] \
https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" \
    | tee /etc/apt/sources.list.d/cloudflared.list
  apt-get update -qq
  apt-get install -y cloudflared
else
  log "cloudflared already installed — skipping"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 6. Create app user
# ─────────────────────────────────────────────────────────────────────────────
if ! id "${APP_USER}" &>/dev/null; then
  log "Creating OS user ${APP_USER}..."
  useradd -r -m -s /bin/bash "${APP_USER}"
else
  log "OS user ${APP_USER} already exists — skipping"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 7. PostgreSQL user + database
# ─────────────────────────────────────────────────────────────────────────────
log "Setting up PostgreSQL..."

PG_USER_EXISTS=$(sudo -u postgres psql -tAc \
  "SELECT 1 FROM pg_roles WHERE rolname='${APP_USER}'" 2>/dev/null || echo "")

if [[ "$PG_USER_EXISTS" != "1" ]]; then
  sudo -u postgres createuser --no-superuser --no-createdb --no-createrole "${APP_USER}"
  log "Created PostgreSQL role ${APP_USER}"
else
  log "PostgreSQL role ${APP_USER} already exists — skipping"
fi

PG_DB_EXISTS=$(sudo -u postgres psql -tAc \
  "SELECT 1 FROM pg_database WHERE datname='${APP_USER}'" 2>/dev/null || echo "")

if [[ "$PG_DB_EXISTS" != "1" ]]; then
  sudo -u postgres createdb -O "${APP_USER}" "${APP_USER}"
  log "Created PostgreSQL database ${APP_USER}"
else
  log "PostgreSQL database ${APP_USER} already exists — skipping"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 8. Clone / update repo
# ─────────────────────────────────────────────────────────────────────────────
if [[ -d "${APP_DIR}/.git" ]]; then
  log "Pulling latest code..."
  sudo -u "${APP_USER}" git -C "${APP_DIR}" pull --ff-only
elif [[ -f "${APP_DIR}/package.json" ]]; then
  log "Code already present at ${APP_DIR} — skipping clone"
elif [[ -n "${REPO_URL:-}" ]] && [[ "${REPO_URL}" != "https://github.com/YOUR_USERNAME/velocitee.git" ]]; then
  log "Cloning repository from ${REPO_URL}..."
  sudo -u "${APP_USER}" git clone "${REPO_URL}" "${APP_DIR}"
else
  die "No code at ${APP_DIR} and REPO_URL is not set. Copy code manually or set REPO_URL."
fi

# ─────────────────────────────────────────────────────────────────────────────
# 9. npm install + Astro build
# ─────────────────────────────────────────────────────────────────────────────
log "Installing Node.js dependencies (Express)..."
sudo -u "${APP_USER}" bash -c "cd '${APP_DIR}' && npm ci --omit=dev --quiet"

log "Installing Astro dependencies and building static site..."
# Astro is a build-time dependency only — kept in site/package.json so the
# Express server's runtime is not bloated with the Astro toolchain. Running
# build here produces site/dist/ which server.js auto-detects.
sudo -u "${APP_USER}" bash -c "cd '${APP_DIR}/site' && npm install --quiet && npm run build"

# ─────────────────────────────────────────────────────────────────────────────
# 10. Database schema
# ─────────────────────────────────────────────────────────────────────────────
log "Applying database schema..."
sudo -u "${APP_USER}" psql -d "${APP_USER}" -f "${APP_DIR}/db/schema.sql"

# ─────────────────────────────────────────────────────────────────────────────
# 11. .env setup
# ─────────────────────────────────────────────────────────────────────────────
if [[ ! -f "${APP_DIR}/.env" ]]; then
  warn ".env not found — copying .env.example as starting point"
  sudo -u "${APP_USER}" cp "${APP_DIR}/.env.example" "${APP_DIR}/.env"
  warn ">>> IMPORTANT: edit ${APP_DIR}/.env before starting the app <<<"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 12. UFW firewall
# ─────────────────────────────────────────────────────────────────────────────
log "Configuring UFW firewall..."
ufw --force reset 2>/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow from "${MGMT_CIDR}" to any port 22 comment "SSH from management VLAN"
ufw --force enable
log "UFW enabled — inbound SSH allowed only from ${MGMT_CIDR}"

# ─────────────────────────────────────────────────────────────────────────────
# 13. fail2ban
# ─────────────────────────────────────────────────────────────────────────────
log "Configuring fail2ban..."
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
port    = ssh
EOF
systemctl enable fail2ban
systemctl restart fail2ban

# ─────────────────────────────────────────────────────────────────────────────
# 14. Unattended security upgrades
# ─────────────────────────────────────────────────────────────────────────────
log "Enabling unattended-upgrades..."
cat > /etc/apt/apt.conf.d/20auto-upgrades << 'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF
systemctl enable unattended-upgrades
systemctl start unattended-upgrades

# ─────────────────────────────────────────────────────────────────────────────
# 15. PM2 — systemd service + start app
# ─────────────────────────────────────────────────────────────────────────────
log "Setting up PM2 systemd service..."

# Create systemd unit as root
env PATH="$PATH:/usr/bin:/usr/local/bin" \
  pm2 startup systemd -u "${APP_USER}" --hp "/home/${APP_USER}" | tail -1 | bash

# Start app and persist process list as app user
sudo -u "${APP_USER}" bash -c "
  cd '${APP_DIR}' && \
  pm2 start ecosystem.config.js && \
  pm2 save
"

systemctl enable "pm2-${APP_USER}"

# ─────────────────────────────────────────────────────────────────────────────
# 16. Cloudflare Tunnel (optional — requires CLOUDFLARE_TUNNEL_TOKEN)
# ─────────────────────────────────────────────────────────────────────────────
if [[ -n "${CLOUDFLARE_TUNNEL_TOKEN:-}" ]]; then
  log "Installing Cloudflare Tunnel service..."
  cloudflared service install "${CLOUDFLARE_TUNNEL_TOKEN}"
  systemctl start cloudflared
  systemctl enable cloudflared
  log "Cloudflare Tunnel installed and running"
else
  warn "CLOUDFLARE_TUNNEL_TOKEN not set — skipping tunnel setup"
  warn "After you create the tunnel in Cloudflare dashboard, run:"
  warn "  sudo cloudflared service install <YOUR_TOKEN>"
  warn "  sudo systemctl enable --now cloudflared"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Done
# ─────────────────────────────────────────────────────────────────────────────
log ""
log "══════════════════════════════════════════════════════"
log " velocit.ee setup complete!"
log "══════════════════════════════════════════════════════"
log ""
log " Next steps:"
log "   1. Edit ${APP_DIR}/.env (fill in all required values)"
log "   2. Generate bcrypt hash for admin password:"
log "      node -e \"require('bcryptjs').hash('yourpass',12).then(console.log)\""
log "   3. Restart app after editing .env:"
log "      sudo -u ${APP_USER} pm2 restart velocitee"
log "   4. Set up Cloudflare Tunnel (see README.md)"
log "   5. Configure Resend DNS records in Cloudflare (see README.md)"
log ""
log " Useful commands:"
log "   sudo -u ${APP_USER} pm2 status"
log "   sudo -u ${APP_USER} pm2 logs velocitee"
log "   sudo -u ${APP_USER} pm2 restart velocitee"
log ""
