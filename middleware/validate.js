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

/**
 * Validate the contact form payload: email + name + message + (optional)
 * organisation. Trims and length-caps every field; rejects obvious garbage.
 *
 * On success, req.body fields are normalised in place.
 */
function validateContact(req, res, next) {
  const body = req.body || {};
  const name = (body.name || '').toString().trim();
  const email = (body.email || '').toString().trim().toLowerCase();
  const organization = (body.organization || '').toString().trim();
  const message = (body.message || '').toString().trim();

  // Honeypot — silently accept and drop. Bots fill hidden fields.
  if ((body.website || '').toString().trim() !== '') {
    return res.json({ success: true, message: 'thanks — we\'ll be in touch.' });
  }

  if (!name || name.length < 2 || name.length > 120) {
    return res.status(400).json({ success: false, message: 'name is required (2–120 chars).' });
  }
  if (!email || email.length > 320 ||
      !validator.isEmail(email, { allow_utf8_local_part: false })) {
    return res.status(400).json({ success: false, message: 'a valid email is required.' });
  }
  if (organization.length > 200) {
    return res.status(400).json({ success: false, message: 'organisation name too long (max 200).' });
  }
  if (!message || message.length < 10 || message.length > 4000) {
    return res.status(400).json({ success: false, message: 'message is required (10–4000 chars).' });
  }

  req.body.name = name;
  req.body.email = email;
  req.body.organization = organization;
  req.body.message = message;
  next();
}

module.exports = { validateEmail, validateContact };
