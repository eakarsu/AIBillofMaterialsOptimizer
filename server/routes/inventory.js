const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { queryOpenRouter } = require('../services/openrouter');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ir.*, bi.part_name, bi.part_number, bi.manufacturer, bi.category, bi.unit_cost
      FROM inventory_records ir
      JOIN bom_items bi ON ir.bom_item_id = bi.id
      ORDER BY ir.stock_status, ir.current_stock
    `);
    res.json(result.rows);
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

router.post('/', auth, async (req, res) => {
  try {
    const { bom_item_id, warehouse_location, current_stock, minimum_stock, reorder_point, reorder_quantity, max_stock, unit_of_measure, last_restock_date, next_restock_date, stock_status, holding_cost_per_unit } = req.body;
    const result = await pool.query(
      `INSERT INTO inventory_records (bom_item_id, warehouse_location, current_stock, minimum_stock, reorder_point, reorder_quantity, max_stock, unit_of_measure, last_restock_date, next_restock_date, stock_status, holding_cost_per_unit)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [bom_item_id, warehouse_location, current_stock, minimum_stock, reorder_point, reorder_quantity, max_stock, unit_of_measure || 'pcs', last_restock_date, next_restock_date, stock_status || 'in_stock', holding_cost_per_unit]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { bom_item_id, warehouse_location, current_stock, minimum_stock, reorder_point, reorder_quantity, max_stock, unit_of_measure, last_restock_date, next_restock_date, stock_status, holding_cost_per_unit } = req.body;
    const result = await pool.query(
      `UPDATE inventory_records SET bom_item_id=$1, warehouse_location=$2, current_stock=$3, minimum_stock=$4, reorder_point=$5, reorder_quantity=$6, max_stock=$7, unit_of_measure=$8, last_restock_date=$9, next_restock_date=$10, stock_status=$11, holding_cost_per_unit=$12, updated_at=NOW()
       WHERE id=$13 RETURNING *`,
      [bom_item_id, warehouse_location, current_stock, minimum_stock, reorder_point, reorder_quantity, max_stock, unit_of_measure, last_restock_date, next_restock_date, stock_status, holding_cost_per_unit, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM inventory_records WHERE id = $1 RETURNING *', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/optimize/:id', auth, async (req, res) => {
  try {
    const r = (await pool.query(`
      SELECT ir.*, bi.part_name, bi.part_number, bi.unit_cost, bi.quantity as required_quantity, bi.manufacturer
      FROM inventory_records ir JOIN bom_items bi ON ir.bom_item_id = bi.id WHERE ir.id = $1
    `, [req.params.id])).rows[0];
    if (!r) return res.status(404).json({ error: 'Not found' });
    const prompt = `Optimize inventory levels for this component:
- Part: ${r.part_name} (${r.part_number}), Manufacturer: ${r.manufacturer}
- Unit Cost: $${r.unit_cost}, Required Qty: ${r.required_quantity}
- Current Stock: ${r.current_stock}, Min Stock: ${r.minimum_stock}, Max Stock: ${r.max_stock}
- Reorder Point: ${r.reorder_point}, Reorder Qty: ${r.reorder_quantity}
- Warehouse: ${r.warehouse_location}, Holding Cost: $${r.holding_cost_per_unit}/unit
- Stock Status: ${r.stock_status}

Provide: 1) Optimal reorder point using EOQ model 2) Safety stock recommendations 3) Holding cost optimization 4) JIT feasibility 5) Demand forecasting suggestions 6) Total cost of ownership analysis.`;
    const analysis = await queryOpenRouter(prompt, 'You are an inventory management expert specializing in electronic component supply chains, with expertise in EOQ, JIT, and lean manufacturing.');
    res.json({ analysis, record: r });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
