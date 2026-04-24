import React, { useState, useEffect } from 'react';
import api from '../services/api';
import AIAnalysis from '../components/AIAnalysis';

const emptyItem = { bom_item_id: '', risk_level: 'low', predicted_eol_date: '', confidence_score: '', lifecycle_stage: 'Active', last_buy_date: '', recommended_action: '', mitigation_strategy: '' };

export default function ObsolescencePredictions() {
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
      const [obs, bom] = await Promise.all([api.get('/obsolescence'), api.get('/bom')]);
      setItems(obs.data); setBomItems(bom.data);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    try {
      if (form.id) await api.put(`/obsolescence/${form.id}`, form);
      else await api.post('/obsolescence', form);
      setForm(null); load();
    } catch (e) { setError(e.response?.data?.error || e.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this prediction?')) return;
    try { await api.delete(`/obsolescence/${id}`); setSelected(null); load(); } catch (e) { setError(e.message); }
  };

  const handleAiPredict = async (bomItemId) => {
    setAiLoading(true); setAiResult(null);
    try { const { data } = await api.post(`/obsolescence/ai/predict/${bomItemId}`); setAiResult(data.analysis); } catch (e) { setError(e.message); }
    setAiLoading(false);
  };

  if (loading) return <div className="loading-container"><div className="spinner-lg"></div>Loading predictions...</div>;

  const high = items.filter(i => i.risk_level === 'high').length;
  const medium = items.filter(i => i.risk_level === 'medium').length;

  return (
    <div>
      <div className="page-header">
        <h1>Component Obsolescence Prediction</h1>
        <div className="actions">
          <button className="btn btn-primary" onClick={() => setForm({ ...emptyItem })}>+ New Prediction</button>
        </div>
      </div>
      {error && <div className="error-message">{error} <button onClick={() => setError('')} style={{float:'right',background:'none',border:'none',color:'#f87171',cursor:'pointer'}}>×</button></div>}

      <div className="stats-bar">
        <div className="stat-card"><div className="stat-label">Total Predictions</div><div className="stat-value">{items.length}</div></div>
        <div className="stat-card"><div className="stat-label">High Risk</div><div className="stat-value" style={{WebkitTextFillColor:'#f87171'}}>{high}</div></div>
        <div className="stat-card"><div className="stat-label">Medium Risk</div><div className="stat-value" style={{WebkitTextFillColor:'#fbbf24'}}>{medium}</div></div>
        <div className="stat-card"><div className="stat-label">Low Risk</div><div className="stat-value" style={{WebkitTextFillColor:'#4ade80'}}>{items.length - high - medium}</div></div>
      </div>

      <div className="table-container">
        <table>
          <thead><tr>
            <th>Part</th><th>Part #</th><th>Risk</th><th>EOL Date</th><th>Confidence</th><th>Lifecycle</th><th>Last Buy</th><th>Action</th>
          </tr></thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} onClick={() => { setSelected(item); setAiResult(null); }}>
                <td>{item.part_name}</td>
                <td style={{color:'#60a5fa',fontWeight:600}}>{item.part_number}</td>
                <td><span className={`badge badge-${item.risk_level}`}>{item.risk_level}</span></td>
                <td>{item.predicted_eol_date ? new Date(item.predicted_eol_date).toLocaleDateString() : 'N/A'}</td>
                <td>{parseFloat(item.confidence_score).toFixed(0)}%</td>
                <td>{item.lifecycle_stage}</td>
                <td>{item.last_buy_date ? new Date(item.last_buy_date).toLocaleDateString() : 'N/A'}</td>
                <td style={{fontSize:12,maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.recommended_action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <h2>Obsolescence Prediction Details</h2>
            <div className="detail-grid">
              <div className="detail-item"><label>Part</label><div className="value">{selected.part_name} ({selected.part_number})</div></div>
              <div className="detail-item"><label>Manufacturer</label><div className="value">{selected.manufacturer}</div></div>
              <div className="detail-item"><label>Risk Level</label><div className="value"><span className={`badge badge-${selected.risk_level}`}>{selected.risk_level}</span></div></div>
              <div className="detail-item"><label>Confidence</label><div className="value">{parseFloat(selected.confidence_score).toFixed(1)}%</div></div>
              <div className="detail-item"><label>Predicted EOL</label><div className="value">{selected.predicted_eol_date ? new Date(selected.predicted_eol_date).toLocaleDateString() : 'N/A'}</div></div>
              <div className="detail-item"><label>Lifecycle Stage</label><div className="value">{selected.lifecycle_stage}</div></div>
              <div className="detail-item"><label>Last Buy Date</label><div className="value">{selected.last_buy_date ? new Date(selected.last_buy_date).toLocaleDateString() : 'N/A'}</div></div>
              <div className="detail-item"><label>Category</label><div className="value">{selected.category}</div></div>
              <div className="detail-item detail-full"><label>Recommended Action</label><div className="value">{selected.recommended_action}</div></div>
              <div className="detail-item detail-full"><label>Mitigation Strategy</label><div className="value">{selected.mitigation_strategy}</div></div>
            </div>
            <button className="btn btn-ai" onClick={() => handleAiPredict(selected.bom_item_id)} disabled={aiLoading} style={{width:'100%',marginBottom:12}}>
              {aiLoading ? <><span className="spinner"></span>AI Predicting...</> : 'AI Analyze Obsolescence Risk'}
            </button>
            {aiResult && <AIAnalysis content={aiResult} title="AI Obsolescence Prediction" />}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => { setForm({...selected, predicted_eol_date: selected.predicted_eol_date?.split('T')[0] || '', last_buy_date: selected.last_buy_date?.split('T')[0] || ''}); setSelected(null); }}>Edit</button>
              <button className="btn btn-danger" onClick={() => handleDelete(selected.id)}>Delete</button>
              <button className="btn btn-secondary" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {form && (
        <div className="modal-overlay" onClick={() => setForm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{form.id ? 'Edit Prediction' : 'New Prediction'}</h2>
            <div className="form-grid">
              <div className="form-group form-full"><label>BOM Item</label>
                <select value={form.bom_item_id} onChange={e => setForm({...form, bom_item_id: e.target.value})}>
                  <option value="">Select BOM Item...</option>
                  {bomItems.map(b => <option key={b.id} value={b.id}>{b.part_name} ({b.part_number})</option>)}
                </select>
              </div>
              <div className="form-group"><label>Risk Level</label>
                <select value={form.risk_level} onChange={e => setForm({...form, risk_level: e.target.value})}>
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                </select>
              </div>
              <div className="form-group"><label>Confidence Score (%)</label><input type="number" step="0.01" value={form.confidence_score} onChange={e => setForm({...form, confidence_score: e.target.value})} /></div>
              <div className="form-group"><label>Predicted EOL Date</label><input type="date" value={form.predicted_eol_date} onChange={e => setForm({...form, predicted_eol_date: e.target.value})} /></div>
              <div className="form-group"><label>Lifecycle Stage</label>
                <select value={form.lifecycle_stage} onChange={e => setForm({...form, lifecycle_stage: e.target.value})}>
                  <option value="Active">Active</option><option value="Mature">Mature</option><option value="End of Life">End of Life</option><option value="Last Time Buy">Last Time Buy</option><option value="Obsolete">Obsolete</option>
                </select>
              </div>
              <div className="form-group"><label>Last Buy Date</label><input type="date" value={form.last_buy_date} onChange={e => setForm({...form, last_buy_date: e.target.value})} /></div>
              <div className="form-group form-full"><label>Recommended Action</label><textarea value={form.recommended_action} onChange={e => setForm({...form, recommended_action: e.target.value})} rows={2} /></div>
              <div className="form-group form-full"><label>Mitigation Strategy</label><textarea value={form.mitigation_strategy} onChange={e => setForm({...form, mitigation_strategy: e.target.value})} rows={2} /></div>
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
