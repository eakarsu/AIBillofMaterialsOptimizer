const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

// GET /api/parts/:id/where-used
// Returns all BOMs that use this part across all levels (direct + indirect)
router.get('/:id/where-used', auth, async (req, res) => {
  try {
    const partId = req.params.id;

    // Verify part exists
    const partResult = await pool.query('SELECT * FROM bom_items WHERE id = $1', [partId]);
    if (!partResult.rows[0]) return res.status(404).json({ error: 'Part not found' });
    const part = partResult.rows[0];

    // Recursive CTE: walk UP the tree from this part to find all ancestor assemblies
    // Also find all direct parents at any BOM level
    const whereUsedResult = await pool.query(`
      WITH RECURSIVE where_used AS (
        -- Direct parents of this part
        SELECT
          parent.id as assembly_id,
          parent.part_number as assembly_part_number,
          parent.part_name as assembly_part_name,
          parent.category as assembly_category,
          parent.supplier as assembly_supplier,
          parent.unit_cost as assembly_unit_cost,
          parent.quantity as assembly_quantity,
          parent.total_cost as assembly_total_cost,
          parent.status as assembly_status,
          child.id as used_part_id,
          child.part_number as used_part_number,
          1 as level,
          ARRAY[parent.id] as path
        FROM bom_items child
        JOIN bom_items parent ON child.parent_id = parent.id
        WHERE child.id = $1

        UNION ALL

        -- Walk up the tree
        SELECT
          grandparent.id,
          grandparent.part_number,
          grandparent.part_name,
          grandparent.category,
          grandparent.supplier,
          grandparent.unit_cost,
          grandparent.quantity,
          grandparent.total_cost,
          grandparent.status,
          wu.assembly_id,
          wu.assembly_part_number,
          wu.level + 1,
          wu.path || grandparent.id
        FROM bom_items grandparent
        JOIN where_used wu ON wu.assembly_id = grandparent.id
        WHERE grandparent.parent_id IS NOT NULL
          AND NOT grandparent.id = ANY(wu.path)
      )
      SELECT DISTINCT
        assembly_id, assembly_part_number, assembly_part_name,
        assembly_category, assembly_supplier, assembly_unit_cost,
        assembly_quantity, assembly_total_cost, assembly_status, level
      FROM where_used
      ORDER BY level, assembly_part_number
    `, [partId]);

    // Also check bom_versions or any BOM-level references if bom_item_id references exist
    // Check for any bom version references
    let bomVersionRefs = [];
    try {
      const bvResult = await pool.query(`
        SELECT bv.bom_name, bv.version_number, bv.status, bv.created_at
        FROM bom_versions bv
        JOIN bom_version_items bvi ON bvi.bom_version_id = bv.id
        WHERE bvi.bom_item_id = $1
      `, [partId]);
      bomVersionRefs = bvResult.rows;
    } catch {
      // bom_version_items table may not exist — gracefully skip
    }

    const assemblies = whereUsedResult.rows;
    const impactSummary = {
      total_assemblies_affected: assemblies.length,
      direct_parents: assemblies.filter(a => a.level === 1).length,
      indirect_ancestors: assemblies.filter(a => a.level > 1).length,
      total_assembly_value_at_risk: assemblies.reduce((sum, a) => sum + parseFloat(a.assembly_total_cost || 0), 0).toFixed(2),
      bom_versions_affected: bomVersionRefs.length
    };

    res.json({
      part,
      where_used: assemblies,
      bom_version_references: bomVersionRefs,
      impact_summary: impactSummary,
      change_impact_statement: assemblies.length === 0
        ? 'This part is not used in any parent assembly. Changes have no upstream impact.'
        : `This part is used in ${assemblies.length} assembly/assemblies across ${Math.max(...assemblies.map(a => a.level))} level(s). Any change or discontinuation will impact these assemblies.`
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
