# velocit-ee/web

the velocit.ee landing page and waitlist backend.

```
status: live at velocit.ee
license: mit
```

---

## what it is

a lightweight node.js + express backend that powers:
- waitlist signup with email deduplication and rate limiting
- resend email integration (waitlist notifications + audience sync)
- admin dashboard at `/admin` with bcrypt-protected HTTP basic auth
- health endpoint at `/health`
- the landing page static files

---

## stack

- node.js 22 LTS + express 4.x
- postgresql 16 (unix socket, no tcp, no password)
- pm2 + systemd (production process management)
- cloudflare tunnel (public access, no open ports)
- helmet, express-rate-limit, bcryptjs, validator, resend sdk

---

## running locally

```bash
git clone https://github.com/velocit-ee/web.git
cd web
npm install
cp .env.example .env
# edit .env — you need a resend api key and postgres running
node server.js
```

see `.env.example` for all required environment variables.

---

## deployment

the production instance runs on a dedicated VM (proxmox, ubuntu 24.04 LTS). see `setup.sh` for the full provisioning script — it's idempotent and can be re-run safely.

```bash
# on the VM as root
CLOUDFLARE_TUNNEL_TOKEN=<token> bash setup.sh
```

---

## security notes

- rate limited: 3 requests per IP per 15 minutes on the waitlist endpoint
- no raw IPs stored — HMAC-SHA256 hash with a secret salt
- admin password is bcrypt (cost 12) — never stored in plaintext
- UFW blocks all inbound except SSH from the management VLAN
- cloudflare tunnel: no ports open to the internet

---

## license

mit — see [LICENSE](LICENSE).
