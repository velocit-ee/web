'use strict';

const bcrypt = require('bcryptjs');

/**
 * HTTP Basic Auth middleware.
 *
 * Credentials are read from env vars:
 *   ADMIN_USER  — plain username string
 *   ADMIN_PASS  — bcrypt hash of the password
 *
 * Generate the hash once with:
 *   node -e "require('bcryptjs').hash('yourpassword', 12).then(console.log)"
 * Then paste the output into .env as ADMIN_PASS=...
 */
function basicAuth(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Basic ')) return challenge(res);

  let decoded;
  try {
    decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  } catch {
    return challenge(res);
  }

  const colon = decoded.indexOf(':');
  if (colon === -1) return challenge(res);

  const username = decoded.slice(0, colon);
  const password = decoded.slice(colon + 1);

  const expectedUser = process.env.ADMIN_USER;
  const expectedHash = process.env.ADMIN_PASS;

  if (!expectedUser || !expectedHash) {
    console.error('[auth] ADMIN_USER or ADMIN_PASS env vars not configured');
    return res.status(500).send('auth not configured');
  }

  // Constant-time username comparison to prevent timing attacks
  const userMatch = timingSafeStringEqual(username, expectedUser);

  // bcrypt comparison for password
  bcrypt.compare(password, expectedHash)
    .then(passMatch => {
      if (userMatch && passMatch) return next();
      challenge(res);
    })
    .catch(() => challenge(res));
}

function challenge(res) {
  res.set('WWW-Authenticate', 'Basic realm="velocit.ee admin", charset="UTF-8"');
  return res.status(401).send('Unauthorized');
}

function timingSafeStringEqual(a, b) {
  // Pad to same length before XOR to avoid length-based timing leak
  const maxLen = Math.max(a.length, b.length);
  let diff = a.length === b.length ? 0 : 1;
  for (let i = 0; i < maxLen; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

module.exports = { basicAuth };
