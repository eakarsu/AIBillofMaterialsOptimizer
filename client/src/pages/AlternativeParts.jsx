import React, { useState, useEffect } from 'react';
import api from '../services/api';
import AIAnalysis from '../components/AIAnalysis';

const emptyItem = { original_part_id: '', alt_part_number: '', alt_part_name: '', alt_manufacturer: '', alt_unit_cost: '', alt_supplier: '', compatibility_score: '', cost_savings_percent: '', lead_time_days: '', notes: '', status: 'pending' };

export default function AlternativeParts() {
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
      const [alts, bom] = await Promise.all([api.get('/alternatives'), api.get('/bom')]);
      setItems(alts.data); setBomItems(bom.data);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    try {
      if (form.id) await api.put(`/alternatives/${form.id}`, form);
      else await api.post('/alternatives', form);
      setForm(null); load();
    } catch (e) { setError(e.response?.data?.error || e.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this alternative part?')) return;
    try { await api.delete(`/alternatives/${id}`); setSelected(null); load(); } catch (e) { setError(e.message); }
  };

  const handleAiFind = async (bomItemId) => {
    setAiLoading(true); setAiResult(null);
    try { const { data } = await api.post(`/alternatives/ai/find/${bomItemId}`); setAiResult(data.analysis); } catch (e) { setError(e.message); }
    setAiLoading(false);
  };

  if (loading) return <div className="loading-container"><div className="spinner-lg"></div>Loading alternatives...</div>;

  const approved = items.filter(i => i.status === 'approved').length;
  const avgSavings = items.reduce((s, i) => s + parseFloat(i.cost_savings_percent || 0), 0) / (items.length || 1);

  return (
    <div>
      <div className="page-header">
        <h1>Alternative Part Sourcing</h1>
        <div className="actions">
          <button className="btn btn-primary" onClick={() => setForm({ ...emptyItem })}>+ New Alternative</button>
        </div>
      </div>
      {error && <div className="error-message">{error} <button onClick={() => setError('')} style={{float:'right',background:'none',border:'none',color:'#f87171',cursor:'pointer'}}>×</button></div>}

      <div className="stats-bar">
        <div className="stat-card"><div className="stat-label">Total Alternatives</div><div className="stat-value">{items.length}</div></div>
        <div className="stat-card"><div className="stat-label">Approved</div><div className="stat-value">{approved}</div></div>
        <div className="stat-card"><div className="stat-label">Avg Savings</div><div className="stat-value">{avgSavings.toFixed(1)}%</div></div>
        <div className="stat-card"><div className="stat-label">Pending Review</div><div className="stat-value">{items.filter(i => i.status === 'pending').length}</div></div>
      </div>

      <div className="table-container">
        <table>
          <thead><tr>
            <th>Original Part</th><th>Alt Part #</th><th>Alt Name</th><th>Manufacturer</th><th>Cost</th><th>Original Cost</th><th>Savings</th><th>Compatibility</th><th>Lead Time</th><th>Status</th>
          </tr></thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} onClick={() => { setSelected(item); setAiResult(null); }}>
                <td style={{color:'#60a5fa'}}>{item.original_part_name}</td>
                <td style={{fontWeight:600}}>{item.alt_part_number}</td>
                <td>{item.alt_part_name}</td>
                <td>{item.alt_manufacturer}</td>
                <td>${parseFloat(item.alt_unit_cost).toFixed(2)}</td>
                <td>${parseFloat(item.original_unit_cost).toFixed(2)}</td>
                <td style={{color:'#4ade80',fontWeight:600}}>{parseFloat(item.cost_savings_percent).toFixed(1)}%</td>
                <td>{parseFloat(item.compatibility_score).toFixed(0)}%</td>
                <td>{item.lead_time_days}d</td>
                <td><span className={`badge badge-${item.status}`}>{item.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <h2>Alternative Part Details</h2>
            <div className="detail-grid">
              <div className="detail-item"><label>Original Part</label><div className="value">{selected.original_part_name} ({selected.original_part_number})</div></div>
              <div className="detail-item"><label>Original Cost</label><div className="value">${parseFloat(selected.original_unit_cost).toFixed(2)}</div></div>
              <div className="detail-item"><label>Alt Part Number</label><div className="value">{selected.alt_part_number}</div></div>
              <div className="detail-item"><label>Alt Part Name</label><div className="value">{selected.alt_part_name}</div></div>
              <div className="detail-item"><label>Manufacturer</label><div className="value">{selected.alt_manufacturer}</div></div>
              <div className="detail-item"><label>Alt Unit Cost</label><div className="value" style={{color:'#4ade80'}}>${parseFloat(selected.alt_unit_cost).toFixed(2)}</div></div>
              <div className="detail-item"><label>Supplier</label><div className="value">{selected.alt_supplier}</div></div>
              <div className="detail-item"><label>Compatibility</label><div className="value">{parseFloat(selected.compatibility_score).toFixed(0)}%</div></div>
              <div className="detail-item"><label>Cost Savings</label><div className="value" style={{color:'#4ade80'}}>{parseFloat(selected.cost_savings_percent).toFixed(1)}%</div></div>
              <div className="detail-item"><label>Lead Time</label><div className="value">{selected.lead_time_days} days</div></div>
              <div className="detail-item detail-full"><label>Notes</label><div className="value">{selected.notes || 'N/A'}</div></div>
            </div>
            <button className="btn btn-ai" onClick={() => handleAiFind(selected.original_part_id)} disabled={aiLoading} style={{width:'100%',marginBottom:12}}>
              {aiLoading ? <><span className="spinner"></span>Finding Alternatives...</> : 'AI Find More Alternatives'}
            </button>
            {aiResult && <AIAnalysis content={aiResult} title="AI Alternative Part Sourcing" />}
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
            <h2>{form.id ? 'Edit Alternative Part' : 'New Alternative Part'}</h2>
            <div className="form-grid">
              <div className="form-group form-full"><label>Original BOM Item</label>
                <select value={form.original_part_id} onChange={e => setForm({...form, original_part_id: e.target.value})}>
                  <option value="">Select BOM Item...</option>
                  {bomItems.map(b => <option key={b.id} value={b.id}>{b.part_name} ({b.part_number})</option>)}
                </select>
              </div>
              <div className="form-group"><label>Alt Part Number</label><input value={form.alt_part_number} onChange={e => setForm({...form, alt_part_number: e.target.value})} /></div>
              <div className="form-group"><label>Alt Part Name</label><input value={form.alt_part_name} onChange={e => setForm({...form, alt_part_name: e.target.value})} /></div>
              <div className="form-group"><label>Manufacturer</label><input value={form.alt_manufacturer} onChange={e => setForm({...form, alt_manufacturer: e.target.value})} /></div>
              <div className="form-group"><label>Unit Cost</label><input type="number" step="0.01" value={form.alt_unit_cost} onChange={e => setForm({...form, alt_unit_cost: e.target.value})} /></div>
              <div className="form-group"><label>Supplier</label><input value={form.alt_supplier} onChange={e => setForm({...form, alt_supplier: e.target.value})} /></div>
              <div className="form-group"><label>Compatibility Score (%)</label><input type="number" step="0.01" value={form.compatibility_score} onChange={e => setForm({...form, compatibility_score: e.target.value})} /></div>
              <div className="form-group"><label>Cost Savings (%)</label><input type="number" step="0.01" value={form.cost_savings_percent} onChange={e => setForm({...form, cost_savings_percent: e.target.value})} /></div>
              <div className="form-group"><label>Lead Time (days)</label><input type="number" value={form.lead_time_days} onChange={e => setForm({...form, lead_time_days: e.target.value})} /></div>
              <div className="form-group"><label>Status</label>
                <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                  <option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
                </select>
              </div>
              <div className="form-group form-full"><label>Notes</label><textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={3} /></div>
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
