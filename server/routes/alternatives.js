const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const auth = require('../middleware/auth');
const { queryOpenRouter, parseAIJson, persistAIResult } = require('../services/openrouter');
const { logAudit } = require('../middleware/auditLog');
const router = express.Router();

const altValidation = [
  body('original_part_id').isInt({ min: 1 }).withMessage('original_part_id must be a positive integer'),
  body('alt_part_number').trim().notEmpty().withMessage('alt_part_number is required').isLength({ max: 100 }),
  body('alt_part_name').trim().notEmpty().withMessage('alt_part_name is required').isLength({ max: 255 }),
  body('alt_unit_cost').optional({ checkFalsy: true }).isFloat({ gt: 0 }).withMessage('alt_unit_cost must be a positive number'),
  body('compatibility_score').optional({ checkFalsy: true }).isFloat({ min: 0, max: 100 }).withMessage('compatibility_score must be 0-100'),
  body('cost_savings_percent').optional({ checkFalsy: true }).isFloat({ min: -100, max: 100 }),
  body('lead_time_days').optional({ checkFalsy: true }).isInt({ min: 0 }),
];

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
}

function aiRateLimit(req, res, next) {
  const limiter = req.app.get('aiRateLimiter');
  if (limiter) return limiter(req, res, next);
  next();
}

router.get('/', auth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const countResult = await pool.query('SELECT COUNT(*) FROM alternative_parts');
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(`
      SELECT ap.*, bi.part_name as original_part_name, bi.part_number as original_part_number, bi.unit_cost as original_unit_cost
      FROM alternative_parts ap
      JOIN bom_items bi ON ap.original_part_id = bi.id
      ORDER BY ap.id
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    res.json({
      data: result.rows,
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) || 1 },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ap.*, bi.part_name as original_part_name, bi.part_number as original_part_number, bi.unit_cost as original_unit_cost
      FROM alternative_parts ap
      JOIN bom_items bi ON ap.original_part_id = bi.id
      WHERE ap.id = $1
    `, [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, altValidation, validate, async (req, res) => {
  try {
    const { original_part_id, alt_part_number, alt_part_name, alt_manufacturer, alt_unit_cost, alt_supplier, compatibility_score, cost_savings_percent, lead_time_days, notes, status } = req.body;
    const result = await pool.query(
      `INSERT INTO alternative_parts (original_part_id, alt_part_number, alt_part_name, alt_manufacturer, alt_unit_cost, alt_supplier, compatibility_score, cost_savings_percent, lead_time_days, notes, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [original_part_id, alt_part_number, alt_part_name, alt_manufacturer, alt_unit_cost, alt_supplier, compatibility_score, cost_savings_percent, lead_time_days, notes, status || 'pending']
    );
    logAudit(req.user.email, 'CREATE', 'alternative_part', result.rows[0].id, alt_part_name, `Created alternative part ${alt_part_number}`);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, altValidation, validate, async (req, res) => {
  try {
    const { original_part_id, alt_part_number, alt_part_name, alt_manufacturer, alt_unit_cost, alt_supplier, compatibility_score, cost_savings_percent, lead_time_days, notes, status } = req.body;
    const result = await pool.query(
      `UPDATE alternative_parts SET original_part_id=$1, alt_part_number=$2, alt_part_name=$3, alt_manufacturer=$4, alt_unit_cost=$5, alt_supplier=$6, compatibility_score=$7, cost_savings_percent=$8, lead_time_days=$9, notes=$10, status=$11, updated_at=NOW()
       WHERE id=$12 RETURNING *`,
      [original_part_id, alt_part_number, alt_part_name, alt_manufacturer, alt_unit_cost, alt_supplier, compatibility_score, cost_savings_percent, lead_time_days, notes, status, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    logAudit(req.user.email, 'UPDATE', 'alternative_part', req.params.id, alt_part_name, `Updated alternative part ${alt_part_number}`);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM alternative_parts WHERE id = $1 RETURNING *', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    logAudit(req.user.email, 'DELETE', 'alternative_part', req.params.id, result.rows[0].alt_part_name, `Deleted alternative part ${result.rows[0].alt_part_number}`);
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// AI: Find alternatives for a part — now returns structured JSON and persists
router.post('/ai/find/:bomItemId', auth, aiRateLimit, async (req, res) => {
  try {
    const item = await pool.query('SELECT * FROM bom_items WHERE id = $1', [req.params.bomItemId]);
    if (!item.rows[0]) return res.status(404).json({ error: 'BOM item not found' });
    const i = item.rows[0];
    const prompt = `Find alternative parts for this component. Respond ONLY in JSON format.

Component:
- Part: ${i.part_name} (${i.part_number})
- Manufacturer: ${i.manufacturer}
- Unit Cost: $${i.unit_cost}
- Category: ${i.category}
- Description: ${i.description}

{
  "alternatives": [
    {
      "alt_part_number": "...",
      "alt_part_name": "...",
      "alt_manufacturer": "...",
      "alt_supplier": "...",
      "estimated_unit_cost": 0.00,
      "compatibility_score": 95,
      "cost_savings_percent": 12.5,
      "estimated_lead_time_days": 14,
      "type": "drop-in|pin-compatible|functional-equivalent",
      "key_differences": "...",
      "rationale": "..."
    }
  ],
  "summary": "...",
  "recommended_alternative": "part_number of top pick",
  "total_savings_potential": 0.00
}`;

    const systemPrompt = 'You are an expert electronic components engineer with deep knowledge of cross-referencing parts across manufacturers. Provide specific, real alternative components. Always respond with valid JSON.';
    const rawAnalysis = await queryOpenRouter(prompt, systemPrompt);
    const data = parseAIJson(rawAnalysis);
    await persistAIResult(pool, {
      feature: 'find-alternatives',
      entity_type: 'bom_item',
      entity_id: parseInt(req.params.bomItemId),
      user_email: req.user?.email,
      request_payload: { bomItemId: req.params.bomItemId },
      response: data,
    });
    res.json({ success: true, data, original_item: i });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
