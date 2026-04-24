const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { queryOpenRouter } = require('../services/openrouter');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ra.*, bi.part_name, bi.part_number, bi.manufacturer, bi.category
      FROM risk_assessments ra
      JOIN bom_items bi ON ra.bom_item_id = bi.id
      ORDER BY ra.risk_score DESC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ra.*, bi.part_name, bi.part_number, bi.manufacturer, bi.category, bi.unit_cost, bi.quantity, bi.supplier
      FROM risk_assessments ra
      JOIN bom_items bi ON ra.bom_item_id = bi.id
      WHERE ra.id = $1
    `, [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { bom_item_id, risk_category, risk_score, probability, impact, supply_chain_risk, geopolitical_risk, single_source_risk, mitigation_plan, contingency_plan, risk_owner, review_date } = req.body;
    const result = await pool.query(
      `INSERT INTO risk_assessments (bom_item_id, risk_category, risk_score, probability, impact, supply_chain_risk, geopolitical_risk, single_source_risk, mitigation_plan, contingency_plan, risk_owner, review_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [bom_item_id, risk_category, risk_score, probability, impact, supply_chain_risk, geopolitical_risk, single_source_risk, mitigation_plan, contingency_plan, risk_owner, review_date]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { bom_item_id, risk_category, risk_score, probability, impact, supply_chain_risk, geopolitical_risk, single_source_risk, mitigation_plan, contingency_plan, risk_owner, review_date } = req.body;
    const result = await pool.query(
      `UPDATE risk_assessments SET bom_item_id=$1, risk_category=$2, risk_score=$3, probability=$4, impact=$5, supply_chain_risk=$6, geopolitical_risk=$7, single_source_risk=$8, mitigation_plan=$9, contingency_plan=$10, risk_owner=$11, review_date=$12, updated_at=NOW()
       WHERE id=$13 RETURNING *`,
      [bom_item_id, risk_category, risk_score, probability, impact, supply_chain_risk, geopolitical_risk, single_source_risk, mitigation_plan, contingency_plan, risk_owner, review_date, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM risk_assessments WHERE id = $1 RETURNING *', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/analyze/:bomItemId', auth, async (req, res) => {
  try {
    const item = (await pool.query('SELECT * FROM bom_items WHERE id = $1', [req.params.bomItemId])).rows[0];
    if (!item) return res.status(404).json({ error: 'BOM item not found' });
    const existing = await pool.query('SELECT * FROM risk_assessments WHERE bom_item_id = $1', [req.params.bomItemId]);
    const prompt = `Perform comprehensive risk assessment for this component:
- Part: ${item.part_name} (${item.part_number})
- Manufacturer: ${item.manufacturer}, Country of origin context
- Unit Cost: $${item.unit_cost}, Quantity: ${item.quantity}
- Supplier: ${item.supplier}
- Category: ${item.category}

Existing risk records: ${existing.rows.length > 0 ? existing.rows.map(r => `${r.risk_category}: Score ${r.risk_score}, ${r.probability} prob / ${r.impact} impact`).join('; ') : 'None'}

Analyze: 1) Supply chain disruption risk 2) Geopolitical risk (tariffs, sanctions, trade wars) 3) Single-source dependency risk 4) Natural disaster vulnerability 5) Quality/reliability risk 6) Price volatility risk 7) Technology obsolescence risk 8) Overall risk score (0-100) with justification 9) Detailed mitigation and contingency plans.`;
    const analysis = await queryOpenRouter(prompt, 'You are a supply chain risk management expert with deep knowledge of geopolitical factors, component market dynamics, and manufacturing risk mitigation strategies.');
    res.json({ analysis, item, existing_risks: existing.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
