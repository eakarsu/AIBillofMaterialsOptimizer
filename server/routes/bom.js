const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { queryOpenRouter, parseAIJson, persistAIResult } = require('../services/openrouter');
const { logAudit } = require('../middleware/auditLog');
const { body, validationResult } = require('express-validator');
const router = express.Router();

const bomCreateValidation = [
  body('part_number')
    .trim()
    .notEmpty().withMessage('part_number is required')
    .isLength({ max: 50 }).withMessage('part_number must be at most 50 characters'),
  body('quantity')
    .isInt({ min: 1 }).withMessage('quantity must be a positive integer'),
  body('unit_cost')
    .isFloat({ gt: 0 }).withMessage('unit_cost must be a positive number'),
];

function validateRequest(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
}

// GET /api/bom/search — full-text search endpoint (NEW feature)
router.get('/search', auth, async (req, res) => {
  try {
    const { q, page, limit: lim } = req.query;
    if (!q || q.trim().length < 2) return res.status(400).json({ error: 'Search query (q) must be at least 2 characters' });
    const pg = Math.max(1, parseInt(page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(lim) || 20));
    const offset = (pg - 1) * limit;
    const searchParam = `%${q.trim()}%`;

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM bom_items WHERE part_number ILIKE $1 OR part_name ILIKE $1 OR description ILIKE $1 OR manufacturer ILIKE $1 OR category ILIKE $1 OR supplier ILIKE $1`,
      [searchParam]
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      `SELECT * FROM bom_items WHERE part_number ILIKE $1 OR part_name ILIKE $1 OR description ILIKE $1 OR manufacturer ILIKE $1 OR category ILIKE $1 OR supplier ILIKE $1
       ORDER BY total_cost DESC LIMIT $2 OFFSET $3`,
      [searchParam, limit, offset]
    );

    res.json({
      data: result.rows,
      pagination: { page: pg, limit, total, total_pages: Math.ceil(total / limit) || 1 },
      query: q,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get all BOM items (paginated)
router.get('/', auth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const { category, supplier, status } = req.query;

    const conditions = [];
    const params = [];
    if (category) { params.push(category); conditions.push(`category = $${params.length}`); }
    if (supplier) { params.push(`%${supplier}%`); conditions.push(`supplier ILIKE $${params.length}`); }
    if (status) { params.push(status); conditions.push(`status = $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(`SELECT COUNT(*) FROM bom_items ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(limit, offset);
    const result = await pool.query(
      `SELECT * FROM bom_items ${where} ORDER BY id LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      data: result.rows,
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get single BOM item
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM bom_items WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Create BOM item
router.post('/', auth, bomCreateValidation, validateRequest, async (req, res) => {
  try {
    const { part_number, part_name, description, category, manufacturer, unit_cost, quantity, supplier, status } = req.body;
    const total_cost = unit_cost * quantity;
    const result = await pool.query(
      `INSERT INTO bom_items (part_number, part_name, description, category, manufacturer, unit_cost, quantity, total_cost, supplier, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [part_number, part_name, description, category, manufacturer, unit_cost, quantity, total_cost, supplier, status || 'active']
    );
    logAudit(req.user.email, 'CREATE', 'bom_item', result.rows[0].id, part_name, `Created BOM item ${part_number}`);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update BOM item
router.put('/:id', auth, async (req, res) => {
  try {
    const { part_number, part_name, description, category, manufacturer, unit_cost, quantity, supplier, status } = req.body;
    const total_cost = unit_cost * quantity;
    const result = await pool.query(
      `UPDATE bom_items SET part_number=$1, part_name=$2, description=$3, category=$4, manufacturer=$5, unit_cost=$6, quantity=$7, total_cost=$8, supplier=$9, status=$10, updated_at=NOW()
       WHERE id=$11 RETURNING *`,
      [part_number, part_name, description, category, manufacturer, unit_cost, quantity, total_cost, supplier, status, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    logAudit(req.user.email, 'UPDATE', 'bom_item', req.params.id, part_name, `Updated BOM item ${part_number}`);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Delete BOM item
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM bom_items WHERE id = $1 RETURNING *', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    logAudit(req.user.email, 'DELETE', 'bom_item', req.params.id, result.rows[0].part_name, `Deleted BOM item ${result.rows[0].part_number}`);
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/bom/:id/tree - Multi-level BOM tree using recursive CTE
router.get('/:id/tree', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      WITH RECURSIVE bom_tree AS (
        SELECT
          bi.id, bi.part_number, bi.part_name, bi.description, bi.category,
          bi.manufacturer, bi.supplier, bi.unit_cost, bi.quantity, bi.total_cost,
          bi.status, bi.parent_id, 0 as depth, ARRAY[bi.id] as path
        FROM bom_items bi
        WHERE bi.id = $1

        UNION ALL

        SELECT
          child.id, child.part_number, child.part_name, child.description, child.category,
          child.manufacturer, child.supplier, child.unit_cost, child.quantity, child.total_cost,
          child.status, child.parent_id, bt.depth + 1, bt.path || child.id
        FROM bom_items child
        JOIN bom_tree bt ON child.parent_id = bt.id
        WHERE NOT child.id = ANY(bt.path)
      )
      SELECT * FROM bom_tree ORDER BY depth, part_number
    `, [req.params.id]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'BOM item not found' });

    // Build nested tree structure
    const map = {};
    result.rows.forEach(row => { map[row.id] = { ...row, children: [] }; });

    let root = null;
    result.rows.forEach(row => {
      if (row.parent_id && map[row.parent_id]) {
        map[row.parent_id].children.push(map[row.id]);
      } else if (row.id === parseInt(req.params.id)) {
        root = map[row.id];
      }
    });

    res.json({ tree: root, total_nodes: result.rows.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

function aiRateLimit(req, res, next) {
  const limiter = req.app.get('aiRateLimiter');
  if (limiter) return limiter(req, res, next);
  next();
}

// AI: Optimize BOM costs — structured JSON + persist
router.post('/ai/optimize', auth, aiRateLimit, async (req, res) => {
  try {
    const items = await pool.query('SELECT * FROM bom_items ORDER BY total_cost DESC LIMIT 100');
    const totalCost = items.rows.reduce((sum, i) => sum + parseFloat(i.total_cost || 0), 0);

    const prompt = `Analyze this Bill of Materials and provide cost optimization recommendations. Respond ONLY in JSON format.

BOM Items (top by cost):
${JSON.stringify(items.rows.map(i => ({ part_number: i.part_number, part_name: i.part_name, category: i.category, unit_cost: i.unit_cost, quantity: i.quantity, total_cost: i.total_cost, supplier: i.supplier, manufacturer: i.manufacturer })), null, 2)}

Total BOM Cost: $${totalCost.toFixed(2)}

{
  "recommendations": [
    {
      "part_number": "...",
      "part_name": "...",
      "type": "alternative_part|supplier_consolidation|volume_pricing|design_change",
      "current_cost": 0.00,
      "estimated_savings_usd": 0.00,
      "estimated_savings_pct": 0.0,
      "action": "...",
      "priority": "high|medium|low",
      "implementation_effort": "low|medium|high"
    }
  ],
  "consolidated_opportunities": ["..."],
  "total_potential_savings_usd": 0.00,
  "total_potential_savings_pct": 0.0,
  "implementation_roadmap": ["..."],
  "quick_wins": ["..."],
  "long_term_strategies": ["..."]
}`;

    const systemPrompt = 'You are an expert manufacturing cost engineer specializing in BOM optimization and supply chain management. Always respond with valid JSON.';
    const rawAnalysis = await queryOpenRouter(prompt, systemPrompt);
    const data = parseAIJson(rawAnalysis);
    await persistAIResult(pool, {
      feature: 'bom-optimize-all',
      entity_type: 'bom_set',
      entity_id: null,
      user_email: req.user?.email,
      request_payload: { total_items: items.rows.length },
      response: data,
    });
    res.json({ success: true, data, total_items: items.rows.length, total_cost: totalCost.toFixed(2) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// AI: Optimize single item — structured JSON + persist
router.post('/ai/optimize/:id', auth, aiRateLimit, async (req, res) => {
  try {
    const item = await pool.query('SELECT * FROM bom_items WHERE id = $1', [req.params.id]);
    if (!item.rows[0]) return res.status(404).json({ error: 'Not found' });
    const i = item.rows[0];

    const prompt = `Provide detailed cost optimization analysis for this component. Respond ONLY in JSON format.

Component:
- Part: ${i.part_name} (${i.part_number})
- Manufacturer: ${i.manufacturer}
- Unit Cost: $${i.unit_cost}, Quantity: ${i.quantity}, Total: $${i.total_cost}
- Supplier: ${i.supplier}, Category: ${i.category}

{
  "current_cost_analysis": {"unit_cost": ${i.unit_cost}, "total_cost": ${i.total_cost}, "cost_tier": "premium|standard|economy"},
  "optimization_strategies": [
    {
      "strategy": "...",
      "type": "alternative_part|supplier_switch|volume_discount|design_change",
      "estimated_unit_cost_reduction": 0.00,
      "estimated_savings_pct": 0.0,
      "implementation_steps": ["..."],
      "risks": ["..."],
      "timeline_weeks": 4
    }
  ],
  "recommended_alternatives": [
    {"part_number": "...", "manufacturer": "...", "estimated_cost": 0.00, "compatibility": "drop-in|requires_validation"}
  ],
  "supplier_recommendations": ["..."],
  "total_potential_savings_usd": 0.00,
  "recommended_next_step": "..."
}`;

    const systemPrompt = 'You are an expert manufacturing cost engineer. Always respond with valid JSON.';
    const rawAnalysis = await queryOpenRouter(prompt, systemPrompt);
    const data = parseAIJson(rawAnalysis);
    const summaryText = JSON.stringify(data);
    await pool.query('UPDATE bom_items SET ai_optimization_notes = $1, updated_at = NOW() WHERE id = $2', [summaryText, req.params.id]);
    await persistAIResult(pool, {
      feature: 'bom-optimize-item',
      entity_type: 'bom_item',
      entity_id: parseInt(req.params.id),
      user_email: req.user?.email,
      request_payload: { bomItemId: req.params.id },
      response: data,
    });
    res.json({ success: true, data, item: i });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
