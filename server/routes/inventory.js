const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const auth = require('../middleware/auth');
const { queryOpenRouter, parseAIJson, persistAIResult } = require('../services/openrouter');
const { logAudit } = require('../middleware/auditLog');
const router = express.Router();

const inventoryValidation = [
  body('bom_item_id').isInt({ min: 1 }).withMessage('bom_item_id must be a positive integer'),
  body('current_stock').isInt({ min: 0 }).withMessage('current_stock must be a non-negative integer'),
  body('minimum_stock').optional({ checkFalsy: true }).isInt({ min: 0 }),
  body('reorder_point').optional({ checkFalsy: true }).isInt({ min: 0 }),
  body('reorder_quantity').optional({ checkFalsy: true }).isInt({ min: 0 }),
  body('max_stock').optional({ checkFalsy: true }).isInt({ min: 0 }),
  body('holding_cost_per_unit').optional({ checkFalsy: true }).isFloat({ min: 0 }),
  body('stock_status').optional({ checkFalsy: true }).isIn(['in_stock', 'low_stock', 'out_of_stock', 'overstock']),
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

// GET /api/inventory/reorder-alerts — parts breaching reorder point (NEW feature)
router.get('/reorder-alerts', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        ir.id, ir.current_stock, ir.minimum_stock, ir.reorder_point, ir.reorder_quantity,
        ir.max_stock, ir.warehouse_location, ir.stock_status,
        bi.part_number, bi.part_name, bi.manufacturer, bi.supplier, bi.unit_cost,
        (ir.reorder_quantity * bi.unit_cost) as reorder_cost,
        CASE
          WHEN ir.current_stock = 0 THEN 'critical'
          WHEN ir.current_stock <= ir.minimum_stock THEN 'high'
          ELSE 'medium'
        END as alert_level
      FROM inventory_records ir
      JOIN bom_items bi ON ir.bom_item_id = bi.id
      WHERE ir.current_stock <= ir.reorder_point
      ORDER BY
        CASE WHEN ir.current_stock = 0 THEN 0 WHEN ir.current_stock <= ir.minimum_stock THEN 1 ELSE 2 END,
        bi.unit_cost DESC
    `);

    const totalReorderCost = result.rows.reduce((s, r) => s + parseFloat(r.reorder_cost || 0), 0);
    res.json({
      data: result.rows,
      summary: {
        total_alerts: result.rows.length,
        critical_count: result.rows.filter(r => r.alert_level === 'critical').length,
        high_count: result.rows.filter(r => r.alert_level === 'high').length,
        total_reorder_cost: totalReorderCost.toFixed(2),
      },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/', auth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const { stock_status, warehouse_location } = req.query;

    const conditions = [];
    const params = [];
    if (stock_status) { params.push(stock_status); conditions.push(`ir.stock_status = $${params.length}`); }
    if (warehouse_location) { params.push(`%${warehouse_location}%`); conditions.push(`ir.warehouse_location ILIKE $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(`SELECT COUNT(*) FROM inventory_records ir ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(limit, offset);
    const result = await pool.query(`
      SELECT ir.*, bi.part_name, bi.part_number, bi.manufacturer, bi.category, bi.unit_cost
      FROM inventory_records ir
      JOIN bom_items bi ON ir.bom_item_id = bi.id
      ${where}
      ORDER BY ir.stock_status, ir.current_stock
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
      SELECT ir.*, bi.part_name, bi.part_number, bi.manufacturer, bi.category, bi.unit_cost, bi.quantity as required_quantity, bi.supplier
      FROM inventory_records ir
      JOIN bom_items bi ON ir.bom_item_id = bi.id
      WHERE ir.id = $1
    `, [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, inventoryValidation, validate, async (req, res) => {
  try {
    const { bom_item_id, warehouse_location, current_stock, minimum_stock, reorder_point, reorder_quantity, max_stock, unit_of_measure, last_restock_date, next_restock_date, stock_status, holding_cost_per_unit } = req.body;
    const result = await pool.query(
      `INSERT INTO inventory_records (bom_item_id, warehouse_location, current_stock, minimum_stock, reorder_point, reorder_quantity, max_stock, unit_of_measure, last_restock_date, next_restock_date, stock_status, holding_cost_per_unit)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [bom_item_id, warehouse_location, current_stock, minimum_stock, reorder_point, reorder_quantity, max_stock, unit_of_measure || 'pcs', last_restock_date, next_restock_date, stock_status || 'in_stock', holding_cost_per_unit]
    );
    logAudit(req.user.email, 'CREATE', 'inventory_record', result.rows[0].id, `BOM Item ${bom_item_id}`, `Created inventory record, stock: ${current_stock}`);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, inventoryValidation, validate, async (req, res) => {
  try {
    const { bom_item_id, warehouse_location, current_stock, minimum_stock, reorder_point, reorder_quantity, max_stock, unit_of_measure, last_restock_date, next_restock_date, stock_status, holding_cost_per_unit } = req.body;
    const result = await pool.query(
      `UPDATE inventory_records SET bom_item_id=$1, warehouse_location=$2, current_stock=$3, minimum_stock=$4, reorder_point=$5, reorder_quantity=$6, max_stock=$7, unit_of_measure=$8, last_restock_date=$9, next_restock_date=$10, stock_status=$11, holding_cost_per_unit=$12, updated_at=NOW()
       WHERE id=$13 RETURNING *`,
      [bom_item_id, warehouse_location, current_stock, minimum_stock, reorder_point, reorder_quantity, max_stock, unit_of_measure, last_restock_date, next_restock_date, stock_status, holding_cost_per_unit, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    logAudit(req.user.email, 'UPDATE', 'inventory_record', req.params.id, `BOM Item ${bom_item_id}`, `Updated inventory, stock: ${current_stock}`);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM inventory_records WHERE id = $1 RETURNING *', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    logAudit(req.user.email, 'DELETE', 'inventory_record', req.params.id, `BOM Item ${result.rows[0].bom_item_id}`, `Deleted inventory record`);
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// AI: Optimize inventory — structured JSON + persist
router.post('/ai/optimize/:id', auth, aiRateLimit, async (req, res) => {
  try {
    const r = (await pool.query(`
      SELECT ir.*, bi.part_name, bi.part_number, bi.unit_cost, bi.quantity as required_quantity, bi.manufacturer, bi.supplier
      FROM inventory_records ir JOIN bom_items bi ON ir.bom_item_id = bi.id WHERE ir.id = $1
    `, [req.params.id])).rows[0];
    if (!r) return res.status(404).json({ error: 'Not found' });

    const prompt = `Optimize inventory levels for this component. Respond ONLY in JSON format.

Component:
- Part: ${r.part_name} (${r.part_number}), Manufacturer: ${r.manufacturer}
- Unit Cost: $${r.unit_cost}, Required Qty: ${r.required_quantity}
- Current Stock: ${r.current_stock}, Min Stock: ${r.minimum_stock}, Max Stock: ${r.max_stock}
- Reorder Point: ${r.reorder_point}, Reorder Qty: ${r.reorder_quantity}
- Holding Cost: $${r.holding_cost_per_unit}/unit, Warehouse: ${r.warehouse_location}

{
  "eoq_analysis": {
    "optimal_reorder_quantity": 0,
    "optimal_reorder_point": 0,
    "safety_stock_recommended": 0,
    "annual_holding_cost": 0.00,
    "annual_ordering_cost": 0.00,
    "total_annual_cost": 0.00
  },
  "recommendations": [
    {"type": "reorder_point|safety_stock|jit|buffer", "current_value": 0, "recommended_value": 0, "rationale": "...", "savings_impact": "..."}
  ],
  "jit_feasibility": "feasible|partial|not_recommended",
  "jit_rationale": "...",
  "holding_cost_optimization": "...",
  "demand_forecast": "...",
  "tco_summary": "..."
}`;

    const systemPrompt = 'You are an inventory management expert specializing in electronic component supply chains, with expertise in EOQ, JIT, and lean manufacturing. Always respond with valid JSON.';
    const rawAnalysis = await queryOpenRouter(prompt, systemPrompt);
    const data = parseAIJson(rawAnalysis);
    await persistAIResult(pool, {
      feature: 'inventory-optimize',
      entity_type: 'inventory_record',
      entity_id: parseInt(req.params.id),
      user_email: req.user?.email,
      request_payload: { inventoryId: req.params.id },
      response: data,
    });
    res.json({ success: true, data, record: r });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
