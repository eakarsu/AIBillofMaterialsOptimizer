const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

// Dashboard statistics
router.get('/dashboard-stats', auth, async (req, res) => {
  try {
    const [bomResult, supplierResult, inventoryResult, riskResult, complianceResult] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) as total_items,
          COALESCE(SUM(total_cost), 0) as total_bom_cost,
          COALESCE(AVG(unit_cost), 0) as avg_unit_cost,
          COALESCE(MAX(total_cost), 0) as highest_item_cost,
          COUNT(DISTINCT category) as category_count,
          COUNT(DISTINCT supplier) as supplier_count,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count,
          COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_count,
          COUNT(CASE WHEN status = 'discontinued' THEN 1 END) as discontinued_count
        FROM bom_items
      `),
      pool.query(`
        SELECT
          COUNT(*) as total_suppliers,
          COALESCE(AVG(rating), 0) as avg_rating,
          COALESCE(AVG(quality_score), 0) as avg_quality,
          COALESCE(AVG(delivery_score), 0) as avg_delivery,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_suppliers
        FROM suppliers
      `),
      pool.query(`
        SELECT
          COALESCE(SUM(current_stock), 0) as total_stock,
          COUNT(CASE WHEN current_stock <= reorder_point AND current_stock > 0 THEN 1 END) as low_stock_count,
          COUNT(CASE WHEN current_stock = 0 THEN 1 END) as out_of_stock_count
        FROM inventory_records
      `),
      pool.query(`
        SELECT
          COUNT(*) as total_risks,
          COUNT(CASE WHEN risk_score >= 7 THEN 1 END) as high_risks,
          COUNT(CASE WHEN risk_score >= 4 AND risk_score < 7 THEN 1 END) as medium_risks,
          COUNT(CASE WHEN single_source_risk = true THEN 1 END) as single_source_count
        FROM risk_assessments
      `),
      pool.query(`
        SELECT
          COUNT(*) as total_records,
          COUNT(CASE WHEN compliance_status = 'compliant' THEN 1 END) as compliant_count,
          COUNT(CASE WHEN compliance_status = 'non-compliant' THEN 1 END) as non_compliant_count,
          COUNT(CASE WHEN rohs_compliant = true THEN 1 END) as rohs_count,
          COUNT(CASE WHEN reach_compliant = true THEN 1 END) as reach_count
        FROM compliance_records
      `)
    ]);

    res.json({
      bom: bomResult.rows[0],
      suppliers: supplierResult.rows[0],
      inventory: inventoryResult.rows[0],
      risks: riskResult.rows[0],
      compliance: complianceResult.rows[0]
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Cost breakdown by category
router.get('/cost-by-category', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COALESCE(category, 'Uncategorized') as category,
        COUNT(*) as item_count,
        COALESCE(SUM(total_cost), 0) as total_cost,
        COALESCE(AVG(unit_cost), 0) as avg_unit_cost
      FROM bom_items
      GROUP BY category
      ORDER BY total_cost DESC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Cost breakdown by supplier
router.get('/cost-by-supplier', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COALESCE(supplier, 'Unknown') as supplier,
        COUNT(*) as item_count,
        COALESCE(SUM(total_cost), 0) as total_cost,
        COALESCE(AVG(unit_cost), 0) as avg_unit_cost,
        COALESCE(SUM(quantity), 0) as total_quantity
      FROM bom_items
      GROUP BY supplier
      ORDER BY total_cost DESC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Top 10 most expensive items
router.get('/top-cost-items', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT part_number, part_name, category, supplier, unit_cost, quantity, total_cost
      FROM bom_items
      ORDER BY total_cost DESC
      LIMIT 10
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Cost-down savings summary
router.get('/savings-summary', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        implementation_status,
        COUNT(*) as count,
        COALESCE(SUM(savings_amount), 0) as total_savings,
        COALESCE(AVG(savings_percent), 0) as avg_savings_percent
      FROM cost_down_analyses
      GROUP BY implementation_status
      ORDER BY total_savings DESC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Inventory value report
router.get('/inventory-value', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        bi.part_number, bi.part_name, bi.unit_cost,
        ir.current_stock, ir.warehouse_location, ir.stock_status,
        (bi.unit_cost * ir.current_stock) as stock_value
      FROM inventory_records ir
      JOIN bom_items bi ON ir.bom_item_id = bi.id
      ORDER BY stock_value DESC
    `);
    const totalValue = result.rows.reduce((sum, r) => sum + parseFloat(r.stock_value || 0), 0);
    res.json({ items: result.rows, total_value: totalValue });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
