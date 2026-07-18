'use strict';

const express = require('express');
const router  = express.Router();

const { pool, hashIP }      = require('../db');
const { waitlistLimiter }   = require('../middleware/rateLimit');
const { validateEmail }     = require('../middleware/validate');
const { getResend }         = require('../lib/resend');

// POST /api/waitlist
router.post('/', waitlistLimiter, validateEmail, async (req, res) => {
  const { email } = req.body; // already trimmed + lowercased by validateEmail

  // Real client IP: Cloudflare sets CF-Connecting-IP on every tunnelled request
  const rawIP  = req.headers['cf-connecting-ip'] || req.ip || '0.0.0.0';
  const ipHash = hashIP(rawIP);
  const source = (req.get('origin') || req.get('referer') || 'website').slice(0, 255);

  try {
    // ── Insert, atomically deduplicating on email ────────────────────────────
    // ON CONFLICT DO NOTHING closes the check-then-insert race: two concurrent
    // signups for the same address can't turn the loser into a 500. An inserted
    // row returns its id; a duplicate returns no rows.
    const { rows: inserted } = await pool.query(
      `INSERT INTO waitlist (email, ip_hash, source)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      [email, ipHash, source]
    );

    if (inserted.length === 0) {
      return res.json({ success: true, message: "you're already on the list." });
    }

    // ── Running total ────────────────────────────────────────────────────────
    const { rows: [{ n: total }] } = await pool.query(
      'SELECT COUNT(*)::int AS n FROM waitlist'
    );

    // ── Side effects (fire-and-forget — never block the response) ────────────
    addToAudience(email).catch(err =>
      console.error('[resend:audience]', err.message)
    );
    sendNotification(email, total).catch(err =>
      console.error('[resend:notify]', err.message)
    );

    return res.json({ success: true, message: "you're on the list." });

  } catch (err) {
    console.error('[waitlist]', err.message);
    return res.status(500).json({
      success: false,
      message: 'something went wrong. try again.',
    });
  }
});

// ── Resend: add contact to audience ──────────────────────────────────────────
async function addToAudience(email) {
  const resend = getResend();
  if (!resend || !process.env.RESEND_AUDIENCE_ID) return;
  await resend.contacts.create({
    audienceId:   process.env.RESEND_AUDIENCE_ID,
    email,
    unsubscribed: false,
  });
}

// ── Resend: notify on new signup ──────────────────────────────────────────────
async function sendNotification(email, total) {
  const resend = getResend();
  if (!resend || !process.env.NOTIFY_PERSONAL_EMAIL) return;
  const ts = new Date().toUTCString();
  await resend.emails.send({
    from:    'inquiries@velocit.ee',
    to:      [process.env.NOTIFY_PERSONAL_EMAIL, 'hello@velocit.ee'],
    subject: `New velocit.ee signup — #${total}`,
    text: [
      'New waitlist signup',
      '─'.repeat(40),
      `Email    : ${email}`,
      `Time     : ${ts}`,
      `Total    : ${total} signup${total !== 1 ? 's' : ''}`,
      '─'.repeat(40),
      'velocit.ee',
    ].join('\n'),
  });
}

module.exports = router;
