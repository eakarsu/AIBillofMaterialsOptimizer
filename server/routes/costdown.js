const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const auth = require('../middleware/auth');
const { queryOpenRouter, parseAIJson, persistAIResult } = require('../services/openrouter');
const { logAudit } = require('../middleware/auditLog');
const router = express.Router();

const costdownValidation = [
  body('bom_item_id').isInt({ min: 1 }).withMessage('bom_item_id must be a positive integer'),
  body('analysis_type').trim().notEmpty().withMessage('analysis_type is required').isLength({ max: 100 }),
  body('current_cost').optional({ checkFalsy: true }).isFloat({ gt: 0 }).withMessage('current_cost must be positive'),
  body('target_cost').optional({ checkFalsy: true }).isFloat({ gt: 0 }).withMessage('target_cost must be positive'),
  body('savings_percent').optional({ checkFalsy: true }).isFloat({ min: 0, max: 100 }),
  body('implementation_status').optional({ checkFalsy: true }).isIn(['proposed', 'in_progress', 'implemented', 'rejected']),
  body('priority').optional({ checkFalsy: true }).isIn(['low', 'medium', 'high']),
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
    const { implementation_status, priority } = req.query;

    const conditions = [];
    const params = [];
    if (implementation_status) { params.push(implementation_status); conditions.push(`cd.implementation_status = $${params.length}`); }
    if (priority) { params.push(priority); conditions.push(`cd.priority = $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(`SELECT COUNT(*) FROM cost_down_analyses cd ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(limit, offset);
    const result = await pool.query(`
      SELECT cd.*, bi.part_name, bi.part_number, bi.manufacturer, bi.category
      FROM cost_down_analyses cd
      JOIN bom_items bi ON cd.bom_item_id = bi.id
      ${where}
      ORDER BY cd.savings_amount DESC NULLS LAST
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
      SELECT cd.*, bi.part_name, bi.part_number, bi.manufacturer, bi.category, bi.unit_cost, bi.quantity, bi.supplier
      FROM cost_down_analyses cd
      JOIN bom_items bi ON cd.bom_item_id = bi.id
      WHERE cd.id = $1
    `, [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, costdownValidation, validate, async (req, res) => {
  try {
    const { bom_item_id, analysis_type, current_cost, target_cost, achieved_cost, savings_amount, savings_percent, strategy, implementation_status, priority } = req.body;
    const result = await pool.query(
      `INSERT INTO cost_down_analyses (bom_item_id, analysis_type, current_cost, target_cost, achieved_cost, savings_amount, savings_percent, strategy, implementation_status, priority)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [bom_item_id, analysis_type, current_cost, target_cost, achieved_cost, savings_amount, savings_percent, strategy, implementation_status || 'proposed', priority || 'medium']
    );
    logAudit(req.user.email, 'CREATE', 'cost_down_analysis', result.rows[0].id, `BOM Item ${bom_item_id}`, `Created cost-down analysis: ${analysis_type}`);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, costdownValidation, validate, async (req, res) => {
  try {
    const { bom_item_id, analysis_type, current_cost, target_cost, achieved_cost, savings_amount, savings_percent, strategy, implementation_status, priority } = req.body;
    const result = await pool.query(
      `UPDATE cost_down_analyses SET bom_item_id=$1, analysis_type=$2, current_cost=$3, target_cost=$4, achieved_cost=$5, savings_amount=$6, savings_percent=$7, strategy=$8, implementation_status=$9, priority=$10, updated_at=NOW()
       WHERE id=$11 RETURNING *`,
      [bom_item_id, analysis_type, current_cost, target_cost, achieved_cost, savings_amount, savings_percent, strategy, implementation_status, priority, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    logAudit(req.user.email, 'UPDATE', 'cost_down_analysis', req.params.id, `BOM Item ${bom_item_id}`, `Updated cost-down analysis: ${analysis_type}`);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM cost_down_analyses WHERE id = $1 RETURNING *', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    logAudit(req.user.email, 'DELETE', 'cost_down_analysis', req.params.id, `BOM Item ${result.rows[0].bom_item_id}`, `Deleted cost-down analysis`);
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// AI: Generate cost-down analysis — structured JSON + persist
router.post('/ai/analyze/:bomItemId', auth, aiRateLimit, async (req, res) => {
  try {
    const item = await pool.query('SELECT * FROM bom_items WHERE id = $1', [req.params.bomItemId]);
    if (!item.rows[0]) return res.status(404).json({ error: 'BOM item not found' });
    const existingAnalyses = await pool.query('SELECT analysis_type, strategy, implementation_status FROM cost_down_analyses WHERE bom_item_id = $1', [req.params.bomItemId]);
    const i = item.rows[0];

    const prompt = `Perform a comprehensive cost-down analysis for this component. Respond ONLY in JSON format.

Component:
- Part: ${i.part_name} (${i.part_number})
- Manufacturer: ${i.manufacturer}
- Unit Cost: $${i.unit_cost}, Quantity: ${i.quantity}, Total: $${i.total_cost}
- Supplier: ${i.supplier}, Category: ${i.category}

Existing analyses: ${existingAnalyses.rows.length > 0 ? JSON.stringify(existingAnalyses.rows) : 'none'}

{
  "strategies": [
    {
      "analysis_type": "...",
      "strategy": "...",
      "current_cost": ${i.unit_cost},
      "target_cost": 0.00,
      "savings_amount": 0.00,
      "savings_percent": 0.0,
      "implementation_status": "proposed",
      "priority": "high|medium|low",
      "roi_months": 6,
      "risk_level": "low|medium|high",
      "implementation_steps": ["..."],
      "quick_win": true
    }
  ],
  "total_potential_savings": 0.00,
  "total_savings_percent": 0.0,
  "recommended_priority_order": ["..."],
  "implementation_roadmap": "...",
  "risks_and_mitigations": [{"risk": "...", "mitigation": "..."}]
}`;

    const systemPrompt = 'You are a manufacturing cost reduction specialist with expertise in value engineering, supplier negotiations, and design-for-cost methodologies. Always respond with valid JSON.';
    const rawAnalysis = await queryOpenRouter(prompt, systemPrompt);
    const data = parseAIJson(rawAnalysis);
    await persistAIResult(pool, {
      feature: 'costdown-analyze',
      entity_type: 'bom_item',
      entity_id: parseInt(req.params.bomItemId),
      user_email: req.user?.email,
      request_payload: { bomItemId: req.params.bomItemId },
      response: data,
    });
    res.json({ success: true, data, item: i, existing_analyses: existingAnalyses.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
