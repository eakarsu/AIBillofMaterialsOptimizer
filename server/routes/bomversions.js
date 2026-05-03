const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const auth = require('../middleware/auth');
const { queryOpenRouter, parseAIJson, persistAIResult } = require('../services/openrouter');
const { logAudit } = require('../middleware/auditLog');
const router = express.Router();

const versionValidation = [
  body('version_name').trim().notEmpty().withMessage('version_name is required').isLength({ max: 255 }),
  body('version_number').optional({ checkFalsy: true }).isLength({ max: 20 }),
  body('total_cost').optional({ checkFalsy: true }).isFloat({ min: 0 }),
  body('total_items').optional({ checkFalsy: true }).isInt({ min: 0 }),
  body('status').optional({ checkFalsy: true }).isIn(['draft', 'approved', 'archived', 'active']),
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
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const { status } = req.query;

    const conditions = [];
    const params = [];
    if (status) { params.push(status); conditions.push(`status = $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(`SELECT COUNT(*) FROM bom_versions ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(limit, offset);
    const result = await pool.query(
      `SELECT * FROM bom_versions ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      data: result.rows,
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) || 1 },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM bom_versions WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, versionValidation, validate, async (req, res) => {
  try {
    const { version_name, version_number, description, total_cost, total_items, change_type, changed_by, change_reason, baseline_version_id, cost_difference, status } = req.body;
    const result = await pool.query(
      `INSERT INTO bom_versions (version_name, version_number, description, total_cost, total_items, change_type, changed_by, change_reason, baseline_version_id, cost_difference, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [version_name, version_number, description, total_cost, total_items, change_type, changed_by, change_reason, baseline_version_id, cost_difference, status || 'draft']
    );
    logAudit(req.user.email, 'CREATE', 'bom_version', result.rows[0].id, version_name, `Created BOM version ${version_number}`);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, versionValidation, validate, async (req, res) => {
  try {
    const { version_name, version_number, description, total_cost, total_items, change_type, changed_by, change_reason, baseline_version_id, cost_difference, status } = req.body;
    const result = await pool.query(
      `UPDATE bom_versions SET version_name=$1, version_number=$2, description=$3, total_cost=$4, total_items=$5, change_type=$6, changed_by=$7, change_reason=$8, baseline_version_id=$9, cost_difference=$10, status=$11, updated_at=NOW()
       WHERE id=$12 RETURNING *`,
      [version_name, version_number, description, total_cost, total_items, change_type, changed_by, change_reason, baseline_version_id, cost_difference, status, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    logAudit(req.user.email, 'UPDATE', 'bom_version', req.params.id, version_name, `Updated BOM version ${version_number}`);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM bom_versions WHERE id = $1 RETURNING *', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    logAudit(req.user.email, 'DELETE', 'bom_version', req.params.id, result.rows[0].version_name, `Deleted BOM version`);
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// AI: Compare BOM versions — structured JSON + persist
router.post('/ai/compare', auth, aiRateLimit, async (req, res) => {
  try {
    const versions = (await pool.query('SELECT * FROM bom_versions ORDER BY version_number')).rows;

    const prompt = `Compare these BOM versions and provide analysis. Respond ONLY in JSON format.

BOM Versions:
${JSON.stringify(versions.map(v => ({
  version_name: v.version_name,
  version_number: v.version_number,
  total_items: v.total_items,
  total_cost: v.total_cost,
  change_type: v.change_type,
  status: v.status,
  change_reason: v.change_reason,
  cost_difference: v.cost_difference,
})), null, 2)}

{
  "cost_trend": {
    "direction": "increasing|decreasing|stable",
    "total_change": 0.00,
    "change_percent": 0.0,
    "version_over_version": [{"from": "...", "to": "...", "delta": 0.00, "delta_pct": 0.0}]
  },
  "most_cost_effective_version": "...",
  "risk_assessment_by_version": [{"version": "...", "risk_level": "low|medium|high", "risk_factors": ["..."]}],
  "recommendations_for_next_version": ["..."],
  "missed_optimization_opportunities": ["..."],
  "change_impact_summary": [{"version": "...", "change_type": "...", "impact": "..."}],
  "overall_assessment": "..."
}`;

    const systemPrompt = 'You are a BOM configuration management expert specializing in version control, change management, and cost impact analysis. Always respond with valid JSON.';
    const rawAnalysis = await queryOpenRouter(prompt, systemPrompt);
    const data = parseAIJson(rawAnalysis);
    await persistAIResult(pool, {
      feature: 'bom-version-compare',
      entity_type: 'bom_versions',
      entity_id: null,
      user_email: req.user?.email,
      request_payload: { version_count: versions.length },
      response: data,
    });
    res.json({ success: true, data, versions });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
