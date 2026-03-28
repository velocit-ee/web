'use strict';

const express = require('express');
const router  = express.Router();
const { pool } = require('../db');

const START = Date.now();

// GET /health
router.get('/', async (_req, res) => {
  const uptime = Math.floor((Date.now() - START) / 1000);
  try {
    const { rows: [{ n }] } = await pool.query(
      'SELECT COUNT(*)::int AS n FROM waitlist'
    );
    res.json({ status: 'ok', uptime, signups: n });
  } catch {
    res.status(503).json({ status: 'degraded', uptime, signups: null });
  }
});

module.exports = router;
