# velocit-ee/web

The velocit.ee marketing site and waitlist backend.

```
status:    live at velocit.ee (VM + tunnel) · staging on Cloudflare Workers
frontend:  Astro 7 + Tailwind 3 (./site)
backend:   Cloudflare Worker + D1 (./worker) — replaces Express at cutover
local dev: Express on Node 22 (./server.js) still works for offline hacking
license:   MIT
staging:   https://velocitee-web.finley-karras.workers.dev
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

## Deployment — Cloudflare Workers (target platform)

The site is a single Worker: the Astro build is served from the static
assets binding at the edge; `/api/*`, `/health`, and `/admin` run the
handler in `worker/index.js`. The waitlist lives in D1 (region EEUR).
Rate limiting is D1-backed (same windows as the old Express middleware);
Turnstile verification activates when `TURNSTILE_SECRET_KEY` is set.

```bash
npm run build                                                  # Astro → site/dist
npx wrangler d1 execute velocitee --remote --file worker/schema.sql   # once / idempotent
npx wrangler deploy                                            # → workers.dev (staging)
```

Secrets (set once per environment via `npx wrangler secret put <NAME>`):
`IP_HASH_SALT`, `ADMIN_USER`, `ADMIN_TOKEN`, `RESEND_API_KEY`,
`RESEND_AUDIENCE_ID`, `NOTIFY_PERSONAL_EMAIL`, `TURNSTILE_SECRET_KEY`.

Admin auth is HTTP Basic against `ADMIN_USER`/`ADMIN_TOKEN` (a long random
token, compared constant-time). At production cutover, put Cloudflare
Access in front of `/admin` as the primary gate.

**Production cutover checklist** (not yet executed):
1. Final `pg_dump` of the VM's waitlist → CSV → import into D1.
2. Set production secrets (real Resend key, prod `IP_HASH_SALT`).
3. Enable Zero Trust and add an Access policy for `/admin`.
4. Create a Turnstile widget for velocit.ee; set the secret; wire the
   widget into the two forms.
5. Attach the `velocit.ee` custom domain to the Worker; remove the tunnel
   ingress. Watch for a day.
6. Decommission: revoke tunnel token, archive an encrypted final DB dump,
   retire the VM. Update the privacy notice (hosting = Cloudflare).

## Deployment — legacy VM (current production until cutover)

Production still runs on a dedicated Proxmox VM (Ubuntu 24.04, PM2 +
systemd, Cloudflare Tunnel) provisioned by `setup.sh`:

```bash
# on the VM, as root
CLOUDFLARE_TUNNEL_TOKEN=<token> bash setup.sh
```

`setup.sh` is idempotent — safe to re-run after a code change. It installs
Node 22 + PostgreSQL 16 + PM2 + cloudflared, builds the site, applies the
schema, configures UFW/fail2ban, and boots the tunnel. This path is
retired at cutover step 6.

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
