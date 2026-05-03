const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { queryOpenRouter, parseAIJson, persistAIResult } = require('../services/openrouter');
const { logAudit } = require('../middleware/auditLog');
const { body, validationResult } = require('express-validator');
const router = express.Router();

const supplierValidation = [
  body('name').trim().notEmpty().withMessage('name is required').isLength({ max: 200 }),
  body('contact_email').optional({ checkFalsy: true }).isEmail().withMessage('contact_email must be a valid email'),
  body('rating').optional({ checkFalsy: true }).isFloat({ min: 0, max: 5 }).withMessage('rating must be 0-5'),
  body('quality_score').optional({ checkFalsy: true }).isFloat({ min: 0, max: 100 }).withMessage('quality_score must be 0-100'),
  body('delivery_score').optional({ checkFalsy: true }).isFloat({ min: 0, max: 100 }).withMessage('delivery_score must be 0-100'),
  body('price_score').optional({ checkFalsy: true }).isFloat({ min: 0, max: 100 }).withMessage('price_score must be 0-100'),
];

function validateRequest(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
}

router.get('/', auth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const countResult = await pool.query('SELECT COUNT(*) FROM suppliers');
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(`
      SELECT *,
        ROUND(
          (COALESCE(quality_score, 0) * 0.40 +
           COALESCE(delivery_score, 0) * 0.35 +
           COALESCE(price_score, 0) * 0.25)::numeric, 2
        ) as composite_score
      FROM suppliers
      ORDER BY composite_score DESC NULLS LAST
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    res.json({
      data: result.rows,
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM suppliers WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, supplierValidation, validateRequest, async (req, res) => {
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

router.put('/:id', auth, supplierValidation, validateRequest, async (req, res) => {
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

// GET /api/suppliers/scorecard — supplier ranking with composite scores (NEW feature)
router.get('/scorecard', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        s.id, s.name, s.country, s.category, s.status,
        s.quality_score, s.delivery_score, s.price_score, s.rating,
        s.total_orders, s.on_time_delivery_percent,
        ROUND(
          (COALESCE(s.quality_score, 0) * 0.40 +
           COALESCE(s.delivery_score, 0) * 0.35 +
           COALESCE(s.price_score, 0) * 0.25)::numeric, 2
        ) as composite_score,
        COUNT(bi.id) as bom_items_count,
        COALESCE(SUM(bi.total_cost), 0) as total_spend
      FROM suppliers s
      LEFT JOIN bom_items bi ON bi.supplier = s.name
      GROUP BY s.id
      ORDER BY composite_score DESC NULLS LAST
    `);

    const rows = result.rows.map((row, idx) => ({
      ...row,
      rank: idx + 1,
      tier: parseFloat(row.composite_score) >= 80 ? 'A' :
            parseFloat(row.composite_score) >= 65 ? 'B' :
            parseFloat(row.composite_score) >= 50 ? 'C' : 'D',
    }));

    const summary = {
      total_suppliers: rows.length,
      tier_distribution: {
        A: rows.filter(r => r.tier === 'A').length,
        B: rows.filter(r => r.tier === 'B').length,
        C: rows.filter(r => r.tier === 'C').length,
        D: rows.filter(r => r.tier === 'D').length,
      },
      avg_composite_score: rows.length > 0
        ? (rows.reduce((s, r) => s + parseFloat(r.composite_score || 0), 0) / rows.length).toFixed(2) : '0.00',
      top_performers: rows.slice(0, 3).map(r => r.name),
      underperformers: rows.filter(r => r.tier === 'D').map(r => r.name),
    };

    res.json({ data: rows, summary });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

function aiRateLimit(req, res, next) {
  const limiter = req.app.get('aiRateLimiter');
  if (limiter) return limiter(req, res, next);
  next();
}

router.post('/ai/evaluate/:id', auth, aiRateLimit, async (req, res) => {
  try {
    const s = (await pool.query('SELECT * FROM suppliers WHERE id = $1', [req.params.id])).rows[0];
    if (!s) return res.status(404).json({ error: 'Not found' });

    const prompt = `Evaluate this electronic component supplier. Respond ONLY in JSON format.

Supplier:
- Name: ${s.name}, Country: ${s.country}, Category: ${s.category}
- Rating: ${s.rating}/5.0
- Quality Score: ${s.quality_score}%, Delivery Score: ${s.delivery_score}%, Price Score: ${s.price_score}%
- Total Orders: ${s.total_orders}, On-Time Delivery: ${s.on_time_delivery_percent}%

{
  "overall_assessment": "excellent|good|adequate|poor",
  "composite_score": 85,
  "strengths": ["..."],
  "weaknesses": ["..."],
  "risk_factors": ["..."],
  "benchmark_comparison": {
    "quality_vs_industry": "above|at|below",
    "delivery_vs_industry": "above|at|below",
    "price_vs_industry": "above|at|below",
    "notes": "..."
  },
  "recommendations": ["..."],
  "business_recommendation": "increase|maintain|reduce|exit",
  "business_rationale": "...",
  "action_items": [{"priority": "high|medium|low", "action": "...", "timeline": "..."}]
}`;

    const systemPrompt = 'You are a supply chain management expert specializing in electronic component supplier evaluation. Always respond with valid JSON.';
    const rawAnalysis = await queryOpenRouter(prompt, systemPrompt);
    const data = parseAIJson(rawAnalysis);
    const summaryText = JSON.stringify(data);
    await pool.query('UPDATE suppliers SET ai_evaluation = $1, updated_at = NOW() WHERE id = $2', [summaryText, req.params.id]);
    await persistAIResult(pool, {
      feature: 'supplier-evaluate',
      entity_type: 'supplier',
      entity_id: parseInt(req.params.id),
      user_email: req.user?.email,
      request_payload: { supplierId: req.params.id },
      response: data,
    });
    res.json({ success: true, data, supplier: s });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
