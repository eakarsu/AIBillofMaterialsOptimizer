const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

// Export BOM items as CSV
router.get('/bom/csv', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM bom_items ORDER BY id');
    const items = result.rows;

    const headers = ['Part Number', 'Part Name', 'Description', 'Category', 'Manufacturer', 'Unit Cost', 'Quantity', 'Total Cost', 'Supplier', 'Status'];
    const csvRows = [headers.join(',')];

    items.forEach(item => {
      const row = [
        escapeCsv(item.part_number),
        escapeCsv(item.part_name),
        escapeCsv(item.description || ''),
        escapeCsv(item.category || ''),
        escapeCsv(item.manufacturer || ''),
        item.unit_cost,
        item.quantity,
        item.total_cost,
        escapeCsv(item.supplier || ''),
        escapeCsv(item.status || '')
      ];
      csvRows.push(row.join(','));
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=bom_export.csv');
    res.send(csvRows.join('\n'));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Import BOM items from CSV
router.post('/bom/csv', auth, async (req, res) => {
  try {
    const { csvData } = req.body;
    if (!csvData) return res.status(400).json({ error: 'No CSV data provided' });

    const lines = csvData.split('\n').filter(line => line.trim());
    if (lines.length < 2) return res.status(400).json({ error: 'CSV must have a header row and at least one data row' });

    const header = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase());
    const partNumberIdx = header.findIndex(h => h.includes('part') && h.includes('number'));
    const partNameIdx = header.findIndex(h => h.includes('part') && h.includes('name'));
    const descIdx = header.findIndex(h => h.includes('description'));
    const catIdx = header.findIndex(h => h.includes('category'));
    const mfgIdx = header.findIndex(h => h.includes('manufacturer'));
    const costIdx = header.findIndex(h => h.includes('unit') && h.includes('cost'));
    const qtyIdx = header.findIndex(h => h.includes('quantity') || h === 'qty');
    const supplierIdx = header.findIndex(h => h.includes('supplier'));
    const statusIdx = header.findIndex(h => h.includes('status'));

    if (partNumberIdx === -1 || partNameIdx === -1) {
      return res.status(400).json({ error: 'CSV must contain "Part Number" and "Part Name" columns' });
    }

    const imported = [];
    const errors = [];

    for (let i = 1; i < lines.length; i++) {
      try {
        const cols = parseCsvLine(lines[i]);
        const part_number = cols[partNumberIdx]?.trim();
        const part_name = cols[partNameIdx]?.trim();
        if (!part_number || !part_name) {
          errors.push(`Row ${i + 1}: Missing part number or name`);
          continue;
        }
        const unit_cost = parseFloat(cols[costIdx]?.trim()) || 0;
        const quantity = parseInt(cols[qtyIdx]?.trim()) || 1;
        const total_cost = unit_cost * quantity;

        const result = await pool.query(
          `INSERT INTO bom_items (part_number, part_name, description, category, manufacturer, unit_cost, quantity, total_cost, supplier, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
          [
            part_number,
            part_name,
            cols[descIdx]?.trim() || '',
            cols[catIdx]?.trim() || '',
            cols[mfgIdx]?.trim() || '',
            unit_cost,
            quantity,
            total_cost,
            cols[supplierIdx]?.trim() || '',
            cols[statusIdx]?.trim() || 'active'
          ]
        );
        imported.push(result.rows[0]);
      } catch (e) {
        errors.push(`Row ${i + 1}: ${e.message}`);
      }
    }

    res.json({ imported: imported.length, errors, items: imported });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Export suppliers as CSV
router.get('/suppliers/csv', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM suppliers ORDER BY id');
    const items = result.rows;
    const headers = ['Name', 'Contact Email', 'Contact Phone', 'Country', 'Rating', 'Quality Score', 'Delivery Score', 'Price Score', 'Category', 'Status'];
    const csvRows = [headers.join(',')];
    items.forEach(item => {
      csvRows.push([
        escapeCsv(item.name), escapeCsv(item.contact_email || ''), escapeCsv(item.contact_phone || ''),
        escapeCsv(item.country || ''), item.rating || '', item.quality_score || '', item.delivery_score || '',
        item.price_score || '', escapeCsv(item.category || ''), escapeCsv(item.status || '')
      ].join(','));
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=suppliers_export.csv');
    res.send(csvRows.join('\n'));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Export inventory as CSV
router.get('/inventory/csv', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ir.*, bi.part_number, bi.part_name
      FROM inventory_records ir
      LEFT JOIN bom_items bi ON ir.bom_item_id = bi.id
      ORDER BY ir.id
    `);
    const items = result.rows;
    const headers = ['Part Number', 'Part Name', 'Warehouse Location', 'Current Stock', 'Minimum Stock', 'Reorder Point', 'Reorder Quantity', 'Max Stock', 'Stock Status'];
    const csvRows = [headers.join(',')];
    items.forEach(item => {
      csvRows.push([
        escapeCsv(item.part_number || ''), escapeCsv(item.part_name || ''), escapeCsv(item.warehouse_location || ''),
        item.current_stock, item.minimum_stock, item.reorder_point, item.reorder_quantity, item.max_stock,
        escapeCsv(item.stock_status || '')
      ].join(','));
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=inventory_export.csv');
    res.send(csvRows.join('\n'));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

function escapeCsv(val) {
  if (val == null) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { result.push(current); current = ''; }
      else { current += ch; }
    }
  }
  result.push(current);
  return result;
}

module.exports = router;
