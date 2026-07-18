'use strict';

const { Resend } = require('resend');

// Lazily construct the Resend client. `new Resend(undefined)` throws at
// construction, so building it at module load meant the whole server crashed
// on boot whenever RESEND_API_KEY was unset — turning a rotation slip or a
// fresh deploy into a PM2 crash loop and making every "if (!RESEND_API_KEY)"
// degradation guard dead code. Constructing on first use lets the app boot
// and degrade gracefully instead.
let _client = null;

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!_client) _client = new Resend(key);
  return _client;
}

module.exports = { getResend };
