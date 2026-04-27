'use strict';

require('dotenv').config();

const express = require('express');
const helmet  = require('helmet');
const path    = require('path');
const fs      = require('fs');

const waitlistRouter = require('./routes/waitlist');
const contactRouter  = require('./routes/contact');
const adminRouter    = require('./routes/admin');
const healthRouter   = require('./routes/health');

const app = express();

// ── Proxy trust ─────────────────────────────────────────────────────────────
// Cloudflare Tunnel terminates locally; real client IPs arrive via
// CF-Connecting-IP header. Trust the immediate upstream proxy (127.0.0.1).
app.set('trust proxy', 1);

// ── Security headers (Helmet) ────────────────────────────────────────────────
// Astro builds inline tiny bootstrap scripts per page (waitlist + contact
// forms) and self-hosts fonts. Drop the old fonts.googleapis.com / cdnjs
// allowances since the rebuild doesn't load anything off-origin.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'"],
      styleSrc:    ["'self'", "'unsafe-inline'"],
      fontSrc:     ["'self'", 'data:'],
      imgSrc:      ["'self'", 'data:'],
      connectSrc:  ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
}));

// ── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// ── Static files ─────────────────────────────────────────────────────────────
// Astro's static build lives at ./site/dist after `npm run build`.
// If the build hasn't run, fall back to ./public so the server still serves
// the legacy index.html locally instead of throwing 404s on every request.
const SITE_DIST = path.join(__dirname, 'site', 'dist');
const PUBLIC_DIR = path.join(__dirname, 'public');
const STATIC_ROOT = fs.existsSync(SITE_DIST) ? SITE_DIST : PUBLIC_DIR;
const SERVING_BUILT_SITE = STATIC_ROOT === SITE_DIST;

app.use(express.static(STATIC_ROOT, {
  // Astro's hashed asset bundles get long cache; everything else short.
  setHeaders: (res, filePath) => {
    if (filePath.includes(`${path.sep}_assets${path.sep}`)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=300');
    }
  },
}));

// ── API routes ───────────────────────────────────────────────────────────────
app.use('/api/waitlist', waitlistRouter);
app.use('/api/contact',  contactRouter);
app.use('/admin',        adminRouter);
app.use('/health',       healthRouter);

// ── 404 ──────────────────────────────────────────────────────────────────────
// For HTML navigations, serve Astro's pre-built 404.html when available.
// For everything else (XHR/fetch, asset requests), respond JSON so callers
// don't choke on a body they didn't expect.
app.use((req, res) => {
  const wants404Html =
    SERVING_BUILT_SITE &&
    req.method === 'GET' &&
    (req.headers.accept || '').includes('text/html');
  const notFoundHtml = path.join(SITE_DIST, '404.html');
  if (wants404Html && fs.existsSync(notFoundHtml)) {
    res.status(404).sendFile(notFoundHtml);
    return;
  }
  res.status(404).json({ error: 'not found' });
});

// ── Error handler ────────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[error]', err.message);
  res.status(500).json({ error: 'internal server error' });
});

// ── Start ────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '127.0.0.1'; // never 0.0.0.0 — Cloudflare Tunnel only

app.listen(PORT, HOST, () => {
  console.log(`[velocit.ee] listening on http://${HOST}:${PORT}`);
  console.log(`[velocit.ee] static root: ${SERVING_BUILT_SITE ? 'site/dist (built)' : 'public/ (fallback — run npm run build)'}`);
});

module.exports = app;
