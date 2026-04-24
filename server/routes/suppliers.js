const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { queryOpenRouter } = require('../services/openrouter');
const { logAudit } = require('../middleware/auditLog');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM suppliers ORDER BY rating DESC NULLS LAST');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM suppliers WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { name, contact_email, contact_phone, address, country, rating, quality_score, delivery_score, price_score, total_orders, on_time_delivery_percent, category, status, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO suppliers (name, contact_email, contact_phone, address, country, rating, quality_score, delivery_score, price_score, total_orders, on_time_delivery_percent, category, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [name, contact_email, contact_phone, address, country, rating, quality_score, delivery_score, price_score, total_orders, on_time_delivery_percent, category, status || 'active', notes]
    );
    logAudit(req.user.email, 'CREATE', 'supplier', result.rows[0].id, name, `Created supplier ${name}`);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { name, contact_email, contact_phone, address, country, rating, quality_score, delivery_score, price_score, total_orders, on_time_delivery_percent, category, status, notes } = req.body;
    const result = await pool.query(
      `UPDATE suppliers SET name=$1, contact_email=$2, contact_phone=$3, address=$4, country=$5, rating=$6, quality_score=$7, delivery_score=$8, price_score=$9, total_orders=$10, on_time_delivery_percent=$11, category=$12, status=$13, notes=$14, updated_at=NOW()
       WHERE id=$15 RETURNING *`,
      [name, contact_email, contact_phone, address, country, rating, quality_score, delivery_score, price_score, total_orders, on_time_delivery_percent, category, status, notes, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    logAudit(req.user.email, 'UPDATE', 'supplier', req.params.id, name, `Updated supplier ${name}`);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM suppliers WHERE id = $1 RETURNING *', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    logAudit(req.user.email, 'DELETE', 'supplier', req.params.id, result.rows[0].name, `Deleted supplier ${result.rows[0].name}`);
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/evaluate/:id', auth, async (req, res) => {
  try {
    const s = (await pool.query('SELECT * FROM suppliers WHERE id = $1', [req.params.id])).rows[0];
    if (!s) return res.status(404).json({ error: 'Not found' });
    const prompt = `Evaluate this electronic component supplier:
- Name: ${s.name}
- Country: ${s.country}
- Category: ${s.category}
- Rating: ${s.rating}/5.0
- Quality Score: ${s.quality_score}%, Delivery Score: ${s.delivery_score}%, Price Score: ${s.price_score}%
- Total Orders: ${s.total_orders}, On-Time Delivery: ${s.on_time_delivery_percent}%

Provide: 1) Overall assessment 2) Strengths & weaknesses 3) Risk factors 4) Comparison to industry benchmarks 5) Recommendations for improvement 6) Whether to increase/maintain/reduce business with them.`;
    const analysis = await queryOpenRouter(prompt, 'You are a supply chain management expert specializing in electronic component supplier evaluation and procurement strategy.');
    await pool.query('UPDATE suppliers SET ai_evaluation = $1, updated_at = NOW() WHERE id = $2', [analysis, req.params.id]);
    res.json({ analysis, supplier: s });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
