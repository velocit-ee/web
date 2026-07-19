// Admin dashboard HTML — ported unchanged from routes/admin.js (Express),
// minus the DB access which now happens in the Worker handler.

export function renderAdminPage(rows) {
  const total = rows.length;
  const tableRows = total > 0
    ? rows.map((r) => `
        <tr>
          <td>${escapeHtml(r.email)}</td>
          <td>${String(r.created_at).replace("T", " ").slice(0, 19)} UTC</td>
        </tr>`).join("")
    : `<tr><td colspan="2" style="color:#4a5a48;padding:1.2rem 0">
         no signups yet
       </td></tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>velocit.ee — admin</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background:  #0b0e09;
    color:       #d4ccb4;
    font-family: ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace;
    font-size:   14px;
    line-height: 1.6;
    padding:     2.5rem;
    min-height:  100vh;
  }
  h1 { color: #5a9e6a; font-size: 1.3rem; font-weight: 600; margin-bottom: 0.2rem; }
  .subtitle { color: #4a5a48; font-size: 0.8rem; margin-bottom: 2.5rem; }
  .stat {
    display: inline-block; background: #111a0f; border: 1px solid #243020;
    border-radius: 6px; padding: 1rem 2.5rem; margin-bottom: 2rem;
  }
  .stat-number { font-size: 2.8rem; color: #5a9e6a; font-weight: 600; line-height: 1; }
  .stat-label  { font-size: 0.78rem; color: #4a5a48; margin-top: 0.3rem; }
  .actions { margin-bottom: 1.8rem; }
  .btn {
    display: inline-block; background: #5a9e6a; color: #0b0e09;
    padding: 0.45rem 1.2rem; border-radius: 4px; text-decoration: none;
    font-size: 0.82rem; font-weight: 600;
  }
  .btn:hover { background: #6ab87a; }
  table { width: 100%; border-collapse: collapse; max-width: 860px; }
  th {
    text-align: left; color: #5a9e6a; border-bottom: 1px solid #243020;
    padding: 0.5rem 1rem 0.5rem 0; font-weight: 600; font-size: 0.82rem;
  }
  td {
    padding: 0.45rem 1rem 0.45rem 0; border-bottom: 1px solid #161e14;
    color: #d4ccb4; font-size: 0.85rem;
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

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
