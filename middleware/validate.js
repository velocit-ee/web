'use strict';

const validator = require('validator');

/**
 * Validates and normalises the email field from req.body.
 * On success, req.body.email is replaced with the trimmed, lowercased value.
 */
function validateEmail(req, res, next) {
  const raw = req.body && req.body.email;

  if (!raw || typeof raw !== 'string') {
    return res.status(400).json({ success: false, message: 'email is required.' });
  }

  const email = raw.trim().toLowerCase();

  if (email.length > 320) {
    return res.status(400).json({ success: false, message: 'email address too long.' });
  }

  if (!validator.isEmail(email, { allow_utf8_local_part: false })) {
    return res.status(400).json({ success: false, message: 'enter a valid email address.' });
  }

  req.body.email = email;
  next();
}

module.exports = { validateEmail };
