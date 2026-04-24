const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { queryOpenRouter } = require('../services/openrouter');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT cd.*, bi.part_name, bi.part_number, bi.manufacturer, bi.category
      FROM cost_down_analyses cd
      JOIN bom_items bi ON cd.bom_item_id = bi.id
      ORDER BY cd.savings_amount DESC NULLS LAST
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT cd.*, bi.part_name, bi.part_number, bi.manufacturer, bi.category, bi.unit_cost, bi.quantity, bi.supplier
      FROM cost_down_analyses cd
      JOIN bom_items bi ON cd.bom_item_id = bi.id
      WHERE cd.id = $1
    `, [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { bom_item_id, analysis_type, current_cost, target_cost, achieved_cost, savings_amount, savings_percent, strategy, implementation_status, priority } = req.body;
    const result = await pool.query(
      `INSERT INTO cost_down_analyses (bom_item_id, analysis_type, current_cost, target_cost, achieved_cost, savings_amount, savings_percent, strategy, implementation_status, priority)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [bom_item_id, analysis_type, current_cost, target_cost, achieved_cost, savings_amount, savings_percent, strategy, implementation_status || 'proposed', priority || 'medium']
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { bom_item_id, analysis_type, current_cost, target_cost, achieved_cost, savings_amount, savings_percent, strategy, implementation_status, priority } = req.body;
    const result = await pool.query(
      `UPDATE cost_down_analyses SET bom_item_id=$1, analysis_type=$2, current_cost=$3, target_cost=$4, achieved_cost=$5, savings_amount=$6, savings_percent=$7, strategy=$8, implementation_status=$9, priority=$10, updated_at=NOW()
       WHERE id=$11 RETURNING *`,
      [bom_item_id, analysis_type, current_cost, target_cost, achieved_cost, savings_amount, savings_percent, strategy, implementation_status, priority, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM cost_down_analyses WHERE id = $1 RETURNING *', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// AI: Generate cost-down analysis
router.post('/ai/analyze/:bomItemId', auth, async (req, res) => {
  try {
    const item = await pool.query('SELECT * FROM bom_items WHERE id = $1', [req.params.bomItemId]);
    if (!item.rows[0]) return res.status(404).json({ error: 'BOM item not found' });
    const existingAnalyses = await pool.query('SELECT * FROM cost_down_analyses WHERE bom_item_id = $1', [req.params.bomItemId]);
    const i = item.rows[0];
    const prompt = `Perform a comprehensive cost-down analysis for this component:
- Part: ${i.part_name} (${i.part_number})
- Manufacturer: ${i.manufacturer}
- Unit Cost: $${i.unit_cost}, Quantity: ${i.quantity}, Total: $${i.total_cost}
- Supplier: ${i.supplier}
- Category: ${i.category}

Existing analyses: ${existingAnalyses.rows.length > 0 ? existingAnalyses.rows.map(a => `${a.analysis_type}: ${a.strategy} (${a.implementation_status})`).join('; ') : 'None'}

Provide:
1. Multiple cost reduction strategies with estimated savings
2. Quick wins vs long-term strategies
3. Risk assessment for each approach
4. Implementation roadmap
5. Expected ROI timeline
6. Total potential savings across all strategies`;

    const systemPrompt = 'You are a manufacturing cost reduction specialist with expertise in value engineering, supplier negotiations, and design-for-cost methodologies.';
    const analysis = await queryOpenRouter(prompt, systemPrompt);
    res.json({ analysis, item: i, existing_analyses: existingAnalyses.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
