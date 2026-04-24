const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { queryOpenRouter } = require('../services/openrouter');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT op.*, bi.part_name, bi.part_number, bi.manufacturer, bi.category
      FROM obsolescence_predictions op
      JOIN bom_items bi ON op.bom_item_id = bi.id
      ORDER BY
        CASE op.risk_level WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
        op.predicted_eol_date
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT op.*, bi.part_name, bi.part_number, bi.manufacturer, bi.category, bi.unit_cost, bi.quantity, bi.supplier
      FROM obsolescence_predictions op
      JOIN bom_items bi ON op.bom_item_id = bi.id
      WHERE op.id = $1
    `, [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { bom_item_id, risk_level, predicted_eol_date, confidence_score, lifecycle_stage, last_buy_date, recommended_action, mitigation_strategy } = req.body;
    const result = await pool.query(
      `INSERT INTO obsolescence_predictions (bom_item_id, risk_level, predicted_eol_date, confidence_score, lifecycle_stage, last_buy_date, recommended_action, mitigation_strategy)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [bom_item_id, risk_level, predicted_eol_date, confidence_score, lifecycle_stage, last_buy_date, recommended_action, mitigation_strategy]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { bom_item_id, risk_level, predicted_eol_date, confidence_score, lifecycle_stage, last_buy_date, recommended_action, mitigation_strategy } = req.body;
    const result = await pool.query(
      `UPDATE obsolescence_predictions SET bom_item_id=$1, risk_level=$2, predicted_eol_date=$3, confidence_score=$4, lifecycle_stage=$5, last_buy_date=$6, recommended_action=$7, mitigation_strategy=$8, updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [bom_item_id, risk_level, predicted_eol_date, confidence_score, lifecycle_stage, last_buy_date, recommended_action, mitigation_strategy, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM obsolescence_predictions WHERE id = $1 RETURNING *', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// AI: Predict obsolescence
router.post('/ai/predict/:bomItemId', auth, async (req, res) => {
  try {
    const item = await pool.query('SELECT * FROM bom_items WHERE id = $1', [req.params.bomItemId]);
    if (!item.rows[0]) return res.status(404).json({ error: 'BOM item not found' });
    const i = item.rows[0];
    const prompt = `Analyze the obsolescence risk for this electronic component:
- Part: ${i.part_name} (${i.part_number})
- Manufacturer: ${i.manufacturer}
- Category: ${i.category}
- Description: ${i.description}

Provide:
1. Risk Level (high/medium/low) with justification
2. Estimated End of Life date
3. Current lifecycle stage (Active/Mature/End of Life/Obsolete)
4. Confidence score (0-100%)
5. Last Time Buy date recommendation
6. Detailed mitigation strategy
7. Recommended replacement components
8. Impact assessment on the overall BOM`;

    const systemPrompt = 'You are an expert in electronic component lifecycle management and obsolescence forecasting. Provide realistic assessments based on industry knowledge.';
    const analysis = await queryOpenRouter(prompt, systemPrompt);
    res.json({ analysis, item: i });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
