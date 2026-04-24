import React, { useState, useEffect } from 'react';
import api from '../services/api';
import AIAnalysis from '../components/AIAnalysis';

const emptyItem = { part_number: '', part_name: '', description: '', category: '', manufacturer: '', unit_cost: '', quantity: '', supplier: '', status: 'active' };

export default function BomItems() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiGlobalLoading, setAiGlobalLoading] = useState(false);
  const [aiGlobalResult, setAiGlobalResult] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortField, setSortField] = useState('');
  const [sortDir, setSortDir] = useState('asc');
  const [showImport, setShowImport] = useState(false);
  const [importCsv, setImportCsv] = useState('');
  const [importResult, setImportResult] = useState(null);

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get('/bom'); setItems(data); } catch (e) { setError(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    try {
      if (form.id) await api.put(`/bom/${form.id}`, form);
      else await api.post('/bom', form);
      setForm(null); load();
    } catch (e) { setError(e.response?.data?.error || e.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this BOM item?')) return;
    try { await api.delete(`/bom/${id}`); setSelected(null); load(); } catch (e) { setError(e.message); }
  };

  const handleAiOptimize = async (id) => {
    setAiLoading(true); setAiResult(null);
    try { const { data } = await api.post(`/bom/ai/optimize/${id}`); setAiResult(data.analysis); } catch (e) { setError(e.message); }
    setAiLoading(false);
  };

  const handleGlobalOptimize = async () => {
    setAiGlobalLoading(true); setAiGlobalResult(null);
    try { const { data } = await api.post('/bom/ai/optimize'); setAiGlobalResult(data); } catch (e) { setError(e.message); }
    setAiGlobalLoading(false);
  };

  const handleExportCsv = async () => {
    try {
      const response = await api.get('/export/bom/csv', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bom_export.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) { setError('Export failed: ' + e.message); }
  };

  const handleImportCsv = async () => {
    try {
      const { data } = await api.post('/export/bom/csv', { csvData: importCsv });
      setImportResult(data);
      if (data.imported > 0) load();
    } catch (e) { setError(e.response?.data?.error || e.message); }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => setImportCsv(evt.target.result);
    reader.readAsText(file);
  };

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  if (loading) return <div className="loading-container"><div className="spinner-lg"></div>Loading BOM items...</div>;

  const categories = [...new Set(items.map(i => i.category).filter(Boolean))];
  const suppliers = [...new Set(items.map(i => i.supplier).filter(Boolean))];

  let filtered = items.filter(item => {
    if (search) {
      const q = search.toLowerCase();
      if (!item.part_number.toLowerCase().includes(q) && !item.part_name.toLowerCase().includes(q) && !(item.description || '').toLowerCase().includes(q) && !(item.manufacturer || '').toLowerCase().includes(q)) return false;
    }
    if (filterCategory && item.category !== filterCategory) return false;
    if (filterSupplier && item.supplier !== filterSupplier) return false;
    if (filterStatus && item.status !== filterStatus) return false;
    return true;
  });

  if (sortField) {
    filtered = [...filtered].sort((a, b) => {
      let va = a[sortField], vb = b[sortField];
      if (['unit_cost', 'quantity', 'total_cost'].includes(sortField)) { va = parseFloat(va) || 0; vb = parseFloat(vb) || 0; }
      else { va = (va || '').toLowerCase(); vb = (vb || '').toLowerCase(); }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }

  const totalCost = filtered.reduce((s, i) => s + parseFloat(i.total_cost || 0), 0);
  const sortIcon = (field) => sortField === field ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  return (
    <div>
      <div className="page-header">
        <h1>BOM Items</h1>
        <div className="actions">
          <button className="btn btn-sm btn-secondary" onClick={handleExportCsv}>Export CSV</button>
          <button className="btn btn-sm btn-secondary" onClick={() => setShowImport(true)}>Import CSV</button>
          <button className="btn btn-ai" onClick={handleGlobalOptimize} disabled={aiGlobalLoading}>
            {aiGlobalLoading ? <><span className="spinner"></span>Analyzing...</> : 'AI Optimize All'}
          </button>
          <button className="btn btn-primary" onClick={() => setForm({ ...emptyItem })}>+ New Item</button>
        </div>
      </div>

      {error && <div className="error-message">{error} <button onClick={() => setError('')} style={{float:'right',background:'none',border:'none',color:'#f87171',cursor:'pointer'}}>×</button></div>}

      <div className="stats-bar">
        <div className="stat-card"><div className="stat-label">Total Items</div><div className="stat-value">{filtered.length}{filtered.length !== items.length ? ` / ${items.length}` : ''}</div></div>
        <div className="stat-card"><div className="stat-label">Total BOM Cost</div><div className="stat-value">${totalCost.toLocaleString('en-US', {minimumFractionDigits: 2})}</div></div>
        <div className="stat-card"><div className="stat-label">Categories</div><div className="stat-value">{categories.length}</div></div>
        <div className="stat-card"><div className="stat-label">Suppliers</div><div className="stat-value">{suppliers.length}</div></div>
      </div>

      <div className="filter-bar">
        <input className="filter-input" placeholder="Search parts, names, manufacturers..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="filter-select" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="filter-select" value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)}>
          <option value="">All Suppliers</option>
          {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="discontinued">Discontinued</option>
        </select>
        {(search || filterCategory || filterSupplier || filterStatus) && (
          <button className="btn btn-sm btn-secondary" onClick={() => { setSearch(''); setFilterCategory(''); setFilterSupplier(''); setFilterStatus(''); }}>Clear</button>
        )}
      </div>

      {aiGlobalResult && <AIAnalysis content={aiGlobalResult.analysis} title={`BOM Optimization Analysis (${aiGlobalResult.total_items} items, Total: $${aiGlobalResult.total_cost})`} />}

      <div className="table-container" style={{marginTop: 20}}>
        <table>
          <thead><tr>
            <th style={{cursor:'pointer'}} onClick={() => handleSort('part_number')}>Part #{sortIcon('part_number')}</th>
            <th style={{cursor:'pointer'}} onClick={() => handleSort('part_name')}>Name{sortIcon('part_name')}</th>
            <th style={{cursor:'pointer'}} onClick={() => handleSort('category')}>Category{sortIcon('category')}</th>
            <th style={{cursor:'pointer'}} onClick={() => handleSort('manufacturer')}>Manufacturer{sortIcon('manufacturer')}</th>
            <th style={{cursor:'pointer'}} onClick={() => handleSort('unit_cost')}>Unit Cost{sortIcon('unit_cost')}</th>
            <th style={{cursor:'pointer'}} onClick={() => handleSort('quantity')}>Qty{sortIcon('quantity')}</th>
            <th style={{cursor:'pointer'}} onClick={() => handleSort('total_cost')}>Total{sortIcon('total_cost')}</th>
            <th style={{cursor:'pointer'}} onClick={() => handleSort('supplier')}>Supplier{sortIcon('supplier')}</th>
            <th>Status</th>
          </tr></thead>
          <tbody>
            {filtered.map(item => (
              <tr key={item.id} onClick={() => { setSelected(item); setAiResult(null); }}>
                <td style={{fontWeight:600, color:'#60a5fa'}}>{item.part_number}</td>
                <td>{item.part_name}</td>
                <td>{item.category}</td>
                <td>{item.manufacturer}</td>
                <td>${parseFloat(item.unit_cost).toFixed(2)}</td>
                <td>{item.quantity}</td>
                <td style={{fontWeight:600}}>${parseFloat(item.total_cost).toFixed(2)}</td>
                <td>{item.supplier}</td>
                <td><span className={`badge badge-${item.status}`}>{item.status}</span></td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={9} style={{textAlign:'center', color:'#64748b', padding: 40}}>No items match your filters</td></tr>}
          </tbody>
        </table>
      </div>

      {showImport && (
        <div className="modal-overlay" onClick={() => { setShowImport(false); setImportResult(null); setImportCsv(''); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Import BOM Items from CSV</h2>
            <p style={{color:'#94a3b8', fontSize:13, marginBottom:16}}>CSV must include "Part Number" and "Part Name" columns. Optional: Description, Category, Manufacturer, Unit Cost, Quantity, Supplier, Status.</p>
            <div className="form-group">
              <label>Upload CSV File</label>
              <input type="file" accept=".csv" onChange={handleFileUpload} style={{padding: 8}} />
            </div>
            <div className="form-group">
              <label>Or Paste CSV Data</label>
              <textarea value={importCsv} onChange={e => setImportCsv(e.target.value)} rows={8} placeholder="Part Number,Part Name,Category,Unit Cost,Quantity,Supplier&#10;RES-001,10K Resistor,Passive,0.05,1000,DigiKey" style={{width:'100%',padding:12,background:'#0f172a',border:'1px solid #334155',borderRadius:8,color:'#e2e8f0',fontFamily:'monospace',fontSize:12}} />
            </div>
            {importResult && (
              <div style={{marginBottom: 16}}>
                <div style={{color:'#4ade80', marginBottom: 4}}>Successfully imported {importResult.imported} items</div>
                {importResult.errors.length > 0 && (
                  <div style={{color:'#fbbf24', fontSize: 12}}>{importResult.errors.map((e, i) => <div key={i}>{e}</div>)}</div>
                )}
              </div>
            )}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => { setShowImport(false); setImportResult(null); setImportCsv(''); }}>Close</button>
              <button className="btn btn-primary" onClick={handleImportCsv} disabled={!importCsv.trim()}>Import</button>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <h2>BOM Item Details</h2>
            <div className="detail-grid">
              <div className="detail-item"><label>Part Number</label><div className="value">{selected.part_number}</div></div>
              <div className="detail-item"><label>Part Name</label><div className="value">{selected.part_name}</div></div>
              <div className="detail-item"><label>Category</label><div className="value">{selected.category}</div></div>
              <div className="detail-item"><label>Manufacturer</label><div className="value">{selected.manufacturer}</div></div>
              <div className="detail-item"><label>Unit Cost</label><div className="value">${parseFloat(selected.unit_cost).toFixed(2)}</div></div>
              <div className="detail-item"><label>Quantity</label><div className="value">{selected.quantity}</div></div>
              <div className="detail-item"><label>Total Cost</label><div className="value" style={{color:'#60a5fa'}}>${parseFloat(selected.total_cost).toFixed(2)}</div></div>
              <div className="detail-item"><label>Supplier</label><div className="value">{selected.supplier}</div></div>
              <div className="detail-item detail-full"><label>Description</label><div className="value">{selected.description || 'N/A'}</div></div>
            </div>
            <button className="btn btn-ai" onClick={() => handleAiOptimize(selected.id)} disabled={aiLoading} style={{width:'100%',marginBottom:12}}>
              {aiLoading ? <><span className="spinner"></span>AI Analyzing...</> : 'AI Optimize This Item'}
            </button>
            {aiResult && <AIAnalysis content={aiResult} title="Item Optimization Analysis" />}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => { setForm({...selected}); setSelected(null); }}>Edit</button>
              <button className="btn btn-danger" onClick={() => handleDelete(selected.id)}>Delete</button>
              <button className="btn btn-secondary" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {form && (
        <div className="modal-overlay" onClick={() => setForm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{form.id ? 'Edit BOM Item' : 'New BOM Item'}</h2>
            <div className="form-grid">
              <div className="form-group"><label>Part Number</label><input value={form.part_number} onChange={e => setForm({...form, part_number: e.target.value})} /></div>
              <div className="form-group"><label>Part Name</label><input value={form.part_name} onChange={e => setForm({...form, part_name: e.target.value})} /></div>
              <div className="form-group"><label>Category</label><input value={form.category} onChange={e => setForm({...form, category: e.target.value})} /></div>
              <div className="form-group"><label>Manufacturer</label><input value={form.manufacturer} onChange={e => setForm({...form, manufacturer: e.target.value})} /></div>
              <div className="form-group"><label>Unit Cost</label><input type="number" step="0.01" value={form.unit_cost} onChange={e => setForm({...form, unit_cost: e.target.value})} /></div>
              <div className="form-group"><label>Quantity</label><input type="number" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} /></div>
              <div className="form-group"><label>Supplier</label><input value={form.supplier} onChange={e => setForm({...form, supplier: e.target.value})} /></div>
              <div className="form-group"><label>Status</label>
                <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                  <option value="active">Active</option><option value="inactive">Inactive</option><option value="discontinued">Discontinued</option>
                </select>
              </div>
              <div className="form-group form-full"><label>Description</label><textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3} /></div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setForm(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
