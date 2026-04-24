const pool = require('../db');

async function logAudit(user_email, action, entity_type, entity_id, entity_name, details) {
  try {
    await pool.query(
      `INSERT INTO audit_log (user_email, action, entity_type, entity_id, entity_name, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [user_email, action, entity_type, entity_id, entity_name, details]
    );
  } catch (err) {
    console.error('Audit log error:', err.message);
  }
}

module.exports = { logAudit };
