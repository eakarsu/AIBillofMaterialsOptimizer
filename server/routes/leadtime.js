const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const auth = require('../middleware/auth');
const { queryOpenRouter, parseAIJson, persistAIResult } = require('../services/openrouter');
const { logAudit } = require('../middleware/auditLog');
const router = express.Router();

const leadtimeValidation = [
  body('bom_item_id').isInt({ min: 1 }).withMessage('bom_item_id must be a positive integer'),
  body('supplier').trim().notEmpty().withMessage('supplier is required').isLength({ max: 255 }),
  body('current_lead_time_days').optional({ checkFalsy: true }).isInt({ min: 0 }),
  body('standard_lead_time_days').optional({ checkFalsy: true }).isInt({ min: 0 }),
  body('expedited_lead_time_days').optional({ checkFalsy: true }).isInt({ min: 0 }),
  body('reliability_score').optional({ checkFalsy: true }).isFloat({ min: 0, max: 100 }),
];

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
}

router.get('/summary', auth, async (req, res) => {
  try {
    const [bySupplier, byCategory] = await Promise.all([
      pool.query(`
        SELECT
          lt.supplier,
          COUNT(*) as record_count,
          ROUND(AVG(lt.current_lead_time_days)::numeric, 1) as avg_lead_time_days,
          MIN(lt.current_lead_time_days) as min_lead_time_days,
          MAX(lt.current_lead_time_days) as max_lead_time_days,
          ROUND(AVG(lt.reliability_score)::numeric, 2) as avg_reliability_score
        FROM lead_time_records lt
        GROUP BY lt.supplier
        ORDER BY avg_lead_time_days DESC
      `),
      pool.query(`
        SELECT
          bi.category,
          COUNT(*) as record_count,
          ROUND(AVG(lt.current_lead_time_days)::numeric, 1) as avg_lead_time_days,
          MIN(lt.current_lead_time_days) as min_lead_time_days,
          MAX(lt.current_lead_time_days) as max_lead_time_days,
          ROUND(AVG(lt.standard_lead_time_days)::numeric, 1) as avg_standard_lead_time_days
        FROM lead_time_records lt
        JOIN bom_items bi ON lt.bom_item_id = bi.id
        GROUP BY bi.category
        ORDER BY avg_lead_time_days DESC
      `)
    ]);
    res.json({ by_supplier: bySupplier.rows, by_category: byCategory.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/', auth, async (req, res) => {
  try {
    const { supplier, part, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];
    const params = [];

    if (supplier) {
      params.push(`%${supplier}%`);
      conditions.push(`lt.supplier ILIKE $${params.length}`);
    }
    if (part) {
      params.push(`%${part}%`);
      conditions.push(`(bi.part_name ILIKE $${params.length} OR bi.part_number ILIKE $${params.length})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(parseInt(limit));
    params.push(offset);

    const [dataResult, countResult] = await Promise.all([
      pool.query(`
        SELECT lt.*, bi.part_name, bi.part_number, bi.manufacturer, bi.category
        FROM lead_time_records lt
        JOIN bom_items bi ON lt.bom_item_id = bi.id
        ${where}
        ORDER BY lt.current_lead_time_days DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `, params),
      pool.query(`
        SELECT COUNT(*) as total
        FROM lead_time_records lt
        JOIN bom_items bi ON lt.bom_item_id = bi.id
        ${where}
      `, params.slice(0, params.length - 2))
    ]);

    res.json({
      data: dataResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        total_pages: Math.ceil(parseInt(countResult.rows[0].total) / parseInt(limit))
      }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT lt.*, bi.part_name, bi.part_number, bi.manufacturer, bi.category, bi.unit_cost, bi.quantity, bi.supplier as bom_supplier
      FROM lead_time_records lt
      JOIN bom_items bi ON lt.bom_item_id = bi.id
      WHERE lt.id = $1
    `, [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, leadtimeValidation, validate, async (req, res) => {
  try {
    const { bom_item_id, supplier, standard_lead_time_days, current_lead_time_days, expedited_lead_time_days, last_order_date, next_delivery_date, reliability_score, trend, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO lead_time_records (bom_item_id, supplier, standard_lead_time_days, current_lead_time_days, expedited_lead_time_days, last_order_date, next_delivery_date, reliability_score, trend, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [bom_item_id, supplier, standard_lead_time_days, current_lead_time_days, expedited_lead_time_days, last_order_date, next_delivery_date, reliability_score, trend, notes]
    );
    logAudit(req.user.email, 'CREATE', 'lead_time_record', result.rows[0].id, `BOM Item ${bom_item_id}`, `Created lead time: ${supplier} ${current_lead_time_days}d`);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, leadtimeValidation, validate, async (req, res) => {
  try {
    const { bom_item_id, supplier, standard_lead_time_days, current_lead_time_days, expedited_lead_time_days, last_order_date, next_delivery_date, reliability_score, trend, notes } = req.body;
    const result = await pool.query(
      `UPDATE lead_time_records SET bom_item_id=$1, supplier=$2, standard_lead_time_days=$3, current_lead_time_days=$4, expedited_lead_time_days=$5, last_order_date=$6, next_delivery_date=$7, reliability_score=$8, trend=$9, notes=$10, updated_at=NOW()
       WHERE id=$11 RETURNING *`,
      [bom_item_id, supplier, standard_lead_time_days, current_lead_time_days, expedited_lead_time_days, last_order_date, next_delivery_date, reliability_score, trend, notes, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    logAudit(req.user.email, 'UPDATE', 'lead_time_record', req.params.id, `BOM Item ${bom_item_id}`, `Updated lead time: ${supplier} ${current_lead_time_days}d`);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM lead_time_records WHERE id = $1 RETURNING *', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    logAudit(req.user.email, 'DELETE', 'lead_time_record', req.params.id, `BOM Item ${result.rows[0].bom_item_id}`, `Deleted lead time record`);
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

function aiRateLimit(req, res, next) {
  const limiter = req.app.get('aiRateLimiter');
  if (limiter) return limiter(req, res, next);
  next();
}

// AI: Forecast lead times — structured JSON + persist
router.post('/ai/forecast/:bomItemId', auth, aiRateLimit, async (req, res) => {
  try {
    const item = await pool.query('SELECT * FROM bom_items WHERE id = $1', [req.params.bomItemId]);
    if (!item.rows[0]) return res.status(404).json({ error: 'BOM item not found' });
    const leadTimes = await pool.query('SELECT * FROM lead_time_records WHERE bom_item_id = $1', [req.params.bomItemId]);
    const i = item.rows[0];

    const prompt = `Analyze and forecast lead times for this component. Respond ONLY in JSON format.

Component:
- Part: ${i.part_name} (${i.part_number}), Manufacturer: ${i.manufacturer}
- Category: ${i.category}, Supplier: ${i.supplier}

Historical Lead Time Data:
${JSON.stringify(leadTimes.rows.map(lt => ({ supplier: lt.supplier, standard_days: lt.standard_lead_time_days, current_days: lt.current_lead_time_days, trend: lt.trend, reliability: lt.reliability_score })), null, 2)}

{
  "forecast_3_months": {"expected_lead_time_days": 0, "confidence": "low|medium|high", "trend": "increasing|stable|decreasing"},
  "forecast_6_months": {"expected_lead_time_days": 0, "confidence": "low|medium|high", "trend": "increasing|stable|decreasing"},
  "supply_chain_risks": ["..."],
  "recommendations": [
    {"type": "buffer_stock|alternative_supplier|expediting|dual_source", "action": "...", "priority": "high|medium|low", "impact": "..."}
  ],
  "alternative_suppliers": [{"name": "...", "country": "...", "estimated_lead_time_days": 0, "notes": "..."}],
  "buffer_stock_recommendation_days": 0,
  "global_trend_impact": "...",
  "overall_risk": "low|medium|high|critical"
}`;

    const systemPrompt = 'You are a supply chain analytics expert specializing in electronic component procurement and lead time optimization. Always respond with valid JSON.';
    const rawAnalysis = await queryOpenRouter(prompt, systemPrompt);
    const data = parseAIJson(rawAnalysis);
    await persistAIResult(pool, {
      feature: 'lead-time-forecast',
      entity_type: 'bom_item',
      entity_id: parseInt(req.params.bomItemId),
      user_email: req.user?.email,
      request_payload: { bomItemId: req.params.bomItemId },
      response: data,
    });
    res.json({ success: true, data, item: i, lead_times: leadTimes.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
