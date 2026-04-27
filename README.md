# velocit-ee/web

The velocit.ee marketing site and waitlist backend.

```
status:   live at velocit.ee
frontend: Astro 4 + Tailwind (./site)
backend:  Express on Node 22 (./)
license:  MIT (site config); content under AGPL v3
```

---

## What it is

A two-layer monorepo:

```
web/
  site/              ← Astro project (multi-page site, builds to site/dist)
  routes/            ← Express API routes
  middleware/        ← validation, rate-limit, auth
  server.js          ← serves site/dist statically + handles /api/*
  setup.sh           ← idempotent VM provisioning script
  ecosystem.config.js← PM2 config
```

**Why both?** Astro is a static-site generator — fast, distinctive, multi-page.
Express handles the dynamic bits the static site can't: the waitlist endpoint,
the contact form, the admin dashboard, the health probe.

Express in production serves the Astro build under `/` and the API under
`/api/*`. There is no SPA hydration — every page is a real HTML file.

---

## Pages (in `site/src/pages/`)

| Route                | Purpose                                          |
|----------------------|--------------------------------------------------|
| `/`                  | Landing — hero, problem, how-it-works, principles, CTA |
| `/engines`           | Pipeline overview — all four engines              |
| `/engines/vme`       | VME — metal · live                                |
| `/engines/vne`       | VNE — network · live (initial)                    |
| `/engines/vse`       | VSE — services · planned, with waitlist           |
| `/engines/vle`       | VLE — lifecycle · planned                         |
| `/pricing`           | Tier comparison + FAQ                             |
| `/about`             | Mission, team, principles, roadmap                |
| `/blog`              | Blog index (content collection in `site/src/content/blog/`) |
| `/blog/<slug>`       | Individual posts (Markdown / MDX)                 |
| `/contact`           | Contact form (POSTs `/api/contact`)               |
| `/legal/privacy`     | Privacy notice                                    |
| `/legal/terms`       | Terms of use                                      |
| `/404`               | Custom 404                                        |

The Astro project pulls brand tokens (palette, fonts, voice) from
`velocit-ee/.github/profile/BRAND.md` — keep them in sync.

---

## API surface

| Endpoint        | Method | Purpose |
|-----------------|--------|---------|
| `/api/waitlist` | POST   | Waitlist signup; rate-limited 3/15min/IP |
| `/api/contact`  | POST   | Contact form to inquiries@velocit.ee; rate-limited 2/hr/IP |
| `/admin`        | GET    | Admin dashboard (HTTP basic auth, bcrypt-hashed) |
| `/health`       | GET    | Health probe |

---

## Local development

```bash
# 1. Express deps
npm install

# 2. Astro deps + build
npm run build           # site/dist is what Express serves

# 3. Run the server
cp .env.example .env    # fill in resend key, db connection, admin pw hash
node server.js          # http://127.0.0.1:3000
```

For Astro-only iteration (no API):

```bash
npm run site:dev        # http://127.0.0.1:4321 — live reload
```

---

## Deployment

Production runs on a dedicated Proxmox VM (Ubuntu 24.04, PM2 + systemd,
Cloudflare Tunnel). Provisioning is fully scripted:

```bash
# on the VM, as root
CLOUDFLARE_TUNNEL_TOKEN=<token> bash setup.sh
```

`setup.sh` is idempotent — safe to re-run after a code change. It:

1. Installs Node 22, PostgreSQL 16, NGINX, fail2ban, UFW, cloudflared.
2. Creates the runtime user and clones the repo.
3. Runs `npm ci --omit=dev` for the Express runtime.
4. Runs `cd site && npm install && npm run build` to generate `site/dist`.
5. Applies the database schema.
6. Configures UFW (deny-all-inbound except SSH from the management VLAN).
7. Starts PM2 and registers it with systemd.
8. Boots the Cloudflare Tunnel.

---

## Security

- `helmet` with a tight CSP — no third-party origins, self-hosted fonts.
- Rate limits — 3/15min on `/api/waitlist`, 2/hr on `/api/contact`.
- IPs are HMAC-SHA-256-hashed before storage; raw IPs never hit disk.
- Admin password is bcrypt cost 12.
- `app.set('trust proxy', 1)` so we read the real client IP from the
  Cloudflare `CF-Connecting-IP` header instead of `127.0.0.1`.
- UFW blocks all inbound except SSH from the management VLAN.
- Cloudflare Tunnel terminates publicly; no ports are open on the VM.

See [BRAND.md](https://github.com/velocit-ee/.github/blob/main/profile/BRAND.md)
for design and tone standards.
