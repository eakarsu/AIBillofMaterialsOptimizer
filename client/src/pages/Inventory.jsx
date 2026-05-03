import React, { useState, useEffect } from 'react';
import api from '../services/api';
import AIAnalysis from '../components/AIAnalysis';

const emptyItem = { bom_item_id: '', warehouse_location: '', current_stock: '', minimum_stock: '', reorder_point: '', reorder_quantity: '', max_stock: '', unit_of_measure: 'pcs', last_restock_date: '', next_restock_date: '', stock_status: 'in_stock', holding_cost_per_unit: '' };

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [bomItems, setBomItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [inv, bom] = await Promise.all([
        api.get('/inventory', { params: { limit: 200 } }),
        api.get('/bom', { params: { limit: 200 } }),
      ]);
      setItems(inv.data?.data || inv.data || []);
      setBomItems(bom.data?.data || bom.data || []);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleSave = async () => { try { if (form.id) await api.put(`/inventory/${form.id}`, form); else await api.post('/inventory', form); setForm(null); load(); } catch (e) { setError(e.response?.data?.error || e.message); } };
  const handleDelete = async (id) => { if (!confirm('Delete this record?')) return; try { await api.delete(`/inventory/${id}`); setSelected(null); load(); } catch (e) { setError(e.message); } };
  const handleAi = async (id) => {
    setAiLoading(true); setAiResult(null);
    try {
      const { data } = await api.post(`/inventory/ai/optimize/${id}`);
      setAiResult(typeof data.data === 'object' ? JSON.stringify(data.data, null, 2) : data.analysis);
    } catch (e) { setError(e.message); }
    setAiLoading(false);
  };

  if (loading) return <div className="loading-container"><div className="spinner-lg"></div>Loading inventory...</div>;

  const critical = items.filter(i => i.stock_status === 'critical').length;
  const lowStock = items.filter(i => i.stock_status === 'low_stock').length;

  return (
    <div>
      <div className="page-header"><h1>Inventory Management</h1><div className="actions"><button className="btn btn-primary" onClick={() => setForm({ ...emptyItem })}>+ New Record</button></div></div>
      {error && <div className="error-message">{error} <button onClick={() => setError('')} style={{float:'right',background:'none',border:'none',color:'#f87171',cursor:'pointer'}}>x</button></div>}
      <div className="stats-bar">
        <div className="stat-card"><div className="stat-label">Total Records</div><div className="stat-value">{items.length}</div></div>
        <div className="stat-card"><div className="stat-label">Critical</div><div className="stat-value" style={{WebkitTextFillColor:'#f87171'}}>{critical}</div></div>
        <div className="stat-card"><div className="stat-label">Low Stock</div><div className="stat-value" style={{WebkitTextFillColor:'#fbbf24'}}>{lowStock}</div></div>
        <div className="stat-card"><div className="stat-label">In Stock</div><div className="stat-value" style={{WebkitTextFillColor:'#4ade80'}}>{items.length - critical - lowStock}</div></div>
      </div>
      <div className="table-container">
        <table><thead><tr><th>Part</th><th>Part #</th><th>Warehouse</th><th>Current</th><th>Min</th><th>Reorder Pt</th><th>Max</th><th>Holding $/u</th><th>Status</th></tr></thead>
        <tbody>{items.map(item => (
          <tr key={item.id} onClick={() => { setSelected(item); setAiResult(null); }}>
            <td>{item.part_name}</td><td style={{color:'#60a5fa',fontWeight:600}}>{item.part_number}</td>
            <td>{item.warehouse_location}</td>
            <td style={{fontWeight:600, color: item.current_stock <= item.minimum_stock ? '#f87171' : '#4ade80'}}>{item.current_stock}</td>
            <td>{item.minimum_stock}</td><td>{item.reorder_point}</td><td>{item.max_stock}</td>
            <td>${parseFloat(item.holding_cost_per_unit).toFixed(3)}</td>
            <td><span className={`badge badge-${item.stock_status === 'in_stock' ? 'success' : item.stock_status === 'low_stock' ? 'warning' : 'danger'}`}>{item.stock_status}</span></td>
          </tr>
        ))}</tbody></table>
      </div>

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <h2>Inventory Details</h2>
            <div className="detail-grid">
              <div className="detail-item"><label>Part</label><div className="value">{selected.part_name} ({selected.part_number})</div></div>
              <div className="detail-item"><label>Warehouse</label><div className="value">{selected.warehouse_location}</div></div>
              <div className="detail-item"><label>Current Stock</label><div className="value" style={{color: selected.current_stock <= selected.minimum_stock ? '#f87171' : '#4ade80'}}>{selected.current_stock} {selected.unit_of_measure}</div></div>
              <div className="detail-item"><label>Min / Max Stock</label><div className="value">{selected.minimum_stock} / {selected.max_stock}</div></div>
              <div className="detail-item"><label>Reorder Point</label><div className="value">{selected.reorder_point}</div></div>
              <div className="detail-item"><label>Reorder Quantity</label><div className="value">{selected.reorder_quantity}</div></div>
              <div className="detail-item"><label>Holding Cost</label><div className="value">${parseFloat(selected.holding_cost_per_unit).toFixed(3)}/unit</div></div>
              <div className="detail-item"><label>Status</label><div className="value"><span className={`badge badge-${selected.stock_status === 'in_stock' ? 'success' : selected.stock_status === 'low_stock' ? 'warning' : 'danger'}`}>{selected.stock_status}</span></div></div>
              <div className="detail-item"><label>Last Restock</label><div className="value">{selected.last_restock_date ? new Date(selected.last_restock_date).toLocaleDateString() : 'N/A'}</div></div>
              <div className="detail-item"><label>Next Restock</label><div className="value">{selected.next_restock_date ? new Date(selected.next_restock_date).toLocaleDateString() : 'N/A'}</div></div>
            </div>
            <button className="btn btn-ai" onClick={() => handleAi(selected.id)} disabled={aiLoading} style={{width:'100%',marginBottom:12}}>
              {aiLoading ? <><span className="spinner"></span>AI Optimizing...</> : 'AI Optimize Inventory Levels'}
            </button>
            {aiResult && <AIAnalysis content={aiResult} title="AI Inventory Optimization" />}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => { setForm({...selected, last_restock_date: selected.last_restock_date?.split('T')[0] || '', next_restock_date: selected.next_restock_date?.split('T')[0] || ''}); setSelected(null); }}>Edit</button>
              <button className="btn btn-danger" onClick={() => handleDelete(selected.id)}>Delete</button>
              <button className="btn btn-secondary" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {form && (
        <div className="modal-overlay" onClick={() => setForm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{form.id ? 'Edit Inventory Record' : 'New Inventory Record'}</h2>
            <div className="form-grid">
              <div className="form-group form-full"><label>BOM Item</label><select value={form.bom_item_id} onChange={e => setForm({...form, bom_item_id: e.target.value})}><option value="">Select...</option>{bomItems.map(b => <option key={b.id} value={b.id}>{b.part_name} ({b.part_number})</option>)}</select></div>
              <div className="form-group"><label>Warehouse Location</label><input value={form.warehouse_location} onChange={e => setForm({...form, warehouse_location: e.target.value})} /></div>
              <div className="form-group"><label>Current Stock</label><input type="number" value={form.current_stock} onChange={e => setForm({...form, current_stock: e.target.value})} /></div>
              <div className="form-group"><label>Minimum Stock</label><input type="number" value={form.minimum_stock} onChange={e => setForm({...form, minimum_stock: e.target.value})} /></div>
              <div className="form-group"><label>Reorder Point</label><input type="number" value={form.reorder_point} onChange={e => setForm({...form, reorder_point: e.target.value})} /></div>
              <div className="form-group"><label>Reorder Quantity</label><input type="number" value={form.reorder_quantity} onChange={e => setForm({...form, reorder_quantity: e.target.value})} /></div>
              <div className="form-group"><label>Max Stock</label><input type="number" value={form.max_stock} onChange={e => setForm({...form, max_stock: e.target.value})} /></div>
              <div className="form-group"><label>Holding Cost/Unit</label><input type="number" step="0.001" value={form.holding_cost_per_unit} onChange={e => setForm({...form, holding_cost_per_unit: e.target.value})} /></div>
              <div className="form-group"><label>Last Restock</label><input type="date" value={form.last_restock_date} onChange={e => setForm({...form, last_restock_date: e.target.value})} /></div>
              <div className="form-group"><label>Next Restock</label><input type="date" value={form.next_restock_date} onChange={e => setForm({...form, next_restock_date: e.target.value})} /></div>
              <div className="form-group"><label>Status</label><select value={form.stock_status} onChange={e => setForm({...form, stock_status: e.target.value})}><option value="in_stock">In Stock</option><option value="low_stock">Low Stock</option><option value="critical">Critical</option><option value="out_of_stock">Out of Stock</option></select></div>
              <div className="form-group"><label>Unit of Measure</label><input value={form.unit_of_measure} onChange={e => setForm({...form, unit_of_measure: e.target.value})} /></div>
            </div>
            <div className="modal-actions"><button className="btn btn-secondary" onClick={() => setForm(null)}>Cancel</button><button className="btn btn-primary" onClick={handleSave}>Save</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
