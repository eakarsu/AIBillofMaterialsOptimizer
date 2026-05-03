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

// GET /api/reports/cost-analysis - BOM cost breakdown by category, supplier, part type
router.get('/cost-analysis', auth, async (req, res) => {
  try {
    const [byCategory, bySupplier, byPartType, totals] = await Promise.all([
      pool.query(`
        SELECT
          COALESCE(category, 'Uncategorized') as category,
          COUNT(*) as item_count,
          COALESCE(SUM(total_cost), 0) as total_cost,
          COALESCE(AVG(unit_cost), 0) as avg_unit_cost,
          COALESCE(SUM(quantity), 0) as total_quantity,
          ROUND((SUM(total_cost) / NULLIF((SELECT SUM(total_cost) FROM bom_items), 0) * 100)::numeric, 2) as cost_pct
        FROM bom_items
        GROUP BY category
        ORDER BY total_cost DESC
      `),
      pool.query(`
        SELECT
          COALESCE(supplier, 'Unknown') as supplier,
          COUNT(*) as item_count,
          COALESCE(SUM(total_cost), 0) as total_cost,
          COALESCE(AVG(unit_cost), 0) as avg_unit_cost,
          ROUND((SUM(total_cost) / NULLIF((SELECT SUM(total_cost) FROM bom_items), 0) * 100)::numeric, 2) as cost_pct
        FROM bom_items
        GROUP BY supplier
        ORDER BY total_cost DESC
      `),
      pool.query(`
        SELECT
          COALESCE(manufacturer, 'Unknown') as manufacturer,
          COUNT(*) as item_count,
          COALESCE(SUM(total_cost), 0) as total_cost,
          COALESCE(AVG(unit_cost), 0) as avg_unit_cost
        FROM bom_items
        GROUP BY manufacturer
        ORDER BY total_cost DESC
        LIMIT 15
      `),
      pool.query(`
        SELECT
          COUNT(*) as total_items,
          COALESCE(SUM(total_cost), 0) as grand_total_cost,
          COALESCE(AVG(unit_cost), 0) as avg_unit_cost,
          COALESCE(MAX(total_cost), 0) as highest_item_cost,
          COALESCE(MIN(unit_cost), 0) as lowest_unit_cost
        FROM bom_items
      `)
    ]);
    res.json({
      by_category: byCategory.rows,
      by_supplier: bySupplier.rows,
      by_manufacturer: byPartType.rows,
      totals: totals.rows[0]
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reports/risk-summary - high-risk components
router.get('/risk-summary', auth, async (req, res) => {
  try {
    const [singleSource, longLeadTime, obsolete, highRiskScores] = await Promise.all([
      pool.query(`
        SELECT bi.part_number, bi.part_name, bi.manufacturer, bi.supplier, bi.unit_cost,
               bi.quantity, bi.total_cost, ra.risk_score, ra.risk_category, ra.mitigation_plan
        FROM bom_items bi
        JOIN risk_assessments ra ON ra.bom_item_id = bi.id
        WHERE ra.single_source_risk = true
        ORDER BY bi.total_cost DESC
      `),
      pool.query(`
        SELECT bi.part_number, bi.part_name, bi.manufacturer, bi.supplier,
               lt.current_lead_time_days, lt.standard_lead_time_days, lt.trend, lt.reliability_score
        FROM bom_items bi
        JOIN lead_time_records lt ON lt.bom_item_id = bi.id
        WHERE lt.current_lead_time_days > 60
        ORDER BY lt.current_lead_time_days DESC
      `),
      pool.query(`
        SELECT bi.part_number, bi.part_name, bi.manufacturer, bi.supplier,
               bi.unit_cost, bi.quantity, bi.total_cost, bi.status
        FROM bom_items bi
        WHERE bi.status IN ('discontinued', 'inactive')
        ORDER BY bi.total_cost DESC
      `),
      pool.query(`
        SELECT bi.part_number, bi.part_name, bi.manufacturer, bi.supplier,
               bi.total_cost, ra.risk_score, ra.risk_category, ra.probability, ra.impact,
               ra.supply_chain_risk, ra.geopolitical_risk, ra.single_source_risk
        FROM risk_assessments ra
        JOIN bom_items bi ON ra.bom_item_id = bi.id
        WHERE ra.risk_score >= 7
        ORDER BY ra.risk_score DESC
      `)
    ]);
    res.json({
      single_source_risks: singleSource.rows,
      long_lead_time_components: longLeadTime.rows,
      obsolete_or_discontinued: obsolete.rows,
      high_risk_scores: highRiskScores.rows,
      summary: {
        single_source_count: singleSource.rows.length,
        long_lead_time_count: longLeadTime.rows.length,
        obsolete_count: obsolete.rows.length,
        high_risk_count: highRiskScores.rows.length
      }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reports/savings-opportunities - compare OEM vs alternative pricing
router.get('/savings-opportunities', auth, async (req, res) => {
  try {
    const [costDownOps, altParts, savingsSummary] = await Promise.all([
      pool.query(`
        SELECT
          cd.id, cd.analysis_type, cd.current_cost, cd.target_cost,
          cd.savings_amount, cd.savings_percent, cd.implementation_status,
          cd.priority, bi.part_number, bi.part_name, bi.manufacturer, bi.supplier,
          bi.category
        FROM cost_down_analyses cd
        JOIN bom_items bi ON cd.bom_item_id = bi.id
        WHERE cd.savings_amount > 0
        ORDER BY cd.savings_amount DESC
      `),
      pool.query(`
        SELECT
          ap.alt_part_number, ap.alt_manufacturer,
          ap.alt_supplier, ap.alt_unit_cost,
          ap.notes as alt_notes,
          bi.part_number as oem_part_number, bi.part_name, bi.manufacturer as oem_manufacturer,
          bi.unit_cost as oem_unit_cost, bi.quantity,
          (bi.unit_cost - ap.alt_unit_cost) as unit_savings,
          ((bi.unit_cost - ap.alt_unit_cost) * bi.quantity) as total_potential_savings
        FROM alternative_parts ap
        JOIN bom_items bi ON ap.original_part_id = bi.id
        WHERE ap.alt_unit_cost < bi.unit_cost
        ORDER BY total_potential_savings DESC
        LIMIT 20
      `),
      pool.query(`
        SELECT
          implementation_status,
          COUNT(*) as count,
          COALESCE(SUM(savings_amount), 0) as total_savings,
          COALESCE(AVG(savings_percent), 0) as avg_savings_percent
        FROM cost_down_analyses
        WHERE savings_amount > 0
        GROUP BY implementation_status
        ORDER BY total_savings DESC
      `)
    ]);

    const totalPotentialSavings = altParts.rows.reduce((sum, r) => sum + parseFloat(r.total_potential_savings || 0), 0);
    const totalIdentifiedSavings = costDownOps.rows.reduce((sum, r) => sum + parseFloat(r.savings_amount || 0), 0);

    res.json({
      cost_down_opportunities: costDownOps.rows,
      alternative_part_savings: altParts.rows,
      savings_by_status: savingsSummary.rows,
      totals: {
        total_potential_savings_from_alternatives: totalPotentialSavings.toFixed(2),
        total_identified_savings: totalIdentifiedSavings.toFixed(2),
        combined_savings_opportunity: (totalPotentialSavings + totalIdentifiedSavings).toFixed(2)
      }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reports/optimization-summary
router.get('/optimization-summary', auth, async (req, res) => {
  try {
    const [costDownResult, riskResult, complianceResult, inventoryResult] = await Promise.all([
      pool.query(`
        SELECT
          COALESCE(SUM(CASE WHEN implementation_status = 'implemented' THEN savings_amount ELSE 0 END), 0) as realized_savings,
          COALESCE(SUM(CASE WHEN implementation_status != 'implemented' THEN savings_amount ELSE 0 END), 0) as potential_savings,
          COALESCE(SUM(savings_amount), 0) as total_identified_savings,
          COUNT(*) as total_opportunities,
          COUNT(CASE WHEN implementation_status = 'implemented' THEN 1 END) as implemented_count,
          COUNT(CASE WHEN implementation_status = 'in_progress' THEN 1 END) as in_progress_count,
          COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority_count,
          COALESCE(AVG(savings_percent), 0) as avg_savings_percent
        FROM cost_down_analyses
      `),
      pool.query(`
        SELECT
          COUNT(*) as total_risks,
          COUNT(CASE WHEN risk_score >= 7 THEN 1 END) as high_risk_count,
          COUNT(CASE WHEN risk_score >= 4 AND risk_score < 7 THEN 1 END) as medium_risk_count,
          COUNT(CASE WHEN risk_score < 4 THEN 1 END) as low_risk_count,
          COUNT(CASE WHEN single_source_risk = true THEN 1 END) as single_source_count,
          COUNT(CASE WHEN supply_chain_risk = true THEN 1 END) as supply_chain_risk_count,
          COUNT(CASE WHEN geopolitical_risk = true THEN 1 END) as geopolitical_risk_count,
          COALESCE(AVG(risk_score), 0) as avg_risk_score
        FROM risk_assessments
      `),
      pool.query(`
        SELECT
          COUNT(*) as total_records,
          COUNT(CASE WHEN compliance_status = 'compliant' THEN 1 END) as compliant_count,
          COUNT(CASE WHEN compliance_status = 'non-compliant' THEN 1 END) as non_compliant_count,
          COUNT(CASE WHEN rohs_compliant = true THEN 1 END) as rohs_compliant_count,
          COUNT(CASE WHEN reach_compliant = true THEN 1 END) as reach_compliant_count,
          ROUND(
            (COUNT(CASE WHEN compliance_status = 'compliant' THEN 1 END)::numeric / NULLIF(COUNT(*), 0)) * 100, 2
          ) as compliance_rate_pct
        FROM compliance_records
      `),
      pool.query(`
        SELECT
          COUNT(CASE WHEN current_stock = 0 THEN 1 END) as out_of_stock_count,
          COUNT(CASE WHEN current_stock > 0 AND current_stock <= reorder_point THEN 1 END) as low_stock_count,
          COUNT(CASE WHEN current_stock > max_stock THEN 1 END) as overstock_count,
          COALESCE(SUM(current_stock), 0) as total_units_in_stock
        FROM inventory_records
      `)
    ]);

    res.json({
      cost_savings: costDownResult.rows[0],
      risk_levels: riskResult.rows[0],
      compliance_status: complianceResult.rows[0],
      inventory_health: inventoryResult.rows[0],
      generated_at: new Date().toISOString()
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reports/supplier-performance
router.get('/supplier-performance', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        s.id,
        s.name,
        s.country,
        s.category,
        s.status,
        s.quality_score,
        s.delivery_score,
        s.price_score,
        s.total_orders,
        s.on_time_delivery_percent,
        s.rating,
        ROUND(
          (COALESCE(s.quality_score, 0) * 0.40 +
           COALESCE(s.delivery_score, 0) * 0.35 +
           COALESCE(s.price_score, 0) * 0.25)::numeric, 2
        ) as composite_score,
        COUNT(bi.id) as bom_items_supplied,
        COALESCE(SUM(bi.total_cost), 0) as total_spend
      FROM suppliers s
      LEFT JOIN bom_items bi ON bi.supplier = s.name
      WHERE s.status = 'active'
      GROUP BY s.id, s.name, s.country, s.category, s.status,
               s.quality_score, s.delivery_score, s.price_score,
               s.total_orders, s.on_time_delivery_percent, s.rating
      ORDER BY composite_score DESC
    `);

    const rows = result.rows;
    // Rank suppliers
    rows.forEach((row, idx) => { row.rank = idx + 1; });

    const summary = {
      total_active_suppliers: rows.length,
      avg_composite_score: rows.length > 0
        ? (rows.reduce((s, r) => s + parseFloat(r.composite_score || 0), 0) / rows.length).toFixed(2)
        : '0.00',
      top_performers: rows.slice(0, 3).map(r => r.name),
      underperformers: rows.filter(r => parseFloat(r.composite_score) < 60).map(r => r.name)
    };

    res.json({ suppliers: rows, summary, generated_at: new Date().toISOString() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reports/compliance-expiry — certifications expiring in the next N days (NEW feature)
router.get('/compliance-expiry', auth, async (req, res) => {
  try {
    const days = Math.min(365, Math.max(1, parseInt(req.query.days) || 90));
    const result = await pool.query(`
      SELECT
        cr.id, cr.regulation_type, cr.compliance_status, cr.certificate_number,
        cr.expiry_date, cr.testing_lab, cr.rohs_compliant, cr.reach_compliant,
        bi.part_number, bi.part_name, bi.manufacturer, bi.supplier, bi.category,
        (cr.expiry_date - CURRENT_DATE) as days_until_expiry,
        CASE
          WHEN cr.expiry_date < CURRENT_DATE THEN 'expired'
          WHEN cr.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'critical'
          WHEN cr.expiry_date <= CURRENT_DATE + INTERVAL '60 days' THEN 'warning'
          ELSE 'monitor'
        END as urgency
      FROM compliance_records cr
      JOIN bom_items bi ON cr.bom_item_id = bi.id
      WHERE cr.expiry_date IS NOT NULL
        AND cr.expiry_date <= CURRENT_DATE + ($1 || ' days')::INTERVAL
      ORDER BY cr.expiry_date ASC
    `, [days]);

    res.json({
      data: result.rows,
      summary: {
        total: result.rows.length,
        expired: result.rows.filter(r => r.urgency === 'expired').length,
        critical: result.rows.filter(r => r.urgency === 'critical').length,
        warning: result.rows.filter(r => r.urgency === 'warning').length,
        monitor: result.rows.filter(r => r.urgency === 'monitor').length,
        lookback_days: days,
      },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
