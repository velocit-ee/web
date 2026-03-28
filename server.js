'use strict';

require('dotenv').config();

const express = require('express');
const helmet  = require('helmet');
const path    = require('path');

const waitlistRouter = require('./routes/waitlist');
const adminRouter    = require('./routes/admin');
const healthRouter   = require('./routes/health');

const app = express();

// ── Proxy trust ─────────────────────────────────────────────────────────────
// Cloudflare Tunnel terminates locally; real client IPs arrive via
// CF-Connecting-IP header. Trust the immediate upstream proxy (127.0.0.1).
app.set('trust proxy', 1);

// ── Security headers (Helmet) ────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'"],
      styleSrc:    ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc:     ["'self'", 'https://fonts.gstatic.com'],
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
app.use(express.static(path.join(__dirname, 'public')));

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/waitlist', waitlistRouter);
app.use('/admin',        adminRouter);
app.use('/health',       healthRouter);

// ── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
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
});

module.exports = app;
