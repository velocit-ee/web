// velocit.ee — Cloudflare Worker
//
// Serves the Astro static build via the assets binding and implements the
// dynamic API surface that Express used to provide on the VM:
//
//   POST /api/waitlist       signup (D1, rate-limited, optional Turnstile)
//   POST /api/contact        contact form → Resend (rate-limited, optional Turnstile)
//   GET  /health             probe (uptime is meaningless on Workers; reports D1)
//   GET  /admin              dashboard (Basic auth: ADMIN_USER / ADMIN_TOKEN)
//   GET  /admin/export.csv   waitlist CSV export
//
// Deliberately dependency-free: the whole runtime is this file + admin-page.js.
// Parity notes vs the Express implementation are inline where behavior differs.

import { renderAdminPage } from "./admin-page.js";

// ── Rate limits (identical windows to the Express deployment) ────────────────
const LIMITS = {
  waitlist: { max: 3, windowSeconds: 15 * 60 },
  contact:  { max: 2, windowSeconds: 60 * 60 },
};

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

    try {
      if (pathname === "/api/waitlist" && request.method === "POST") {
        return await handleWaitlist(request, env, ctx);
      }
      if (pathname === "/api/contact" && request.method === "POST") {
        return await handleContact(request, env, ctx);
      }
      if (pathname === "/health") {
        return await handleHealth(env);
      }
      if (pathname === "/admin" || pathname === "/admin/") {
        return await withAdminAuth(request, env, handleAdmin);
      }
      if (pathname === "/admin/export.csv") {
        return await withAdminAuth(request, env, handleAdminExport);
      }
      if (pathname.startsWith("/api/")) {
        return json({ error: "not found" }, 404);
      }
      // Everything else: the Astro static build (assets binding handles 404s
      // via not_found_handling = "404-page").
      return env.ASSETS.fetch(request);
    } catch (err) {
      console.error("[error]", pathname, err.message);
      return json({ error: "internal server error" }, 500);
    }
  },
};

// ── Waitlist ─────────────────────────────────────────────────────────────────

async function handleWaitlist(request, env, ctx) {
  const body = await readJson(request);
  const email = validateEmail(body?.email);
  if (!email.ok) return json({ success: false, message: email.message }, 400);

  const ipHash = await hashIP(clientIP(request), env);

  const limited = await rateLimited(env, "waitlist", ipHash, LIMITS.waitlist);
  if (limited) {
    return json({ success: false, message: "too many requests. try again in 15 minutes." }, 429);
  }

  const turnstile = await verifyTurnstile(request, env, body);
  if (!turnstile.ok) return json({ success: false, message: turnstile.message }, 403);

  const source = (request.headers.get("origin") || request.headers.get("referer") || "website").slice(0, 255);

  // Same atomic dedupe as the Express version: inserted row → id, dup → no row.
  const inserted = await env.DB.prepare(
    `INSERT INTO waitlist (email, ip_hash, source) VALUES (?1, ?2, ?3)
     ON CONFLICT (email) DO NOTHING
     RETURNING id`
  ).bind(email.value, ipHash, source).first();

  if (!inserted) {
    return json({ success: true, message: "you're already on the list." });
  }

  const { n: total } = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM waitlist"
  ).first();

  // Side effects never block the response.
  ctx.waitUntil(addToAudience(env, email.value).catch((e) => console.error("[resend:audience]", e.message)));
  ctx.waitUntil(sendSignupNotification(env, email.value, total).catch((e) => console.error("[resend:notify]", e.message)));

  return json({ success: true, message: "you're on the list." });
}

// ── Contact ──────────────────────────────────────────────────────────────────

async function handleContact(request, env, ctx) {
  const body = await readJson(request);
  const v = validateContact(body);
  if (!v.ok) {
    // Honeypot filled → pretend success, drop silently (same as Express).
    if (v.honeypot) return json({ success: true, message: "thanks — we'll be in touch." });
    return json({ success: false, message: v.message }, 400);
  }

  const ipHash = await hashIP(clientIP(request), env);
  const limited = await rateLimited(env, "contact", ipHash, LIMITS.contact);
  if (limited) {
    return json({
      success: false,
      message: "too many contact form submissions. try again in an hour, or email inquiries@velocit.ee directly.",
    }, 429);
  }

  const turnstile = await verifyTurnstile(request, env, body);
  if (!turnstile.ok) return json({ success: false, message: turnstile.message }, 403);

  if (!env.RESEND_API_KEY) {
    console.error("[contact] RESEND_API_KEY missing — refusing to silently drop submission");
    return json({
      success: false,
      message: "contact form temporarily unavailable. email inquiries@velocit.ee directly.",
    }, 503);
  }

  const { name, email, organization, message } = v.value;
  const ts = new Date().toUTCString();
  // No client IP in the mail — the privacy notice promises raw IPs never
  // leave the edge.
  const text = [
    `From    : ${name} <${email}>`,
    organization ? `Org     : ${organization}` : null,
    `Time    : ${ts}`,
    "─".repeat(50),
    "",
    message,
    "",
    "─".repeat(50),
    "Sent via velocit.ee contact form.",
  ].filter(Boolean).join("\n");

  const sent = await resendSend(env, {
    from: "inquiries@velocit.ee",
    to: ["inquiries@velocit.ee"],
    reply_to: email,
    subject: `velocit.ee contact — ${name}${organization ? ` (${organization})` : ""}`,
    text,
  });
  if (!sent.ok) {
    console.error("[contact]", sent.error);
    return json({ success: false, message: "something went wrong. email inquiries@velocit.ee directly." }, 500);
  }

  return json({ success: true, message: "thanks — we'll be in touch." });
}

// ── Health ───────────────────────────────────────────────────────────────────

async function handleHealth(env) {
  try {
    const { n } = await env.DB.prepare("SELECT COUNT(*) AS n FROM waitlist").first();
    return json({ status: "ok", signups: n });
  } catch {
    return json({ status: "degraded", signups: null }, 503);
  }
}

// ── Admin ────────────────────────────────────────────────────────────────────

async function withAdminAuth(request, env, handler) {
  if (!env.ADMIN_USER || !env.ADMIN_TOKEN) {
    console.error("[auth] ADMIN_USER or ADMIN_TOKEN secret not configured");
    return new Response("auth not configured", { status: 500 });
  }
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Basic ")) return challenge();

  let user = "", pass = "";
  try {
    const decoded = atob(header.slice(6));
    const colon = decoded.indexOf(":");
    if (colon === -1) return challenge();
    user = decoded.slice(0, colon);
    pass = decoded.slice(colon + 1);
  } catch {
    return challenge();
  }

  const okUser = await timingSafeEqual(user, env.ADMIN_USER);
  const okPass = await timingSafeEqual(pass, env.ADMIN_TOKEN);
  if (!(okUser && okPass)) return challenge();

  return handler(env);
}

function challenge() {
  return new Response("Unauthorized", {
    status: 401,
    headers: { "www-authenticate": 'Basic realm="velocit.ee admin", charset="UTF-8"' },
  });
}

async function handleAdmin(env) {
  const { results } = await env.DB.prepare(
    "SELECT email, created_at FROM waitlist ORDER BY created_at DESC"
  ).all();
  return new Response(renderAdminPage(results), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

async function handleAdminExport(env) {
  const { results } = await env.DB.prepare(
    "SELECT email, created_at, source FROM waitlist ORDER BY created_at ASC"
  ).all();
  const lines = ["email,created_at,source"];
  for (const r of results) {
    lines.push([csvEscape(r.email), r.created_at, csvEscape(r.source)].join(","));
  }
  return new Response(lines.join("\n") + "\n", {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="velocitee-waitlist.csv"',
    },
  });
}

function csvEscape(val) {
  const s = String(val ?? "");
  return /[,"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// ── Rate limiting (D1-backed sliding window) ─────────────────────────────────
// The Workers rate-limit binding only supports 10s/60s windows; ours are
// 15min/1h, so we count events in D1. Volume is tiny (per-IP form posts) and
// this survives deploys, unlike the old in-memory express-rate-limit store.

async function rateLimited(env, scope, ipHash, { max, windowSeconds }) {
  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - windowSeconds;
  const { n } = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM rate_events WHERE scope = ?1 AND ip_hash = ?2 AND ts > ?3"
  ).bind(scope, ipHash, cutoff).first();
  if (n >= max) return true;
  await env.DB.batch([
    env.DB.prepare("INSERT INTO rate_events (scope, ip_hash, ts) VALUES (?1, ?2, ?3)").bind(scope, ipHash, now),
    // Opportunistic pruning keeps the table at O(recent traffic).
    env.DB.prepare("DELETE FROM rate_events WHERE ts < ?1").bind(now - 24 * 3600),
  ]);
  return false;
}

// ── Turnstile (optional — active once TURNSTILE_SECRET_KEY is set) ───────────

async function verifyTurnstile(request, env, body) {
  if (!env.TURNSTILE_SECRET_KEY) return { ok: true };
  const token = body?.turnstileToken;
  if (!token) return { ok: false, message: "verification failed. reload and try again." };
  const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      secret: env.TURNSTILE_SECRET_KEY,
      response: token,
      remoteip: clientIP(request),
    }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!data.success) return { ok: false, message: "verification failed. reload and try again." };
  return { ok: true };
}

// ── Resend (plain REST — no SDK) ─────────────────────────────────────────────

async function resendSend(env, payload) {
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) return { ok: false, error: `resend ${resp.status}: ${(await resp.text()).slice(0, 200)}` };
  return { ok: true };
}

async function addToAudience(env, email) {
  if (!env.RESEND_API_KEY || !env.RESEND_AUDIENCE_ID) return;
  await fetch(`https://api.resend.com/audiences/${env.RESEND_AUDIENCE_ID}/contacts`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ email, unsubscribed: false }),
  });
}

async function sendSignupNotification(env, email, total) {
  if (!env.RESEND_API_KEY || !env.NOTIFY_PERSONAL_EMAIL) return;
  const ts = new Date().toUTCString();
  await resendSend(env, {
    from: "inquiries@velocit.ee",
    to: [env.NOTIFY_PERSONAL_EMAIL, "hello@velocit.ee"],
    subject: `New velocit.ee signup — #${total}`,
    text: [
      "New waitlist signup",
      "─".repeat(40),
      `Email    : ${email}`,
      `Time     : ${ts}`,
      `Total    : ${total} signup${total !== 1 ? "s" : ""}`,
      "─".repeat(40),
      "velocit.ee",
    ].join("\n"),
  });
}

// ── Validation (ported from middleware/validate.js) ──────────────────────────

const EMAIL_RE = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

function validateEmail(raw) {
  if (!raw || typeof raw !== "string") return { ok: false, message: "email is required." };
  const email = raw.trim().toLowerCase();
  if (email.length > 320) return { ok: false, message: "email address too long." };
  if (!EMAIL_RE.test(email)) return { ok: false, message: "enter a valid email address." };
  return { ok: true, value: email };
}

function validateContact(body) {
  const b = body || {};
  if ((b.website || "").toString().trim() !== "") return { ok: false, honeypot: true };

  const name = (b.name || "").toString().trim();
  const emailRaw = (b.email || "").toString().trim().toLowerCase();
  const organization = (b.organization || "").toString().trim();
  const message = (b.message || "").toString().trim();

  if (!name || name.length < 2 || name.length > 120) {
    return { ok: false, message: "name is required (2–120 chars)." };
  }
  if (!emailRaw || emailRaw.length > 320 || !EMAIL_RE.test(emailRaw)) {
    return { ok: false, message: "a valid email is required." };
  }
  if (organization.length > 200) {
    return { ok: false, message: "organisation name too long (max 200)." };
  }
  if (!message || message.length < 10 || message.length > 4000) {
    return { ok: false, message: "message is required (10–4000 chars)." };
  }
  return { ok: true, value: { name, email: emailRaw, organization, message } };
}

// ── Small utilities ──────────────────────────────────────────────────────────

function clientIP(request) {
  // Native on Workers — no proxy-trust configuration, no spoofable fallback.
  return request.headers.get("cf-connecting-ip") || "0.0.0.0";
}

async function hashIP(ip, env) {
  if (!env.IP_HASH_SALT) throw new Error("IP_HASH_SALT secret must be set");
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(env.IP_HASH_SALT),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(String(ip)));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function timingSafeEqual(a, b) {
  // Compare SHA-256 digests — equal-length buffers, content-independent time.
  const enc = new TextEncoder();
  const [da, db] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const va = new Uint8Array(da), vb = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i];
  return diff === 0;
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS });
}
