const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const auth = require('../middleware/auth');
const { queryOpenRouter, parseAIJson, persistAIResult } = require('../services/openrouter');
const { logAudit } = require('../middleware/auditLog');
const router = express.Router();

const riskValidation = [
  body('bom_item_id').isInt({ min: 1 }).withMessage('bom_item_id must be a positive integer'),
  body('risk_category').trim().notEmpty().withMessage('risk_category is required').isLength({ max: 100 }),
  body('risk_score').optional({ checkFalsy: true }).isFloat({ min: 0, max: 10 }).withMessage('risk_score must be 0-10'),
  body('probability').optional({ checkFalsy: true }).isIn(['low', 'medium', 'high']).withMessage('probability must be low, medium, or high'),
  body('impact').optional({ checkFalsy: true }).isIn(['low', 'medium', 'high']).withMessage('impact must be low, medium, or high'),
  body('single_source_risk').optional({ checkFalsy: true }).isBoolean(),
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
    const { min_score, single_source } = req.query;

    const conditions = [];
    const params = [];
    if (min_score) { params.push(parseFloat(min_score)); conditions.push(`ra.risk_score >= $${params.length}`); }
    if (single_source === 'true') conditions.push('ra.single_source_risk = true');

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(`SELECT COUNT(*) FROM risk_assessments ra ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    const listParams = [...params, limit, offset];
    const result = await pool.query(`
      SELECT ra.*, bi.part_name, bi.part_number, bi.manufacturer, bi.category
      FROM risk_assessments ra
      JOIN bom_items bi ON ra.bom_item_id = bi.id
      ${where}
      ORDER BY ra.risk_score DESC
      LIMIT $${listParams.length - 1} OFFSET $${listParams.length}
    `, listParams);

    res.json({
      data: result.rows,
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) || 1 },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ra.*, bi.part_name, bi.part_number, bi.manufacturer, bi.category, bi.unit_cost, bi.quantity, bi.supplier
      FROM risk_assessments ra
      JOIN bom_items bi ON ra.bom_item_id = bi.id
      WHERE ra.id = $1
    `, [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, riskValidation, validate, async (req, res) => {
  try {
    const { bom_item_id, risk_category, risk_score, probability, impact, supply_chain_risk, geopolitical_risk, single_source_risk, mitigation_plan, contingency_plan, risk_owner, review_date } = req.body;
    const result = await pool.query(
      `INSERT INTO risk_assessments (bom_item_id, risk_category, risk_score, probability, impact, supply_chain_risk, geopolitical_risk, single_source_risk, mitigation_plan, contingency_plan, risk_owner, review_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [bom_item_id, risk_category, risk_score, probability, impact, supply_chain_risk, geopolitical_risk, single_source_risk, mitigation_plan, contingency_plan, risk_owner, review_date]
    );
    logAudit(req.user.email, 'CREATE', 'risk_assessment', result.rows[0].id, `BOM Item ${bom_item_id}`, `Created risk: ${risk_category}, score: ${risk_score}`);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, riskValidation, validate, async (req, res) => {
  try {
    const { bom_item_id, risk_category, risk_score, probability, impact, supply_chain_risk, geopolitical_risk, single_source_risk, mitigation_plan, contingency_plan, risk_owner, review_date } = req.body;
    const result = await pool.query(
      `UPDATE risk_assessments SET bom_item_id=$1, risk_category=$2, risk_score=$3, probability=$4, impact=$5, supply_chain_risk=$6, geopolitical_risk=$7, single_source_risk=$8, mitigation_plan=$9, contingency_plan=$10, risk_owner=$11, review_date=$12, updated_at=NOW()
       WHERE id=$13 RETURNING *`,
      [bom_item_id, risk_category, risk_score, probability, impact, supply_chain_risk, geopolitical_risk, single_source_risk, mitigation_plan, contingency_plan, risk_owner, review_date, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    logAudit(req.user.email, 'UPDATE', 'risk_assessment', req.params.id, `BOM Item ${bom_item_id}`, `Updated risk: ${risk_category}, score: ${risk_score}`);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM risk_assessments WHERE id = $1 RETURNING *', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    logAudit(req.user.email, 'DELETE', 'risk_assessment', req.params.id, `BOM Item ${result.rows[0].bom_item_id}`, `Deleted risk assessment`);
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// AI: Analyze risk — structured JSON + persist
router.post('/ai/analyze/:bomItemId', auth, aiRateLimit, async (req, res) => {
  try {
    const item = (await pool.query('SELECT * FROM bom_items WHERE id = $1', [req.params.bomItemId])).rows[0];
    if (!item) return res.status(404).json({ error: 'BOM item not found' });
    const existing = await pool.query('SELECT risk_category, risk_score, probability, impact FROM risk_assessments WHERE bom_item_id = $1', [req.params.bomItemId]);

    const prompt = `Perform comprehensive risk assessment for this component. Respond ONLY in JSON format.

Component:
- Part: ${item.part_name} (${item.part_number})
- Manufacturer: ${item.manufacturer}
- Unit Cost: $${item.unit_cost}, Quantity: ${item.quantity}
- Supplier: ${item.supplier}, Category: ${item.category}

Existing risks: ${existing.rows.length > 0 ? JSON.stringify(existing.rows) : 'none'}

{
  "overall_risk_score": 7.5,
  "risk_level": "high|medium|low",
  "risk_categories": [
    {
      "risk_category": "supply_chain|geopolitical|single_source|natural_disaster|quality|price_volatility|obsolescence",
      "risk_score": 7.5,
      "probability": "low|medium|high",
      "impact": "low|medium|high",
      "supply_chain_risk": true,
      "geopolitical_risk": false,
      "single_source_risk": false,
      "justification": "...",
      "mitigation_plan": "...",
      "contingency_plan": "..."
    }
  ],
  "top_risks": ["..."],
  "mitigation_roadmap": ["..."],
  "risk_owner_recommendation": "...",
  "review_frequency_days": 90
}`;

    const systemPrompt = 'You are a supply chain risk management expert with deep knowledge of geopolitical factors, component market dynamics, and manufacturing risk mitigation. Always respond with valid JSON.';
    const rawAnalysis = await queryOpenRouter(prompt, systemPrompt);
    const data = parseAIJson(rawAnalysis);
    await persistAIResult(pool, {
      feature: 'risk-analyze',
      entity_type: 'bom_item',
      entity_id: parseInt(req.params.bomItemId),
      user_email: req.user?.email,
      request_payload: { bomItemId: req.params.bomItemId },
      response: data,
    });
    res.json({ success: true, data, item, existing_risks: existing.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
