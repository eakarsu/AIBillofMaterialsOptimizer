const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { queryOpenRouter } = require('../services/openrouter');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM bom_versions ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM bom_versions WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { version_name, version_number, description, total_cost, total_items, change_type, changed_by, change_reason, baseline_version_id, cost_difference, status } = req.body;
    const result = await pool.query(
      `INSERT INTO bom_versions (version_name, version_number, description, total_cost, total_items, change_type, changed_by, change_reason, baseline_version_id, cost_difference, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [version_name, version_number, description, total_cost, total_items, change_type, changed_by, change_reason, baseline_version_id, cost_difference, status || 'draft']
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { version_name, version_number, description, total_cost, total_items, change_type, changed_by, change_reason, baseline_version_id, cost_difference, status } = req.body;
    const result = await pool.query(
      `UPDATE bom_versions SET version_name=$1, version_number=$2, description=$3, total_cost=$4, total_items=$5, change_type=$6, changed_by=$7, change_reason=$8, baseline_version_id=$9, cost_difference=$10, status=$11, updated_at=NOW()
       WHERE id=$12 RETURNING *`,
      [version_name, version_number, description, total_cost, total_items, change_type, changed_by, change_reason, baseline_version_id, cost_difference, status, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM bom_versions WHERE id = $1 RETURNING *', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/compare', auth, async (req, res) => {
  try {
    const versions = (await pool.query('SELECT * FROM bom_versions ORDER BY version_number')).rows;
    const prompt = `Compare these BOM versions and provide analysis:

${versions.map(v => `- ${v.version_name} (${v.version_number}): ${v.total_items} items, Total Cost: $${v.total_cost}, Change: ${v.change_type}, Status: ${v.status}
  Reason: ${v.change_reason}
  Cost Diff: ${v.cost_difference ? '$' + v.cost_difference : 'N/A'}`).join('\n\n')}

Provide: 1) Version-over-version cost trend analysis 2) Impact assessment of changes 3) Identify the most cost-effective version 4) Risk assessment of each version change 5) Recommendations for the next version 6) Cost optimization opportunities missed.`;
    const analysis = await queryOpenRouter(prompt, 'You are a BOM configuration management expert specializing in version control, change management, and cost impact analysis for manufacturing.');
    res.json({ analysis, versions });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
