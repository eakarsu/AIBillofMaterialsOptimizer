const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const router = express.Router();

// GET /api/export/bom - Export BOM items as CSV
router.get('/bom', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM bom_items ORDER BY id');
    const items = result.rows;
    const headers = ['Part Number', 'Part Name', 'Description', 'Category', 'Manufacturer', 'Unit Cost', 'Quantity', 'Total Cost', 'Supplier', 'Status'];
    const csvRows = [headers.join(',')];
    items.forEach(item => {
      csvRows.push([
        escapeCsv(item.part_number), escapeCsv(item.part_name), escapeCsv(item.description || ''),
        escapeCsv(item.category || ''), escapeCsv(item.manufacturer || ''),
        item.unit_cost, item.quantity, item.total_cost,
        escapeCsv(item.supplier || ''), escapeCsv(item.status || '')
      ].join(','));
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=bom_export.csv');
    res.send(csvRows.join('\n'));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/export/cost-analysis - Export cost analysis as PDF
router.get('/cost-analysis', auth, async (req, res) => {
  try {
    const [byCategory, bySupplier, totals] = await Promise.all([
      pool.query(`
        SELECT COALESCE(category,'Uncategorized') as category, COUNT(*) as item_count,
               COALESCE(SUM(total_cost),0) as total_cost, COALESCE(AVG(unit_cost),0) as avg_unit_cost
        FROM bom_items GROUP BY category ORDER BY total_cost DESC
      `),
      pool.query(`
        SELECT COALESCE(supplier,'Unknown') as supplier, COUNT(*) as item_count,
               COALESCE(SUM(total_cost),0) as total_cost
        FROM bom_items GROUP BY supplier ORDER BY total_cost DESC LIMIT 15
      `),
      pool.query('SELECT COALESCE(SUM(total_cost),0) as grand_total, COUNT(*) as total_items FROM bom_items')
    ]);

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=cost_analysis.pdf');
    doc.pipe(res);

    doc.fontSize(18).font('Helvetica-Bold').text('BOM Cost Analysis Report', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown();

    const t = totals.rows[0];
    doc.fontSize(12).font('Helvetica-Bold').text('Summary');
    doc.fontSize(10).font('Helvetica')
      .text(`Total Items: ${t.total_items}   |   Grand Total Cost: $${parseFloat(t.grand_total).toFixed(2)}`);
    doc.moveDown();

    doc.fontSize(12).font('Helvetica-Bold').text('Cost by Category', { underline: true });
    doc.moveDown(0.3);
    const catCols = [50, 200, 300, 400, 490];
    const catHdrs = ['Category', 'Items', 'Total Cost', 'Avg Unit Cost'];
    doc.fontSize(9).font('Helvetica-Bold');
    catHdrs.forEach((h, i) => doc.text(h, catCols[i], doc.y, { width: catCols[i+1] - catCols[i] - 4, lineBreak: false }));
    doc.moveDown(0.4); doc.moveTo(50, doc.y).lineTo(530, doc.y).stroke(); doc.moveDown(0.2);
    doc.fontSize(9).font('Helvetica');
    byCategory.rows.forEach(r => {
      if (doc.y > 700) doc.addPage();
      const y = doc.y;
      doc.text(r.category, catCols[0], y, { width: 148, lineBreak: false });
      doc.text(String(r.item_count), catCols[1], y, { width: 98, lineBreak: false });
      doc.text(`$${parseFloat(r.total_cost).toFixed(2)}`, catCols[2], y, { width: 98, lineBreak: false });
      doc.text(`$${parseFloat(r.avg_unit_cost).toFixed(2)}`, catCols[3], y, { width: 88, lineBreak: false });
      doc.moveDown(0.6);
    });

    doc.moveDown();
    doc.fontSize(12).font('Helvetica-Bold').text('Cost by Supplier (Top 15)', { underline: true });
    doc.moveDown(0.3);
    const supCols = [50, 250, 360, 470];
    doc.fontSize(9).font('Helvetica-Bold');
    ['Supplier', 'Items', 'Total Cost'].forEach((h, i) => doc.text(h, supCols[i], doc.y, { width: supCols[i+1] ? supCols[i+1] - supCols[i] - 4 : 100, lineBreak: false }));
    doc.moveDown(0.4); doc.moveTo(50, doc.y).lineTo(530, doc.y).stroke(); doc.moveDown(0.2);
    doc.fontSize(9).font('Helvetica');
    bySupplier.rows.forEach(r => {
      if (doc.y > 700) doc.addPage();
      const y = doc.y;
      doc.text(r.supplier, supCols[0], y, { width: 198, lineBreak: false });
      doc.text(String(r.item_count), supCols[1], y, { width: 108, lineBreak: false });
      doc.text(`$${parseFloat(r.total_cost).toFixed(2)}`, supCols[2], y, { width: 108, lineBreak: false });
      doc.moveDown(0.6);
    });

    doc.end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/export/risk-report - Export risk report as PDF
router.get('/risk-report', auth, async (req, res) => {
  try {
    const [highRisk, singleSource, summary] = await Promise.all([
      pool.query(`
        SELECT bi.part_number, bi.part_name, bi.manufacturer, bi.supplier, bi.total_cost,
               ra.risk_score, ra.risk_category, ra.single_source_risk, ra.geopolitical_risk,
               ra.supply_chain_risk, ra.mitigation_plan
        FROM risk_assessments ra
        JOIN bom_items bi ON ra.bom_item_id = bi.id
        ORDER BY ra.risk_score DESC
        LIMIT 50
      `),
      pool.query(`
        SELECT bi.part_number, bi.part_name, bi.supplier, bi.total_cost, ra.risk_score
        FROM risk_assessments ra
        JOIN bom_items bi ON ra.bom_item_id = bi.id
        WHERE ra.single_source_risk = true
        ORDER BY bi.total_cost DESC
      `),
      pool.query(`
        SELECT COUNT(*) as total,
               COUNT(CASE WHEN risk_score >= 7 THEN 1 END) as high,
               COUNT(CASE WHEN risk_score >= 4 AND risk_score < 7 THEN 1 END) as medium,
               COUNT(CASE WHEN risk_score < 4 THEN 1 END) as low,
               COUNT(CASE WHEN single_source_risk = true THEN 1 END) as single_source
        FROM risk_assessments
      `)
    ]);

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=risk_report.pdf');
    doc.pipe(res);

    doc.fontSize(18).font('Helvetica-Bold').text('Supply Chain Risk Report', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown();

    const s = summary.rows[0];
    doc.fontSize(12).font('Helvetica-Bold').text('Risk Summary');
    doc.fontSize(10).font('Helvetica')
      .text(`Total Risk Assessments: ${s.total}  |  High: ${s.high}  |  Medium: ${s.medium}  |  Low: ${s.low}  |  Single-Source: ${s.single_source}`);
    doc.moveDown();

    doc.fontSize(12).font('Helvetica-Bold').text('Risk Assessments (by Score)', { underline: true });
    doc.moveDown(0.3);
    const cols = [50, 140, 230, 300, 370, 430, 480];
    const hdrs = ['Part #', 'Part Name', 'Supplier', 'Score', 'Category', 'SS Risk'];
    doc.fontSize(9).font('Helvetica-Bold');
    hdrs.forEach((h, i) => doc.text(h, cols[i], doc.y, { width: cols[i+1] ? cols[i+1]-cols[i]-4 : 70, lineBreak: false }));
    doc.moveDown(0.4); doc.moveTo(50, doc.y).lineTo(530, doc.y).stroke(); doc.moveDown(0.2);
    doc.fontSize(8).font('Helvetica');
    highRisk.rows.forEach(r => {
      if (doc.y > 700) doc.addPage();
      const y = doc.y;
      const scoreColor = r.risk_score >= 7 ? 'red' : r.risk_score >= 4 ? 'orange' : 'green';
      doc.text(r.part_number || '', cols[0], y, { width: 88, lineBreak: false });
      doc.text((r.part_name || '').substring(0, 15), cols[1], y, { width: 88, lineBreak: false });
      doc.text((r.supplier || '').substring(0, 14), cols[2], y, { width: 68, lineBreak: false });
      doc.fillColor(scoreColor).text(String(r.risk_score), cols[3], y, { width: 38, lineBreak: false });
      doc.fillColor('black');
      doc.text((r.risk_category || '').substring(0, 14), cols[4], y, { width: 58, lineBreak: false });
      doc.text(r.single_source_risk ? 'YES' : 'no', cols[5], y, { width: 48, lineBreak: false });
      doc.moveDown(0.5);
    });

    if (singleSource.rows.length > 0) {
      doc.addPage();
      doc.fontSize(12).font('Helvetica-Bold').text('Single-Source Risk Components', { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica');
      singleSource.rows.forEach(r => {
        if (doc.y > 700) doc.addPage();
        doc.fillColor('red').text(`• ${r.part_number} - ${r.part_name}`, 50).fillColor('black')
          .text(`  Supplier: ${r.supplier || 'Unknown'}  |  Total Cost: $${parseFloat(r.total_cost || 0).toFixed(2)}  |  Risk Score: ${r.risk_score}`, 60);
        doc.moveDown(0.3);
      });
    }

    doc.end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Export BOM items as CSV (legacy path)
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

// Export BOM as PDF with cost totals and risk flags
router.get('/bom/pdf', auth, async (req, res) => {
  try {
    const [itemsResult, risksResult] = await Promise.all([
      pool.query('SELECT * FROM bom_items ORDER BY category, part_number'),
      pool.query('SELECT bom_item_id, risk_score, single_source_risk FROM risk_assessments')
    ]);

    const items = itemsResult.rows;
    const riskMap = {};
    risksResult.rows.forEach(r => { riskMap[r.bom_item_id] = r; });

    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=bom_report.pdf');
    doc.pipe(res);

    // Header
    doc.fontSize(18).font('Helvetica-Bold').text('Bill of Materials Report', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown();

    // Summary box
    const totalCost = items.reduce((s, i) => s + parseFloat(i.total_cost || 0), 0);
    const highRiskCount = Object.values(riskMap).filter(r => r.risk_score >= 7).length;
    const singleSourceCount = Object.values(riskMap).filter(r => r.single_source_risk).length;
    doc.fontSize(11).font('Helvetica-Bold').text('Summary', { underline: true });
    doc.font('Helvetica').fontSize(10)
      .text(`Total Items: ${items.length}   |   Total BOM Cost: $${totalCost.toFixed(2)}   |   High-Risk Items: ${highRiskCount}   |   Single-Source: ${singleSourceCount}`);
    doc.moveDown();

    // Table header
    const colX = [40, 130, 230, 310, 390, 460, 520, 590, 650];
    const headers = ['Part #', 'Part Name', 'Category', 'Manufacturer', 'Supplier', 'Unit Cost', 'Qty', 'Total Cost', 'Risk'];
    doc.fontSize(9).font('Helvetica-Bold');
    headers.forEach((h, i) => doc.text(h, colX[i], doc.y, { width: colX[i + 1] ? colX[i + 1] - colX[i] - 4 : 60, lineBreak: false }));
    doc.moveDown(0.3);
    doc.moveTo(40, doc.y).lineTo(760, doc.y).stroke();
    doc.moveDown(0.2);

    // Table rows
    doc.fontSize(8).font('Helvetica');
    items.forEach(item => {
      if (doc.y > 510) { doc.addPage(); }
      const risk = riskMap[item.id];
      const riskLabel = risk ? (risk.risk_score >= 7 ? 'HIGH' : risk.risk_score >= 4 ? 'MED' : 'LOW') : '-';
      const y = doc.y;
      doc.text(item.part_number || '', colX[0], y, { width: 88, lineBreak: false });
      doc.text((item.part_name || '').substring(0, 18), colX[1], y, { width: 98, lineBreak: false });
      doc.text((item.category || '').substring(0, 14), colX[2], y, { width: 78, lineBreak: false });
      doc.text((item.manufacturer || '').substring(0, 14), colX[3], y, { width: 78, lineBreak: false });
      doc.text((item.supplier || '').substring(0, 14), colX[4], y, { width: 68, lineBreak: false });
      doc.text(`$${parseFloat(item.unit_cost || 0).toFixed(2)}`, colX[5], y, { width: 58, lineBreak: false });
      doc.text(String(item.quantity || 0), colX[6], y, { width: 38, lineBreak: false });
      doc.text(`$${parseFloat(item.total_cost || 0).toFixed(2)}`, colX[7], y, { width: 58, lineBreak: false });
      if (risk && risk.single_source_risk) {
        doc.fillColor('red').text(riskLabel, colX[8], y, { width: 40, lineBreak: false });
        doc.fillColor('black');
      } else {
        doc.text(riskLabel, colX[8], y, { width: 40, lineBreak: false });
      }
      doc.moveDown(0.5);
    });

    // Footer totals
    doc.moveDown();
    doc.moveTo(40, doc.y).lineTo(760, doc.y).stroke();
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica-Bold').text(`Grand Total BOM Cost: $${totalCost.toFixed(2)}`, { align: 'right' });

    doc.end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Export RFQ as PDF
router.get('/rfq', auth, async (req, res) => {
  try {
    const { supplier } = req.query;
    let query = 'SELECT * FROM bom_items WHERE status = $1';
    const params = ['active'];
    if (supplier) {
      query += ' AND supplier ILIKE $2';
      params.push(`%${supplier}%`);
    }
    query += ' ORDER BY supplier, part_number';
    const itemsResult = await pool.query(query, params);
    const items = itemsResult.rows;

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=rfq_${Date.now()}.pdf`);
    doc.pipe(res);

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text('REQUEST FOR QUOTATION', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').text(`RFQ Date: ${new Date().toLocaleDateString()}`, { align: 'right' });
    doc.text(`RFQ #: RFQ-${Date.now()}`, { align: 'right' });
    doc.moveDown();

    // Instructions
    doc.fontSize(11).font('Helvetica-Bold').text('Instructions to Supplier:');
    doc.fontSize(10).font('Helvetica').text(
      'Please provide your best pricing for the following items. Include unit cost, lead time, minimum order quantity, ' +
      'and any volume discount tiers. Quote validity should be at least 30 days. Submit completed quote to procurement@company.com.'
    );
    doc.moveDown();

    // Group by supplier if no filter
    const suppliers = [...new Set(items.map(i => i.supplier || 'Unknown'))];
    suppliers.forEach(sup => {
      const supItems = items.filter(i => (i.supplier || 'Unknown') === sup);
      doc.fontSize(12).font('Helvetica-Bold').text(`Supplier: ${sup}`);
      doc.moveDown(0.3);

      // Table header
      const cols = [50, 150, 300, 360, 420, 480];
      const hdrs = ['Part #', 'Part Name', 'Qty', 'Target Cost', 'Quoted Cost', 'Lead Time'];
      doc.fontSize(9).font('Helvetica-Bold');
      hdrs.forEach((h, i) => doc.text(h, cols[i], doc.y, { width: cols[i + 1] ? cols[i + 1] - cols[i] - 4 : 80, lineBreak: false }));
      doc.moveDown(0.4);
      doc.moveTo(50, doc.y).lineTo(560, doc.y).stroke();
      doc.moveDown(0.2);

      doc.fontSize(9).font('Helvetica');
      supItems.forEach(item => {
        if (doc.y > 720) { doc.addPage(); }
        const y = doc.y;
        doc.text(item.part_number || '', cols[0], y, { width: 98, lineBreak: false });
        doc.text((item.part_name || '').substring(0, 22), cols[1], y, { width: 148, lineBreak: false });
        doc.text(String(item.quantity || ''), cols[2], y, { width: 58, lineBreak: false });
        doc.text(`$${parseFloat(item.unit_cost || 0).toFixed(4)}`, cols[3], y, { width: 58, lineBreak: false });
        doc.text('_________', cols[4], y, { width: 58, lineBreak: false });
        doc.text('______ days', cols[5], y, { width: 80, lineBreak: false });
        doc.moveDown(0.6);
      });
      doc.moveDown(0.5);
    });

    doc.moveDown();
    doc.fontSize(10).font('Helvetica-Bold').text('Terms & Conditions:');
    doc.font('Helvetica').fontSize(9).text('Payment Terms: Net 30 | Delivery: DDP Destination | Warranty: 12 months minimum');

    doc.end();
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
