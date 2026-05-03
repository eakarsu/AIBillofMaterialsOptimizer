import React, { useState, useEffect } from 'react';
import api from '../services/api';
import AIAnalysis from '../components/AIAnalysis';

const emptyItem = { bom_item_id: '', supplier: '', standard_lead_time_days: '', current_lead_time_days: '', expedited_lead_time_days: '', last_order_date: '', next_delivery_date: '', reliability_score: '', trend: 'stable', notes: '' };

export default function LeadTimeTracking() {
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
      const [lt, bom] = await Promise.all([
        api.get('/leadtime', { params: { limit: 200 } }),
        api.get('/bom', { params: { limit: 200 } }),
      ]);
      setItems(lt.data?.data || lt.data || []);
      setBomItems(bom.data?.data || bom.data || []);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    try {
      if (form.id) await api.put(`/leadtime/${form.id}`, form);
      else await api.post('/leadtime', form);
      setForm(null); load();
    } catch (e) { setError(e.response?.data?.error || e.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this record?')) return;
    try { await api.delete(`/leadtime/${id}`); setSelected(null); load(); } catch (e) { setError(e.message); }
  };

  const handleAiForecast = async (bomItemId) => {
    setAiLoading(true); setAiResult(null);
    try {
      const { data } = await api.post(`/leadtime/ai/forecast/${bomItemId}`);
      setAiResult(typeof data.data === 'object' ? JSON.stringify(data.data, null, 2) : data.analysis);
    } catch (e) { setError(e.message); }
    setAiLoading(false);
  };

  if (loading) return <div className="loading-container"><div className="spinner-lg"></div>Loading lead times...</div>;

  const avgLead = items.reduce((s, i) => s + (i.current_lead_time_days || 0), 0) / (items.length || 1);
  const increasing = items.filter(i => i.trend === 'increasing').length;

  return (
    <div>
      <div className="page-header">
        <h1>Lead Time Tracking</h1>
        <div className="actions">
          <button className="btn btn-primary" onClick={() => setForm({ ...emptyItem })}>+ New Record</button>
        </div>
      </div>
      {error && <div className="error-message">{error} <button onClick={() => setError('')} style={{float:'right',background:'none',border:'none',color:'#f87171',cursor:'pointer'}}>×</button></div>}

      <div className="stats-bar">
        <div className="stat-card"><div className="stat-label">Total Records</div><div className="stat-value">{items.length}</div></div>
        <div className="stat-card"><div className="stat-label">Avg Lead Time</div><div className="stat-value">{avgLead.toFixed(0)}d</div></div>
        <div className="stat-card"><div className="stat-label">Increasing Trend</div><div className="stat-value" style={{WebkitTextFillColor:'#f87171'}}>{increasing}</div></div>
        <div className="stat-card"><div className="stat-label">Avg Reliability</div><div className="stat-value">{(items.reduce((s, i) => s + parseFloat(i.reliability_score || 0), 0) / (items.length || 1)).toFixed(0)}%</div></div>
      </div>

      <div className="table-container">
        <table>
          <thead><tr>
            <th>Part</th><th>Part #</th><th>Supplier</th><th>Standard</th><th>Current</th><th>Expedited</th><th>Reliability</th><th>Trend</th><th>Next Delivery</th>
          </tr></thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} onClick={() => { setSelected(item); setAiResult(null); }}>
                <td>{item.part_name}</td>
                <td style={{color:'#60a5fa',fontWeight:600}}>{item.part_number}</td>
                <td>{item.supplier}</td>
                <td>{item.standard_lead_time_days}d</td>
                <td style={{fontWeight:600, color: item.current_lead_time_days > item.standard_lead_time_days ? '#f87171' : '#4ade80'}}>{item.current_lead_time_days}d</td>
                <td>{item.expedited_lead_time_days}d</td>
                <td>{parseFloat(item.reliability_score).toFixed(0)}%</td>
                <td><span className={`badge badge-${item.trend}`}>{item.trend}</span></td>
                <td>{item.next_delivery_date ? new Date(item.next_delivery_date).toLocaleDateString() : 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <h2>Lead Time Details</h2>
            <div className="detail-grid">
              <div className="detail-item"><label>Part</label><div className="value">{selected.part_name} ({selected.part_number})</div></div>
              <div className="detail-item"><label>Supplier</label><div className="value">{selected.supplier}</div></div>
              <div className="detail-item"><label>Standard Lead Time</label><div className="value">{selected.standard_lead_time_days} days</div></div>
              <div className="detail-item"><label>Current Lead Time</label><div className="value" style={{color: selected.current_lead_time_days > selected.standard_lead_time_days ? '#f87171' : '#4ade80'}}>{selected.current_lead_time_days} days</div></div>
              <div className="detail-item"><label>Expedited Lead Time</label><div className="value">{selected.expedited_lead_time_days} days</div></div>
              <div className="detail-item"><label>Reliability Score</label><div className="value">{parseFloat(selected.reliability_score).toFixed(1)}%</div></div>
              <div className="detail-item"><label>Trend</label><div className="value"><span className={`badge badge-${selected.trend}`}>{selected.trend}</span></div></div>
              <div className="detail-item"><label>Last Order</label><div className="value">{selected.last_order_date ? new Date(selected.last_order_date).toLocaleDateString() : 'N/A'}</div></div>
              <div className="detail-item"><label>Next Delivery</label><div className="value">{selected.next_delivery_date ? new Date(selected.next_delivery_date).toLocaleDateString() : 'N/A'}</div></div>
              <div className="detail-item"><label>Category</label><div className="value">{selected.category}</div></div>
              <div className="detail-item detail-full"><label>Notes</label><div className="value">{selected.notes || 'N/A'}</div></div>
            </div>
            <button className="btn btn-ai" onClick={() => handleAiForecast(selected.bom_item_id)} disabled={aiLoading} style={{width:'100%',marginBottom:12}}>
              {aiLoading ? <><span className="spinner"></span>AI Forecasting...</> : 'AI Forecast Lead Times'}
            </button>
            {aiResult && <AIAnalysis content={aiResult} title="AI Lead Time Forecast" />}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => { setForm({...selected, last_order_date: selected.last_order_date?.split('T')[0] || '', next_delivery_date: selected.next_delivery_date?.split('T')[0] || ''}); setSelected(null); }}>Edit</button>
              <button className="btn btn-danger" onClick={() => handleDelete(selected.id)}>Delete</button>
              <button className="btn btn-secondary" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {form && (
        <div className="modal-overlay" onClick={() => setForm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{form.id ? 'Edit Lead Time Record' : 'New Lead Time Record'}</h2>
            <div className="form-grid">
              <div className="form-group form-full"><label>BOM Item</label>
                <select value={form.bom_item_id} onChange={e => setForm({...form, bom_item_id: e.target.value})}>
                  <option value="">Select BOM Item...</option>
                  {bomItems.map(b => <option key={b.id} value={b.id}>{b.part_name} ({b.part_number})</option>)}
                </select>
              </div>
              <div className="form-group"><label>Supplier</label><input value={form.supplier} onChange={e => setForm({...form, supplier: e.target.value})} /></div>
              <div className="form-group"><label>Standard Lead Time (days)</label><input type="number" value={form.standard_lead_time_days} onChange={e => setForm({...form, standard_lead_time_days: e.target.value})} /></div>
              <div className="form-group"><label>Current Lead Time (days)</label><input type="number" value={form.current_lead_time_days} onChange={e => setForm({...form, current_lead_time_days: e.target.value})} /></div>
              <div className="form-group"><label>Expedited Lead Time (days)</label><input type="number" value={form.expedited_lead_time_days} onChange={e => setForm({...form, expedited_lead_time_days: e.target.value})} /></div>
              <div className="form-group"><label>Reliability Score (%)</label><input type="number" step="0.01" value={form.reliability_score} onChange={e => setForm({...form, reliability_score: e.target.value})} /></div>
              <div className="form-group"><label>Last Order Date</label><input type="date" value={form.last_order_date} onChange={e => setForm({...form, last_order_date: e.target.value})} /></div>
              <div className="form-group"><label>Next Delivery Date</label><input type="date" value={form.next_delivery_date} onChange={e => setForm({...form, next_delivery_date: e.target.value})} /></div>
              <div className="form-group"><label>Trend</label>
                <select value={form.trend} onChange={e => setForm({...form, trend: e.target.value})}>
                  <option value="stable">Stable</option><option value="increasing">Increasing</option><option value="decreasing">Decreasing</option>
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
