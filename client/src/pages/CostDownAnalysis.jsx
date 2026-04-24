import React, { useState, useEffect } from 'react';
import api from '../services/api';
import AIAnalysis from '../components/AIAnalysis';

const emptyItem = { bom_item_id: '', analysis_type: '', current_cost: '', target_cost: '', achieved_cost: '', savings_amount: '', savings_percent: '', strategy: '', implementation_status: 'proposed', priority: 'medium' };

export default function CostDownAnalysis() {
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
      const [cd, bom] = await Promise.all([api.get('/costdown'), api.get('/bom')]);
      setItems(cd.data); setBomItems(bom.data);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    try {
      if (form.id) await api.put(`/costdown/${form.id}`, form);
      else await api.post('/costdown', form);
      setForm(null); load();
    } catch (e) { setError(e.response?.data?.error || e.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this analysis?')) return;
    try { await api.delete(`/costdown/${id}`); setSelected(null); load(); } catch (e) { setError(e.message); }
  };

  const handleAiAnalyze = async (bomItemId) => {
    setAiLoading(true); setAiResult(null);
    try { const { data } = await api.post(`/costdown/ai/analyze/${bomItemId}`); setAiResult(data.analysis); } catch (e) { setError(e.message); }
    setAiLoading(false);
  };

  if (loading) return <div className="loading-container"><div className="spinner-lg"></div>Loading analyses...</div>;

  const totalSavings = items.reduce((s, i) => s + parseFloat(i.savings_amount || 0), 0);
  const implemented = items.filter(i => i.implementation_status === 'implemented').length;

  return (
    <div>
      <div className="page-header">
        <h1>Cost-Down Analysis</h1>
        <div className="actions">
          <button className="btn btn-primary" onClick={() => setForm({ ...emptyItem })}>+ New Analysis</button>
        </div>
      </div>
      {error && <div className="error-message">{error} <button onClick={() => setError('')} style={{float:'right',background:'none',border:'none',color:'#f87171',cursor:'pointer'}}>×</button></div>}

      <div className="stats-bar">
        <div className="stat-card"><div className="stat-label">Total Analyses</div><div className="stat-value">{items.length}</div></div>
        <div className="stat-card"><div className="stat-label">Total Savings</div><div className="stat-value">${totalSavings.toLocaleString('en-US', {minimumFractionDigits: 2})}</div></div>
        <div className="stat-card"><div className="stat-label">Implemented</div><div className="stat-value" style={{WebkitTextFillColor:'#4ade80'}}>{implemented}</div></div>
        <div className="stat-card"><div className="stat-label">Proposed</div><div className="stat-value">{items.filter(i => i.implementation_status === 'proposed').length}</div></div>
      </div>

      <div className="table-container">
        <table>
          <thead><tr>
            <th>Part</th><th>Type</th><th>Current Cost</th><th>Target</th><th>Achieved</th><th>Savings</th><th>Savings %</th><th>Priority</th><th>Status</th>
          </tr></thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} onClick={() => { setSelected(item); setAiResult(null); }}>
                <td>{item.part_name}</td>
                <td style={{fontWeight:600}}>{item.analysis_type}</td>
                <td>${parseFloat(item.current_cost).toFixed(2)}</td>
                <td>${parseFloat(item.target_cost).toFixed(2)}</td>
                <td>{item.achieved_cost ? `$${parseFloat(item.achieved_cost).toFixed(2)}` : '—'}</td>
                <td style={{color:'#4ade80',fontWeight:600}}>{item.savings_amount ? `$${parseFloat(item.savings_amount).toFixed(2)}` : '—'}</td>
                <td>{item.savings_percent ? `${parseFloat(item.savings_percent).toFixed(1)}%` : '—'}</td>
                <td><span className={`badge badge-${item.priority}`}>{item.priority}</span></td>
                <td><span className={`badge badge-${item.implementation_status}`}>{item.implementation_status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <h2>Cost-Down Analysis Details</h2>
            <div className="detail-grid">
              <div className="detail-item"><label>Part</label><div className="value">{selected.part_name} ({selected.part_number})</div></div>
              <div className="detail-item"><label>Analysis Type</label><div className="value">{selected.analysis_type}</div></div>
              <div className="detail-item"><label>Current Cost</label><div className="value">${parseFloat(selected.current_cost).toFixed(2)}</div></div>
              <div className="detail-item"><label>Target Cost</label><div className="value">${parseFloat(selected.target_cost).toFixed(2)}</div></div>
              <div className="detail-item"><label>Achieved Cost</label><div className="value">{selected.achieved_cost ? `$${parseFloat(selected.achieved_cost).toFixed(2)}` : 'Pending'}</div></div>
              <div className="detail-item"><label>Savings</label><div className="value" style={{color:'#4ade80'}}>{selected.savings_amount ? `$${parseFloat(selected.savings_amount).toFixed(2)} (${parseFloat(selected.savings_percent).toFixed(1)}%)` : 'Pending'}</div></div>
              <div className="detail-item"><label>Priority</label><div className="value"><span className={`badge badge-${selected.priority}`}>{selected.priority}</span></div></div>
              <div className="detail-item"><label>Status</label><div className="value"><span className={`badge badge-${selected.implementation_status}`}>{selected.implementation_status}</span></div></div>
              <div className="detail-item detail-full"><label>Strategy</label><div className="value">{selected.strategy}</div></div>
            </div>
            <button className="btn btn-ai" onClick={() => handleAiAnalyze(selected.bom_item_id)} disabled={aiLoading} style={{width:'100%',marginBottom:12}}>
              {aiLoading ? <><span className="spinner"></span>AI Analyzing...</> : 'AI Generate Cost-Down Strategies'}
            </button>
            {aiResult && <AIAnalysis content={aiResult} title="AI Cost-Down Analysis" />}
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
            <h2>{form.id ? 'Edit Analysis' : 'New Cost-Down Analysis'}</h2>
            <div className="form-grid">
              <div className="form-group form-full"><label>BOM Item</label>
                <select value={form.bom_item_id} onChange={e => setForm({...form, bom_item_id: e.target.value})}>
                  <option value="">Select BOM Item...</option>
                  {bomItems.map(b => <option key={b.id} value={b.id}>{b.part_name} ({b.part_number})</option>)}
                </select>
              </div>
              <div className="form-group"><label>Analysis Type</label>
                <select value={form.analysis_type} onChange={e => setForm({...form, analysis_type: e.target.value})}>
                  <option value="">Select Type...</option>
                  <option value="Alternative Sourcing">Alternative Sourcing</option>
                  <option value="Volume Negotiation">Volume Negotiation</option>
                  <option value="Supplier Switch">Supplier Switch</option>
                  <option value="Design Change">Design Change</option>
                  <option value="Competitive Bidding">Competitive Bidding</option>
                  <option value="Redesign">Redesign</option>
                  <option value="Value Engineering">Value Engineering</option>
                  <option value="Lifecycle Management">Lifecycle Management</option>
                </select>
              </div>
              <div className="form-group"><label>Current Cost</label><input type="number" step="0.01" value={form.current_cost} onChange={e => setForm({...form, current_cost: e.target.value})} /></div>
              <div className="form-group"><label>Target Cost</label><input type="number" step="0.01" value={form.target_cost} onChange={e => setForm({...form, target_cost: e.target.value})} /></div>
              <div className="form-group"><label>Achieved Cost</label><input type="number" step="0.01" value={form.achieved_cost || ''} onChange={e => setForm({...form, achieved_cost: e.target.value})} /></div>
              <div className="form-group"><label>Savings Amount</label><input type="number" step="0.01" value={form.savings_amount || ''} onChange={e => setForm({...form, savings_amount: e.target.value})} /></div>
              <div className="form-group"><label>Savings %</label><input type="number" step="0.01" value={form.savings_percent || ''} onChange={e => setForm({...form, savings_percent: e.target.value})} /></div>
              <div className="form-group"><label>Priority</label>
                <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                </select>
              </div>
              <div className="form-group"><label>Status</label>
                <select value={form.implementation_status} onChange={e => setForm({...form, implementation_status: e.target.value})}>
                  <option value="proposed">Proposed</option><option value="in_progress">In Progress</option><option value="implemented">Implemented</option><option value="rejected">Rejected</option>
                </select>
              </div>
              <div className="form-group form-full"><label>Strategy</label><textarea value={form.strategy} onChange={e => setForm({...form, strategy: e.target.value})} rows={3} /></div>
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
