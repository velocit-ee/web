'use strict';

const express = require('express');
const router  = express.Router();

const { contactLimiter } = require('../middleware/rateLimit');
const { validateContact } = require('../middleware/validate');
const { getResend } = require('../lib/resend');

// POST /api/contact — receives a contact form submission, emails it to
// inquiries@velocit.ee. We do not persist contact messages to the DB; they
// land in mail and stay there. Adjust if/when a CRM is wired in.
router.post('/', contactLimiter, validateContact, async (req, res) => {
  const { name, email, organization, message } = req.body;

  const ts = new Date().toUTCString();

  const resend = getResend();
  if (!resend) {
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
        // No client IP: the privacy notice promises raw IPs never leave the
        // edge. Rate-limiting already keys on the hashed IP upstream.
        `From    : ${name} <${email}>`,
        organization ? `Org     : ${organization}` : null,
        `Time    : ${ts}`,
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
