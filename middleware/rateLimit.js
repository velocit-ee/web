'use strict';

const rateLimit = require('express-rate-limit');

// 3 requests per IP per 15 minutes for the waitlist endpoint
const waitlistLimiter = rateLimit({
  windowMs:       15 * 60 * 1000,
  max:            3,
  standardHeaders: true,   // Return RateLimit-* headers (RFC 6585)
  legacyHeaders:  false,   // Disable X-RateLimit-* headers

  // Prefer the real client IP from Cloudflare over Express's req.ip,
  // which in a tunnelled setup resolves to 127.0.0.1 without proper handling.
  keyGenerator: (req) =>
    req.headers['cf-connecting-ip'] || req.ip,

  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      message: 'too many requests. try again in 15 minutes.',
    });
  },
});

// Stricter limit for the contact form — 2 sends per IP per hour. Contact
// hits a different code path (Resend + DB insert) and we don't want abuse
// converting into outbound mail volume.
const contactLimiter = rateLimit({
  windowMs:        60 * 60 * 1000,
  max:             2,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator: (req) =>
    req.headers['cf-connecting-ip'] || req.ip,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      message: 'too many contact form submissions. try again in an hour, or email inquiries@velocit.ee directly.',
    });
  },
});

module.exports = { waitlistLimiter, contactLimiter };
