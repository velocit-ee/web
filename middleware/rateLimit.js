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

module.exports = { waitlistLimiter };
