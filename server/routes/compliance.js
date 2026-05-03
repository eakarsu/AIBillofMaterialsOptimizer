const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const auth = require('../middleware/auth');
const { queryOpenRouter, parseAIJson, persistAIResult } = require('../services/openrouter');
const { logAudit } = require('../middleware/auditLog');
const router = express.Router();

const compValidation = [
  body('bom_item_id').isInt({ min: 1 }).withMessage('bom_item_id must be a positive integer'),
  body('regulation_type').trim().notEmpty().withMessage('regulation_type is required').isLength({ max: 100 }),
  body('compliance_status').isIn(['compliant', 'non-compliant', 'pending', 'exempt']).withMessage('Invalid compliance_status'),
  body('expiry_date').optional({ checkFalsy: true }).isDate().withMessage('expiry_date must be a valid date'),
  body('rohs_compliant').optional({ checkFalsy: true }).isBoolean(),
  body('reach_compliant').optional({ checkFalsy: true }).isBoolean(),
  body('conflict_mineral_free').optional({ checkFalsy: true }).isBoolean(),
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
    const { compliance_status, regulation_type } = req.query;

    const conditions = [];
    const params = [];
    if (compliance_status) { params.push(compliance_status); conditions.push(`cr.compliance_status = $${params.length}`); }
    if (regulation_type) { params.push(`%${regulation_type}%`); conditions.push(`cr.regulation_type ILIKE $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(`SELECT COUNT(*) FROM compliance_records cr ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(limit, offset);
    const result = await pool.query(`
      SELECT cr.*, bi.part_name, bi.part_number, bi.manufacturer, bi.category
      FROM compliance_records cr
      JOIN bom_items bi ON cr.bom_item_id = bi.id
      ${where}
      ORDER BY cr.compliance_status, cr.expiry_date
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
      SELECT cr.*, bi.part_name, bi.part_number, bi.manufacturer, bi.category, bi.supplier
      FROM compliance_records cr
      JOIN bom_items bi ON cr.bom_item_id = bi.id
      WHERE cr.id = $1
    `, [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, compValidation, validate, async (req, res) => {
  try {
    const { bom_item_id, regulation_type, compliance_status, certificate_number, expiry_date, testing_lab, test_date, rohs_compliant, reach_compliant, conflict_mineral_free, documentation_url, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO compliance_records (bom_item_id, regulation_type, compliance_status, certificate_number, expiry_date, testing_lab, test_date, rohs_compliant, reach_compliant, conflict_mineral_free, documentation_url, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [bom_item_id, regulation_type, compliance_status, certificate_number, expiry_date, testing_lab, test_date, rohs_compliant, reach_compliant, conflict_mineral_free, documentation_url, notes]
    );
    logAudit(req.user.email, 'CREATE', 'compliance_record', result.rows[0].id, `BOM Item ${bom_item_id}`, `Created compliance record: ${regulation_type} - ${compliance_status}`);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, compValidation, validate, async (req, res) => {
  try {
    const { bom_item_id, regulation_type, compliance_status, certificate_number, expiry_date, testing_lab, test_date, rohs_compliant, reach_compliant, conflict_mineral_free, documentation_url, notes } = req.body;
    const result = await pool.query(
      `UPDATE compliance_records SET bom_item_id=$1, regulation_type=$2, compliance_status=$3, certificate_number=$4, expiry_date=$5, testing_lab=$6, test_date=$7, rohs_compliant=$8, reach_compliant=$9, conflict_mineral_free=$10, documentation_url=$11, notes=$12, updated_at=NOW()
       WHERE id=$13 RETURNING *`,
      [bom_item_id, regulation_type, compliance_status, certificate_number, expiry_date, testing_lab, test_date, rohs_compliant, reach_compliant, conflict_mineral_free, documentation_url, notes, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    logAudit(req.user.email, 'UPDATE', 'compliance_record', req.params.id, `BOM Item ${bom_item_id}`, `Updated compliance record: ${regulation_type} - ${compliance_status}`);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM compliance_records WHERE id = $1 RETURNING *', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    logAudit(req.user.email, 'DELETE', 'compliance_record', req.params.id, `BOM Item ${result.rows[0].bom_item_id}`, `Deleted compliance record`);
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// AI: Assess compliance — structured JSON + persist
router.post('/ai/assess/:bomItemId', auth, aiRateLimit, async (req, res) => {
  try {
    const item = (await pool.query('SELECT * FROM bom_items WHERE id = $1', [req.params.bomItemId])).rows[0];
    if (!item) return res.status(404).json({ error: 'BOM item not found' });
    const records = await pool.query('SELECT * FROM compliance_records WHERE bom_item_id = $1', [req.params.bomItemId]);

    const prompt = `Assess regulatory compliance for this electronic component. Respond ONLY in JSON format.

Component:
- Part: ${item.part_name} (${item.part_number})
- Manufacturer: ${item.manufacturer}
- Category: ${item.category}

Existing compliance records (${records.rows.length}):
${records.rows.length > 0 ? JSON.stringify(records.rows.map(r => ({ regulation: r.regulation_type, status: r.compliance_status, rohs: r.rohs_compliant, reach: r.reach_compliant })), null, 2) : '[]'}

{
  "overall_compliance_status": "compliant|non-compliant|partial|unknown",
  "overall_score": 85,
  "regulations": [
    {
      "regulation": "RoHS|REACH|Conflict Minerals|Prop 65|WEEE",
      "status": "compliant|non-compliant|pending|unknown",
      "gaps": "...",
      "required_action": "...",
      "urgency": "immediate|soon|monitor"
    }
  ],
  "gap_analysis": "...",
  "required_certifications": ["..."],
  "market_restrictions": { "EU": "allowed|restricted", "US": "allowed|restricted", "Asia": "allowed|restricted" },
  "upcoming_regulation_changes": [
    { "regulation": "...", "effective_date": "YYYY-MM-DD", "impact": "...", "preparation_steps": ["..."] }
  ],
  "action_items": [
    { "priority": "high|medium|low", "action": "...", "deadline_days": 30 }
  ]
}`;

    const systemPrompt = 'You are a regulatory compliance expert for electronic components, with deep knowledge of RoHS, REACH, conflict minerals, UL, CE, FCC, and WEEE directives. Always respond with valid JSON.';
    const rawAnalysis = await queryOpenRouter(prompt, systemPrompt);
    const data = parseAIJson(rawAnalysis);
    await persistAIResult(pool, {
      feature: 'compliance-assess',
      entity_type: 'bom_item',
      entity_id: parseInt(req.params.bomItemId),
      user_email: req.user?.email,
      request_payload: { bomItemId: req.params.bomItemId },
      response: data,
    });
    res.json({ success: true, data, item, records: records.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
