'use strict';

const express = require('express');
const router  = express.Router();

const { pool }     = require('../db');
const { basicAuth } = require('../middleware/auth');

// ── All /admin routes require HTTP Basic Auth ─────────────────────────────────
router.use(basicAuth);

// GET /admin — dashboard
router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT email, created_at FROM waitlist ORDER BY created_at DESC'
    );
    const total = rows.length;

    const tableRows = rows.length > 0
      ? rows.map(r => `
        <tr>
          <td>${escapeHtml(r.email)}</td>
          <td>${new Date(r.created_at).toISOString().replace('T', ' ').slice(0, 19)} UTC</td>
        </tr>`).join('')
      : `<tr><td colspan="2" style="color:#4a5a48;padding:1.2rem 0">
           no signups yet
         </td></tr>`;

    res.send(renderPage({ total, tableRows }));
  } catch (err) {
    console.error('[admin]', err.message);
    res.status(500).send('database error');
  }
});

// GET /admin/export.csv — full waitlist as CSV download
router.get('/export.csv', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT email, created_at, source FROM waitlist ORDER BY created_at ASC'
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="velocitee-waitlist.csv"');
    res.write('email,created_at,source\n');
    for (const r of rows) {
      res.write(
        `${csvEscape(r.email)},${r.created_at.toISOString()},${csvEscape(r.source)}\n`
      );
    }
    res.end();
  } catch (err) {
    console.error('[admin:export]', err.message);
    res.status(500).send('export failed');
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function csvEscape(val) {
  const s = String(val);
  if (/[,"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ── Server-rendered admin page ────────────────────────────────────────────────
function renderPage({ total, tableRows }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>velocit.ee — admin</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background:  #0b0e09;
    color:       #d4ccb4;
    font-family: 'IBM Plex Mono', monospace;
    font-size:   14px;
    line-height: 1.6;
    padding:     2.5rem;
    min-height:  100vh;
  }
  h1 {
    color:       #5a9e6a;
    font-size:   1.3rem;
    font-weight: 600;
    margin-bottom: 0.2rem;
  }
  .subtitle {
    color:         #4a5a48;
    font-size:     0.8rem;
    margin-bottom: 2.5rem;
  }
  .stat {
    display:       inline-block;
    background:    #111a0f;
    border:        1px solid #243020;
    border-radius: 6px;
    padding:       1rem 2.5rem;
    margin-bottom: 2rem;
  }
  .stat-number {
    font-size:   2.8rem;
    color:       #5a9e6a;
    font-weight: 600;
    line-height: 1;
  }
  .stat-label {
    font-size: 0.78rem;
    color:     #4a5a48;
    margin-top: 0.3rem;
  }
  .actions { margin-bottom: 1.8rem; }
  .btn {
    display:     inline-block;
    background:  #5a9e6a;
    color:       #0b0e09;
    padding:     0.45rem 1.2rem;
    border-radius: 4px;
    text-decoration: none;
    font-family: 'IBM Plex Mono', monospace;
    font-size:   0.82rem;
    font-weight: 600;
  }
  .btn:hover { background: #6ab87a; }
  table {
    width:           100%;
    border-collapse: collapse;
    max-width:       860px;
  }
  th {
    text-align:   left;
    color:        #5a9e6a;
    border-bottom: 1px solid #243020;
    padding:      0.5rem 1rem 0.5rem 0;
    font-weight:  600;
    font-size:    0.82rem;
  }
  td {
    padding:      0.45rem 1rem 0.45rem 0;
    border-bottom: 1px solid #161e14;
    color:        #d4ccb4;
    font-size:    0.85rem;
  }
  tr:hover td { background: #0e1a0c; }
</style>
</head>
<body>

<h1>velocit.ee</h1>
<div class="subtitle">admin / waitlist</div>

<div class="stat">
  <div class="stat-number">${total}</div>
  <div class="stat-label">total signups</div>
</div>

<div class="actions">
  <a class="btn" href="/admin/export.csv">export csv</a>
</div>

<table>
  <thead>
    <tr>
      <th>email</th>
      <th>signed up (UTC)</th>
    </tr>
  </thead>
  <tbody>
    ${tableRows}
  </tbody>
</table>

</body>
</html>`;
}

module.exports = router;
