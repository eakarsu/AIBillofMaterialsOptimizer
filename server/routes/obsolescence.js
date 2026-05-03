const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const auth = require('../middleware/auth');
const { queryOpenRouter, parseAIJson, persistAIResult } = require('../services/openrouter');
const { logAudit } = require('../middleware/auditLog');
const router = express.Router();

const obsValidation = [
  body('bom_item_id').isInt({ min: 1 }).withMessage('bom_item_id must be a positive integer'),
  body('risk_level').isIn(['low', 'medium', 'high']).withMessage('risk_level must be low, medium, or high'),
  body('confidence_score').optional({ checkFalsy: true }).isFloat({ min: 0, max: 100 }),
  body('predicted_eol_date').optional({ checkFalsy: true }).isDate().withMessage('predicted_eol_date must be a valid date'),
  body('lifecycle_stage').optional({ checkFalsy: true }).isLength({ max: 50 }),
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
    const { risk_level } = req.query;

    const conditions = [];
    const params = [];
    if (risk_level) { params.push(risk_level); conditions.push(`op.risk_level = $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(`SELECT COUNT(*) FROM obsolescence_predictions op ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(limit, offset);
    const result = await pool.query(`
      SELECT op.*, bi.part_name, bi.part_number, bi.manufacturer, bi.category
      FROM obsolescence_predictions op
      JOIN bom_items bi ON op.bom_item_id = bi.id
      ${where}
      ORDER BY
        CASE op.risk_level WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
        op.predicted_eol_date
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    res.json({
      data: result.rows,
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) || 1 },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT op.*, bi.part_name, bi.part_number, bi.manufacturer, bi.category, bi.unit_cost, bi.quantity, bi.supplier
      FROM obsolescence_predictions op
      JOIN bom_items bi ON op.bom_item_id = bi.id
      WHERE op.id = $1
    `, [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, obsValidation, validate, async (req, res) => {
  try {
    const { bom_item_id, risk_level, predicted_eol_date, confidence_score, lifecycle_stage, last_buy_date, recommended_action, mitigation_strategy } = req.body;
    const result = await pool.query(
      `INSERT INTO obsolescence_predictions (bom_item_id, risk_level, predicted_eol_date, confidence_score, lifecycle_stage, last_buy_date, recommended_action, mitigation_strategy)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [bom_item_id, risk_level, predicted_eol_date, confidence_score, lifecycle_stage, last_buy_date, recommended_action, mitigation_strategy]
    );
    logAudit(req.user.email, 'CREATE', 'obsolescence_prediction', result.rows[0].id, `BOM Item ${bom_item_id}`, `Created obsolescence prediction: ${risk_level} risk`);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, obsValidation, validate, async (req, res) => {
  try {
    const { bom_item_id, risk_level, predicted_eol_date, confidence_score, lifecycle_stage, last_buy_date, recommended_action, mitigation_strategy } = req.body;
    const result = await pool.query(
      `UPDATE obsolescence_predictions SET bom_item_id=$1, risk_level=$2, predicted_eol_date=$3, confidence_score=$4, lifecycle_stage=$5, last_buy_date=$6, recommended_action=$7, mitigation_strategy=$8, updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [bom_item_id, risk_level, predicted_eol_date, confidence_score, lifecycle_stage, last_buy_date, recommended_action, mitigation_strategy, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    logAudit(req.user.email, 'UPDATE', 'obsolescence_prediction', req.params.id, `BOM Item ${bom_item_id}`, `Updated obsolescence prediction: ${risk_level} risk`);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM obsolescence_predictions WHERE id = $1 RETURNING *', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    logAudit(req.user.email, 'DELETE', 'obsolescence_prediction', req.params.id, `BOM Item ${result.rows[0].bom_item_id}`, `Deleted obsolescence prediction`);
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// AI: Predict obsolescence — structured JSON output + persist
router.post('/ai/predict/:bomItemId', auth, aiRateLimit, async (req, res) => {
  try {
    const item = await pool.query('SELECT * FROM bom_items WHERE id = $1', [req.params.bomItemId]);
    if (!item.rows[0]) return res.status(404).json({ error: 'BOM item not found' });
    const i = item.rows[0];
    const prompt = `Analyze the obsolescence risk for this electronic component. Respond ONLY in JSON format.

Component:
- Part: ${i.part_name} (${i.part_number})
- Manufacturer: ${i.manufacturer}
- Category: ${i.category}
- Description: ${i.description || 'N/A'}

{
  "risk_level": "high|medium|low",
  "lifecycle_stage": "Active|Mature|End of Life|Obsolete",
  "predicted_eol_date": "YYYY-MM-DD",
  "last_buy_date_recommendation": "YYYY-MM-DD",
  "confidence_score": 85,
  "years_remaining": 3,
  "risk_justification": "...",
  "recommended_action": "...",
  "mitigation_strategy": "...",
  "recommended_replacements": [
    {"part_number": "...", "manufacturer": "...", "compatibility": "drop-in|pin-compatible", "notes": "..."}
  ],
  "bom_impact": "...",
  "urgency": "immediate|6-12 months|1-2 years|low"
}`;

    const systemPrompt = 'You are an expert in electronic component lifecycle management and obsolescence forecasting. Provide realistic assessments. Always respond with valid JSON.';
    const rawAnalysis = await queryOpenRouter(prompt, systemPrompt);
    const data = parseAIJson(rawAnalysis);
    await persistAIResult(pool, {
      feature: 'obsolescence-predict',
      entity_type: 'bom_item',
      entity_id: parseInt(req.params.bomItemId),
      user_email: req.user?.email,
      request_payload: { bomItemId: req.params.bomItemId },
      response: data,
    });
    res.json({ success: true, data, item: i });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
