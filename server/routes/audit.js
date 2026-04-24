const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

// Get audit logs with pagination and filtering
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 50, entity_type, action, search } = req.query;
    const offset = (page - 1) * limit;
    let query = 'SELECT * FROM audit_log WHERE 1=1';
    const params = [];

    if (entity_type) {
      params.push(entity_type);
      query += ` AND entity_type = $${params.length}`;
    }
    if (action) {
      params.push(action);
      query += ` AND action = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (entity_name ILIKE $${params.length} OR details ILIKE $${params.length})`;
    }

    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
    const countResult = await pool.query(countQuery, params);

    params.push(limit);
    query += ` ORDER BY created_at DESC LIMIT $${params.length}`;
    params.push(offset);
    query += ` OFFSET $${params.length}`;

    const result = await pool.query(query, params);
    res.json({
      logs: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      total_pages: Math.ceil(countResult.rows[0].count / limit)
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get audit stats
router.get('/stats', auth, async (req, res) => {
  try {
    const [actionStats, entityStats, recentActivity] = await Promise.all([
      pool.query(`
        SELECT action, COUNT(*) as count
        FROM audit_log
        GROUP BY action
        ORDER BY count DESC
      `),
      pool.query(`
        SELECT entity_type, COUNT(*) as count
        FROM audit_log
        GROUP BY entity_type
        ORDER BY count DESC
      `),
      pool.query(`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM audit_log
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `)
    ]);
    res.json({
      by_action: actionStats.rows,
      by_entity: entityStats.rows,
      daily_activity: recentActivity.rows
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
