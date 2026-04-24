const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { queryOpenRouter } = require('../services/openrouter');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT lt.*, bi.part_name, bi.part_number, bi.manufacturer, bi.category
      FROM lead_time_records lt
      JOIN bom_items bi ON lt.bom_item_id = bi.id
      ORDER BY lt.current_lead_time_days DESC
    `);
    res.json(result.rows);
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

router.post('/', auth, async (req, res) => {
  try {
    const { bom_item_id, supplier, standard_lead_time_days, current_lead_time_days, expedited_lead_time_days, last_order_date, next_delivery_date, reliability_score, trend, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO lead_time_records (bom_item_id, supplier, standard_lead_time_days, current_lead_time_days, expedited_lead_time_days, last_order_date, next_delivery_date, reliability_score, trend, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [bom_item_id, supplier, standard_lead_time_days, current_lead_time_days, expedited_lead_time_days, last_order_date, next_delivery_date, reliability_score, trend, notes]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { bom_item_id, supplier, standard_lead_time_days, current_lead_time_days, expedited_lead_time_days, last_order_date, next_delivery_date, reliability_score, trend, notes } = req.body;
    const result = await pool.query(
      `UPDATE lead_time_records SET bom_item_id=$1, supplier=$2, standard_lead_time_days=$3, current_lead_time_days=$4, expedited_lead_time_days=$5, last_order_date=$6, next_delivery_date=$7, reliability_score=$8, trend=$9, notes=$10, updated_at=NOW()
       WHERE id=$11 RETURNING *`,
      [bom_item_id, supplier, standard_lead_time_days, current_lead_time_days, expedited_lead_time_days, last_order_date, next_delivery_date, reliability_score, trend, notes, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM lead_time_records WHERE id = $1 RETURNING *', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// AI: Forecast lead times
router.post('/ai/forecast/:bomItemId', auth, async (req, res) => {
  try {
    const item = await pool.query('SELECT * FROM bom_items WHERE id = $1', [req.params.bomItemId]);
    if (!item.rows[0]) return res.status(404).json({ error: 'BOM item not found' });
    const leadTimes = await pool.query('SELECT * FROM lead_time_records WHERE bom_item_id = $1', [req.params.bomItemId]);
    const i = item.rows[0];
    const prompt = `Analyze and forecast lead times for this component:
- Part: ${i.part_name} (${i.part_number})
- Manufacturer: ${i.manufacturer}
- Category: ${i.category}
- Current Supplier: ${i.supplier}

Historical Lead Time Data:
${leadTimes.rows.map(lt => `- ${lt.supplier}: Standard ${lt.standard_lead_time_days}d, Current ${lt.current_lead_time_days}d, Trend: ${lt.trend}`).join('\n')}

Provide:
1. Lead time forecast for next 3-6 months
2. Supply chain risk assessment
3. Recommendations for reducing lead times
4. Alternative supplier suggestions
5. Inventory buffer recommendations
6. Impact of global supply chain trends`;

    const systemPrompt = 'You are a supply chain analytics expert specializing in electronic component procurement and lead time optimization.';
    const analysis = await queryOpenRouter(prompt, systemPrompt);
    res.json({ analysis, item: i, lead_times: leadTimes.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
