'use strict';

const express = require('express');
const router  = express.Router();

const { contactLimiter } = require('../middleware/rateLimit');
const { validateContact } = require('../middleware/validate');
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

// POST /api/contact — receives a contact form submission, emails it to
// inquiries@velocit.ee. We do not persist contact messages to the DB; they
// land in mail and stay there. Adjust if/when a CRM is wired in.
router.post('/', contactLimiter, validateContact, async (req, res) => {
  const { name, email, organization, message } = req.body;

  // Cloudflare gives us the real client IP via this header.
  const ip = req.headers['cf-connecting-ip'] || req.ip || 'unknown';
  const ts = new Date().toUTCString();

  if (!process.env.RESEND_API_KEY) {
    console.error('[contact] RESEND_API_KEY missing — refusing to silently drop submission');
    return res.status(503).json({
      success: false,
      message: 'contact form temporarily unavailable. email inquiries@velocit.ee directly.',
    });
  }

  try {
    await resend.emails.send({
      from:    'inquiries@velocit.ee',
      to:      ['inquiries@velocit.ee'],
      reply_to: email,
      subject: `velocit.ee contact — ${name}${organization ? ` (${organization})` : ''}`,
      text: [
        `From    : ${name} <${email}>`,
        organization ? `Org     : ${organization}` : null,
        `Time    : ${ts}`,
        `Client  : ${ip}`,
        '─'.repeat(50),
        '',
        message,
        '',
        '─'.repeat(50),
        'Sent via velocit.ee contact form.',
      ].filter(Boolean).join('\n'),
    });

    return res.json({
      success: true,
      message: "thanks — we'll be in touch.",
    });
  } catch (err) {
    console.error('[contact]', err.message);
    return res.status(500).json({
      success: false,
      message: 'something went wrong. email inquiries@velocit.ee directly.',
    });
  }
});

module.exports = router;
