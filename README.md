# velocit.ee

Landing page backend for [velocit.ee](https://velocit.ee) — community infrastructure, built to last.

This repo contains everything needed to rebuild the public landing page and waitlist backend from bare metal. No prior context required.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 22 LTS |
| Framework | Express 4 |
| Database | PostgreSQL 16 (Unix socket, peer auth) |
| Process manager | PM2 (systemd-managed) |
| Public access | Cloudflare Tunnel (no open inbound ports) |
| Email | Resend |
| Runtime user | `velocitee` (non-root) |

---

## Repository structure

```
velocitee/
├── server.js              main entrypoint — binds to 127.0.0.1 only
├── routes/
│   ├── waitlist.js        POST /api/waitlist
│   ├── admin.js           GET /admin, GET /admin/export.csv
│   └── health.js          GET /health
├── middleware/
│   ├── auth.js            HTTP Basic Auth (bcrypt comparison)
│   ├── rateLimit.js       express-rate-limit for waitlist endpoint
│   └── validate.js        email validation + normalisation
├── db/
│   ├── index.js           pg Pool (Unix socket) + IP hashing
│   ├── schema.sql         full schema — idempotent, run from scratch
│   └── migrations/        future schema migrations go here
├── public/
│   └── index.html         landing page (static, served by Express)
├── ecosystem.config.js    PM2 process config
├── .env.example           all required env vars with descriptions
├── setup.sh               idempotent VM provisioning script
└── README.md              this file
```

---

## Environment variables

Copy `.env.example` to `.env` and fill in every value before starting the app.

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | no | HTTP port. Default: `3000` |
| `NODE_ENV` | yes | Set to `production` |
| `PGDATABASE` | no | PostgreSQL database name. Default: `velocitee` |
| `PGUSER` | no | PostgreSQL username. Default: `velocitee` |
| `PGHOST` | no | Unix socket path. Default: `/var/run/postgresql` |
| `IP_HASH_SALT` | **yes** | 32+ random bytes for HMAC-SHA256 IP hashing. Generate: `openssl rand -hex 32` |
| `ADMIN_USER` | **yes** | Admin dashboard username |
| `ADMIN_PASS` | **yes** | bcrypt hash of admin password. Generate: `node -e "require('bcryptjs').hash('yourpass',12).then(console.log)"` |
| `RESEND_API_KEY` | **yes** | API key from resend.com |
| `RESEND_AUDIENCE_ID` | **yes** | UUID of the "velocit.ee Waitlist" audience in Resend |
| `NOTIFY_PERSONAL_EMAIL` | **yes** | Personal email to receive signup notifications |

---

## Fresh VM setup (from bare metal)

### 1. Provision the VM in Proxmox

Create a VM with:
- **OS:** Ubuntu 24.04 LTS (server minimal)
- **CPU:** 2 vCPU
- **RAM:** 4 GB
- **Disk:** 20 GB
- **Network:** VLAN 10 (172.16.10.0/24 — lab network)
- **Hostname:** `velocitee`

Install Ubuntu, create a user with sudo access, and ensure SSH access.

### 2. Push this repo to GitHub (one time)

```bash
cd ~/velocitee
git init
git add .
git commit -m "initial commit"
git remote add origin git@github.com:YOUR_USERNAME/velocitee.git
git push -u origin main
```

### 3. Run the setup script on the VM

SSH into the VM as root (or a sudo user):

```bash
ssh user@<vm-ip>
sudo -i
```

Either clone the repo and run setup.sh, or pipe it directly:

```bash
# Option A — clone first
git clone https://github.com/YOUR_USERNAME/velocitee.git /tmp/velocitee-setup
REPO_URL=https://github.com/YOUR_USERNAME/velocitee.git bash /tmp/velocitee-setup/setup.sh

# Option B — set token at the same time (installs tunnel in one pass)
REPO_URL=https://github.com/YOUR_USERNAME/velocitee.git \
CLOUDFLARE_TUNNEL_TOKEN="eyJ..." \
bash /tmp/velocitee-setup/setup.sh
```

The script is idempotent — running it again is safe.

### 4. Fill in environment variables

```bash
sudo -u velocitee nano /home/velocitee/velocitee/.env
```

Fill in every value. Then generate the admin password hash:

```bash
node -e "require('bcryptjs').hash('YOUR_ADMIN_PASSWORD', 12).then(console.log)"
```

Paste the output as `ADMIN_PASS` in `.env`.

### 5. Restart the app

```bash
sudo -u velocitee pm2 restart velocitee
sudo -u velocitee pm2 save
```

---

## Manual Cloudflare steps

### A. Cloudflare Tunnel

You need a free Cloudflare account with `velocit.ee` added as a zone.

1. Go to **Cloudflare dashboard → Zero Trust → Networks → Tunnels**
2. Click **Create a tunnel** → choose **Cloudflared**
3. Name it `velocitee-tunnel`
4. Copy the install command — it contains your tunnel token (`eyJ...`)
5. On the VM, run:
   ```bash
   sudo cloudflared service install <YOUR_TOKEN>
   sudo systemctl enable --now cloudflared
   ```
6. Back in the Cloudflare dashboard, add two **Public Hostnames** to the tunnel:
   | Subdomain | Domain | Type | URL |
   |-----------|--------|------|-----|
   | *(empty)* | velocit.ee | HTTP | `localhost:3000` |
   | www | velocit.ee | HTTP | `localhost:3000` |
7. Cloudflare will automatically create CNAME DNS records.

Verify the tunnel is running:
```bash
sudo systemctl status cloudflared
```

### B. Resend — domain verification for `velocit.ee`

This is required before the app can send email from `hello@velocit.ee`.

1. Sign up at [resend.com](https://resend.com) (free tier is fine to start)
2. Go to **Domains → Add Domain → velocit.ee**
3. Resend will show you DNS records to add. Add them in Cloudflare:

   **In Cloudflare DNS for velocit.ee:**
   | Type | Name | Value | Proxy |
   |------|------|-------|-------|
   | TXT | `resend._domainkey` | (DKIM key from Resend) | DNS only |
   | TXT | `@` | `v=spf1 include:resendmail.io ~all` | DNS only |
   | MX | `send` | `feedback-smtp.us-east-1.amazonses.com` | DNS only |

   > The exact record values come from your Resend dashboard — copy them verbatim.

4. Click **Verify** in Resend — propagation usually takes 2–5 minutes through Cloudflare.
5. Create an **Audience** called `velocit.ee Waitlist` → copy its UUID → set as `RESEND_AUDIENCE_ID` in `.env`
6. Create an **API Key** with full access → set as `RESEND_API_KEY` in `.env`

### C. Cloudflare Email Routing for `hello@velocit.ee`

This forwards `hello@velocit.ee` to your personal email (free):

1. In Cloudflare dashboard → **Email → Email Routing**
2. Enable Email Routing for `velocit.ee`
3. Add a **Custom Address**: `hello` → your personal email
4. Accept the verification email that Cloudflare sends to your personal address
5. Cloudflare will add the required MX and SPF records automatically

### D. Cloudflare Access rule for `/admin` (recommended)

Adds a second layer of auth in front of the Basic Auth:

1. Go to **Zero Trust → Access → Applications → Add an Application**
2. Type: **Self-hosted**
3. Application domain: `velocit.ee/admin`
4. Create a policy: **Allow** → **Emails** → add your email address
5. Users will get an email OTP before reaching the Basic Auth prompt

---

## Admin dashboard

Access at: `https://velocit.ee/admin`

Your browser will prompt for HTTP Basic Auth. Enter `ADMIN_USER` and `ADMIN_PASS` (the plaintext password, not the hash).

Features:
- Total signup count
- Full waitlist with timestamps
- CSV export at `https://velocit.ee/admin/export.csv`

---

## Database

### Schema

The schema is in `db/schema.sql`. It is idempotent (`IF NOT EXISTS`) and safe to re-run.

Apply manually:
```bash
sudo -u velocitee psql -d velocitee -f /home/velocitee/velocitee/db/schema.sql
```

### Future migrations

Add numbered files to `db/migrations/` (e.g. `001_add_referral.sql`) and run them manually:
```bash
sudo -u velocitee psql -d velocitee -f /home/velocitee/velocitee/db/migrations/001_add_referral.sql
```

### Direct psql access

```bash
sudo -u velocitee psql -d velocitee
```

---

## PM2 commands

```bash
# Status
sudo -u velocitee pm2 status

# Logs (live tail)
sudo -u velocitee pm2 logs velocitee

# Restart after .env changes
sudo -u velocitee pm2 restart velocitee

# Save process list (persists across reboots)
sudo -u velocitee pm2 save

# Stop / start
sudo -u velocitee pm2 stop velocitee
sudo -u velocitee pm2 start ecosystem.config.js
```

The PM2 systemd service is `pm2-velocitee`:
```bash
sudo systemctl status pm2-velocitee
sudo systemctl restart pm2-velocitee
```

---

## Logs

```bash
# Application logs (PM2)
sudo -u velocitee pm2 logs velocitee
sudo -u velocitee pm2 logs velocitee --lines 200

# Log files
tail -f /home/velocitee/.pm2/logs/velocitee-out.log
tail -f /home/velocitee/.pm2/logs/velocitee-error.log

# Cloudflare Tunnel
sudo journalctl -u cloudflared -f

# System auth / fail2ban
sudo journalctl -u fail2ban -f
sudo fail2ban-client status sshd
```

---

## Health check

```bash
curl https://velocit.ee/health
# {"status":"ok","uptime":3600,"signups":42}
```

---

## Rebuilding from scratch

If the VM is destroyed and you need to start over:

1. Provision a new Ubuntu 24.04 VM (same specs as above)
2. Ensure you have `RESEND_API_KEY`, `RESEND_AUDIENCE_ID`, and the Cloudflare tunnel token
3. Run `setup.sh` with your env vars set
4. Restore `.env` from your secure backup (1Password, Bitwarden, etc.)
5. Re-apply the schema: `sudo -u velocitee psql -d velocitee -f /home/velocitee/velocitee/db/schema.sql`
6. Restart: `sudo -u velocitee pm2 restart velocitee && pm2 save`
7. Verify: `curl https://velocit.ee/health`

The Cloudflare Tunnel, DNS records, and Resend domain verification survive VM rebuilds — they are tied to your Cloudflare/Resend accounts, not the VM.

---

## Security notes

- App binds to `127.0.0.1` only — not reachable directly from the network
- UFW blocks all inbound except SSH from management VLAN (`172.16.67.0/28`)
- IP addresses are hashed (HMAC-SHA256 + secret salt) before storage — raw IPs never touch the DB
- Admin password uses bcrypt (cost factor 12) — brute-force resistant
- Cloudflare Tunnel provides TLS termination — no certificates to manage on the VM
- Rate limiting: 3 requests per IP per 15 minutes on `/api/waitlist`
- Helmet.js sets security headers on all responses
- fail2ban bans repeated SSH failures
- Unattended-upgrades installs security patches automatically
