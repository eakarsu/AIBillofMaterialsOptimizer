const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { queryOpenRouter } = require('../services/openrouter');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ap.*, bi.part_name as original_part_name, bi.part_number as original_part_number, bi.unit_cost as original_unit_cost
      FROM alternative_parts ap
      JOIN bom_items bi ON ap.original_part_id = bi.id
      ORDER BY ap.id
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ap.*, bi.part_name as original_part_name, bi.part_number as original_part_number, bi.unit_cost as original_unit_cost
      FROM alternative_parts ap
      JOIN bom_items bi ON ap.original_part_id = bi.id
      WHERE ap.id = $1
    `, [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { original_part_id, alt_part_number, alt_part_name, alt_manufacturer, alt_unit_cost, alt_supplier, compatibility_score, cost_savings_percent, lead_time_days, notes, status } = req.body;
    const result = await pool.query(
      `INSERT INTO alternative_parts (original_part_id, alt_part_number, alt_part_name, alt_manufacturer, alt_unit_cost, alt_supplier, compatibility_score, cost_savings_percent, lead_time_days, notes, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [original_part_id, alt_part_number, alt_part_name, alt_manufacturer, alt_unit_cost, alt_supplier, compatibility_score, cost_savings_percent, lead_time_days, notes, status || 'pending']
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { original_part_id, alt_part_number, alt_part_name, alt_manufacturer, alt_unit_cost, alt_supplier, compatibility_score, cost_savings_percent, lead_time_days, notes, status } = req.body;
    const result = await pool.query(
      `UPDATE alternative_parts SET original_part_id=$1, alt_part_number=$2, alt_part_name=$3, alt_manufacturer=$4, alt_unit_cost=$5, alt_supplier=$6, compatibility_score=$7, cost_savings_percent=$8, lead_time_days=$9, notes=$10, status=$11, updated_at=NOW()
       WHERE id=$12 RETURNING *`,
      [original_part_id, alt_part_number, alt_part_name, alt_manufacturer, alt_unit_cost, alt_supplier, compatibility_score, cost_savings_percent, lead_time_days, notes, status, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM alternative_parts WHERE id = $1 RETURNING *', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// AI: Find alternatives for a part
router.post('/ai/find/:bomItemId', auth, async (req, res) => {
  try {
    const item = await pool.query('SELECT * FROM bom_items WHERE id = $1', [req.params.bomItemId]);
    if (!item.rows[0]) return res.status(404).json({ error: 'BOM item not found' });
    const i = item.rows[0];
    const prompt = `Find alternative parts for this component:
- Part: ${i.part_name} (${i.part_number})
- Manufacturer: ${i.manufacturer}
- Unit Cost: $${i.unit_cost}
- Category: ${i.category}
- Description: ${i.description}

For each alternative, provide:
1. Alternative part number and manufacturer
2. Estimated unit cost
3. Compatibility score (0-100%)
4. Key differences and trade-offs
5. Recommended supplier
6. Estimated lead time

Suggest 3-5 alternatives ranging from drop-in replacements to cost-optimized options.`;

    const systemPrompt = 'You are an expert electronic components engineer with deep knowledge of cross-referencing parts across manufacturers. Provide specific, real alternative components.';
    const analysis = await queryOpenRouter(prompt, systemPrompt);
    res.json({ analysis, original_item: i });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
