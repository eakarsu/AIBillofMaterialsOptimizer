const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { queryOpenRouter } = require('../services/openrouter');
const { logAudit } = require('../middleware/auditLog');
const router = express.Router();

// Get all BOM items
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM bom_items ORDER BY id');
    res.json(result.rows);
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
router.post('/', auth, async (req, res) => {
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

// AI: Optimize BOM costs
router.post('/ai/optimize', auth, async (req, res) => {
  try {
    const items = await pool.query('SELECT * FROM bom_items ORDER BY total_cost DESC');
    const prompt = `Analyze this Bill of Materials and provide cost optimization recommendations. Focus on:
1. Highest cost items that could be reduced
2. Volume purchasing opportunities
3. Alternative suppliers or manufacturers
4. Design simplification suggestions
5. Consolidation opportunities

BOM Items:
${items.rows.map(i => `- ${i.part_name} (${i.part_number}): $${i.unit_cost} x ${i.quantity} = $${i.total_cost} from ${i.supplier}`).join('\n')}

Total BOM Cost: $${items.rows.reduce((sum, i) => sum + parseFloat(i.total_cost), 0).toFixed(2)}

Provide a structured analysis with specific, actionable recommendations and estimated savings for each.`;

    const systemPrompt = 'You are an expert manufacturing cost engineer specializing in BOM optimization and supply chain management. Provide specific, actionable recommendations with estimated savings percentages.';
    const analysis = await queryOpenRouter(prompt, systemPrompt);
    res.json({ analysis, total_items: items.rows.length, total_cost: items.rows.reduce((sum, i) => sum + parseFloat(i.total_cost), 0).toFixed(2) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// AI: Optimize single item
router.post('/ai/optimize/:id', auth, async (req, res) => {
  try {
    const item = await pool.query('SELECT * FROM bom_items WHERE id = $1', [req.params.id]);
    if (!item.rows[0]) return res.status(404).json({ error: 'Not found' });
    const i = item.rows[0];
    const prompt = `Provide detailed cost optimization analysis for this component:
- Part: ${i.part_name} (${i.part_number})
- Manufacturer: ${i.manufacturer}
- Unit Cost: $${i.unit_cost}, Quantity: ${i.quantity}, Total: $${i.total_cost}
- Supplier: ${i.supplier}
- Category: ${i.category}

Suggest: alternative parts, better suppliers, volume strategies, and design alternatives. Include estimated savings.`;

    const systemPrompt = 'You are an expert manufacturing cost engineer. Provide specific, detailed optimization recommendations.';
    const analysis = await queryOpenRouter(prompt, systemPrompt);
    await pool.query('UPDATE bom_items SET ai_optimization_notes = $1, updated_at = NOW() WHERE id = $2', [analysis, req.params.id]);
    res.json({ analysis, item: i });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
