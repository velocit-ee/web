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

## changelog

### 2026-04-04 — pipeline section + three.js animation

added a new interactive **deployment pipeline** section to `public/index.html`:

- new `#pipeline` section between the "problem" and "how it works" sections
- 5-step walkthrough of the deployment process: bare metal → pxe boot → os provision → terraform/ansible → live stack
- each step has a title, CLI command, description, and key/value metadata
- left panel: tabbed navigation with prev/next buttons and a progress bar; also responds to arrow keys when in view
- right panel: interactive three.js 3D scene — a different 3D visualization per step, drag to rotate
- step scenes: cold server (unlit), pxe network discovery (animated packet dots), os layer stack, floating iac modules (animated), multi-server cluster
- `three.js r128` loaded from cdnjs
- added `pipeline` link to the top nav

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
