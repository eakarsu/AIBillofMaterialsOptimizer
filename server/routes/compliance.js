const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { queryOpenRouter } = require('../services/openrouter');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT cr.*, bi.part_name, bi.part_number, bi.manufacturer, bi.category
      FROM compliance_records cr
      JOIN bom_items bi ON cr.bom_item_id = bi.id
      ORDER BY cr.compliance_status, cr.expiry_date
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT cr.*, bi.part_name, bi.part_number, bi.manufacturer, bi.category, bi.supplier
      FROM compliance_records cr
      JOIN bom_items bi ON cr.bom_item_id = bi.id
      WHERE cr.id = $1
    `, [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { bom_item_id, regulation_type, compliance_status, certificate_number, expiry_date, testing_lab, test_date, rohs_compliant, reach_compliant, conflict_mineral_free, documentation_url, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO compliance_records (bom_item_id, regulation_type, compliance_status, certificate_number, expiry_date, testing_lab, test_date, rohs_compliant, reach_compliant, conflict_mineral_free, documentation_url, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [bom_item_id, regulation_type, compliance_status, certificate_number, expiry_date, testing_lab, test_date, rohs_compliant, reach_compliant, conflict_mineral_free, documentation_url, notes]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { bom_item_id, regulation_type, compliance_status, certificate_number, expiry_date, testing_lab, test_date, rohs_compliant, reach_compliant, conflict_mineral_free, documentation_url, notes } = req.body;
    const result = await pool.query(
      `UPDATE compliance_records SET bom_item_id=$1, regulation_type=$2, compliance_status=$3, certificate_number=$4, expiry_date=$5, testing_lab=$6, test_date=$7, rohs_compliant=$8, reach_compliant=$9, conflict_mineral_free=$10, documentation_url=$11, notes=$12, updated_at=NOW()
       WHERE id=$13 RETURNING *`,
      [bom_item_id, regulation_type, compliance_status, certificate_number, expiry_date, testing_lab, test_date, rohs_compliant, reach_compliant, conflict_mineral_free, documentation_url, notes, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM compliance_records WHERE id = $1 RETURNING *', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/assess/:bomItemId', auth, async (req, res) => {
  try {
    const item = (await pool.query('SELECT * FROM bom_items WHERE id = $1', [req.params.bomItemId])).rows[0];
    if (!item) return res.status(404).json({ error: 'BOM item not found' });
    const records = await pool.query('SELECT * FROM compliance_records WHERE bom_item_id = $1', [req.params.bomItemId]);
    const prompt = `Assess regulatory compliance for this electronic component:
- Part: ${item.part_name} (${item.part_number})
- Manufacturer: ${item.manufacturer}
- Category: ${item.category}

Existing compliance records:
${records.rows.length > 0 ? records.rows.map(r => `- ${r.regulation_type}: ${r.compliance_status} (RoHS: ${r.rohs_compliant}, REACH: ${r.reach_compliant})`).join('\n') : 'None'}

Provide: 1) Comprehensive compliance gap analysis 2) Required certifications for EU/US/Asia markets 3) RoHS and REACH substance assessment 4) Conflict minerals risk 5) Environmental regulations (WEEE, packaging) 6) Upcoming regulatory changes to watch 7) Action items and timeline.`;
    const analysis = await queryOpenRouter(prompt, 'You are a regulatory compliance expert for electronic components, with deep knowledge of RoHS, REACH, conflict minerals, UL, CE, FCC, and WEEE directives.');
    res.json({ analysis, item, records: records.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
