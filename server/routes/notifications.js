// notifications.js — pass-5 backlog implementation.
//
// NEEDS-CREDS: this router is a thin envelope that gates on env vars and
// returns a 503 + `missing: <ENV>` response when credentials are not set.
//
// Required environment variables for full delivery (any one channel):
//   Email (SMTP):     SMTP_HOST, SMTP_USER, SMTP_PASS  (and optionally SMTP_PORT, SMTP_FROM)
//   SMS (Twilio):     TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM
//   Push (FCM):       FCM_SERVER_KEY
//
// When credentials are present we still do not perform an outbound HTTP send
// in this stub — outbound delivery is TOO-RISKY without retry/queue infra
// (see _AUDIT_NOTE.md).  We only persist a record showing the channel was
// configured and the payload was prepared.
const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

async function ensureNotificationLogTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notification_log (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      channel VARCHAR(32) NOT NULL,
      to_address TEXT,
      subject TEXT,
      body TEXT,
      status VARCHAR(32) NOT NULL DEFAULT 'prepared',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `).catch(() => {});
}
ensureNotificationLogTable();

router.use(auth);

// GET /api/notifications/_/channels — capability discovery (no creds required)
router.get('/_/channels', (req, res) => {
  res.json({
    email: {
      configured: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
      missing: [
        !process.env.SMTP_HOST && 'SMTP_HOST',
        !process.env.SMTP_USER && 'SMTP_USER',
        !process.env.SMTP_PASS && 'SMTP_PASS',
      ].filter(Boolean),
    },
    sms: {
      configured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM),
      missing: [
        !process.env.TWILIO_ACCOUNT_SID && 'TWILIO_ACCOUNT_SID',
        !process.env.TWILIO_AUTH_TOKEN && 'TWILIO_AUTH_TOKEN',
        !process.env.TWILIO_FROM && 'TWILIO_FROM',
      ].filter(Boolean),
    },
    push: {
      configured: !!process.env.FCM_SERVER_KEY,
      missing: process.env.FCM_SERVER_KEY ? [] : ['FCM_SERVER_KEY'],
    },
  });
});

// POST /api/notifications/test — gate on env, persist a "prepared" record.
router.post('/test', async (req, res) => {
  const { channel, to, subject, body } = req.body || {};
  if (!channel || !to) return res.status(400).json({ error: 'channel and to are required' });

  if (channel === 'email') {
    const missing = [];
    if (!process.env.SMTP_HOST) missing.push('SMTP_HOST');
    if (!process.env.SMTP_USER) missing.push('SMTP_USER');
    if (!process.env.SMTP_PASS) missing.push('SMTP_PASS');
    if (missing.length) return res.status(503).json({ error: 'Email channel not configured', missing });
  } else if (channel === 'sms') {
    const missing = [];
    if (!process.env.TWILIO_ACCOUNT_SID) missing.push('TWILIO_ACCOUNT_SID');
    if (!process.env.TWILIO_AUTH_TOKEN) missing.push('TWILIO_AUTH_TOKEN');
    if (!process.env.TWILIO_FROM) missing.push('TWILIO_FROM');
    if (missing.length) return res.status(503).json({ error: 'SMS channel not configured', missing });
  } else if (channel === 'push') {
    if (!process.env.FCM_SERVER_KEY) {
      return res.status(503).json({ error: 'Push channel not configured', missing: ['FCM_SERVER_KEY'] });
    }
  } else {
    return res.status(400).json({ error: 'channel must be email|sms|push' });
  }

  try {
    const r = await pool.query(
      `INSERT INTO notification_log (user_id, channel, to_address, subject, body, status)
       VALUES ($1,$2,$3,$4,$5,'prepared') RETURNING id, channel, to_address, subject, status, created_at`,
      [req.user?.id || null, channel, to, subject || null, body || null]
    );
    res.status(202).json({
      success: true,
      note: 'Credentials present; payload persisted as `prepared` (outbound send is gated by future delivery worker).',
      record: r.rows[0],
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record notification', details: err.message });
  }
});

router.get('/log', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, channel, to_address, subject, status, created_at
       FROM notification_log WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [req.user?.id || null]
    );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list notifications', details: err.message });
  }
});

module.exports = router;
