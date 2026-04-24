import React, { useState, useEffect } from 'react';
import api from '../services/api';
import AIAnalysis from '../components/AIAnalysis';

const emptyItem = { bom_item_id: '', risk_category: '', risk_score: '', probability: 'low', impact: 'low', supply_chain_risk: 'low', geopolitical_risk: 'low', single_source_risk: false, mitigation_plan: '', contingency_plan: '', risk_owner: '', review_date: '' };

export default function RiskAssessment() {
  const [items, setItems] = useState([]);
  const [bomItems, setBomItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [error, setError] = useState('');

  const load = async () => { setLoading(true); try { const [risks, bom] = await Promise.all([api.get('/risks'), api.get('/bom')]); setItems(risks.data); setBomItems(bom.data); } catch (e) { setError(e.message); } setLoading(false); };
  useEffect(() => { load(); }, []);

  const handleSave = async () => { try { if (form.id) await api.put(`/risks/${form.id}`, form); else await api.post('/risks', form); setForm(null); load(); } catch (e) { setError(e.response?.data?.error || e.message); } };
  const handleDelete = async (id) => { if (!confirm('Delete this assessment?')) return; try { await api.delete(`/risks/${id}`); setSelected(null); load(); } catch (e) { setError(e.message); } };
  const handleAi = async (bomItemId) => { setAiLoading(true); setAiResult(null); try { const { data } = await api.post(`/risks/ai/analyze/${bomItemId}`); setAiResult(data.analysis); } catch (e) { setError(e.message); } setAiLoading(false); };

  if (loading) return <div className="loading-container"><div className="spinner-lg"></div>Loading risk assessments...</div>;

  const highRisk = items.filter(i => parseFloat(i.risk_score) >= 70).length;
  const avgScore = items.reduce((s, i) => s + parseFloat(i.risk_score || 0), 0) / (items.length || 1);
  const singleSource = items.filter(i => i.single_source_risk).length;

  const riskColor = (score) => {
    const s = parseFloat(score);
    if (s >= 70) return '#f87171';
    if (s >= 40) return '#fbbf24';
    return '#4ade80';
  };

  return (
    <div>
      <div className="page-header"><h1>Risk Assessment</h1><div className="actions"><button className="btn btn-primary" onClick={() => setForm({ ...emptyItem })}>+ New Assessment</button></div></div>
      {error && <div className="error-message">{error} <button onClick={() => setError('')} style={{float:'right',background:'none',border:'none',color:'#f87171',cursor:'pointer'}}>x</button></div>}
      <div className="stats-bar">
        <div className="stat-card"><div className="stat-label">Total Assessments</div><div className="stat-value">{items.length}</div></div>
        <div className="stat-card"><div className="stat-label">High Risk (70+)</div><div className="stat-value" style={{WebkitTextFillColor:'#f87171'}}>{highRisk}</div></div>
        <div className="stat-card"><div className="stat-label">Avg Risk Score</div><div className="stat-value" style={{WebkitTextFillColor: riskColor(avgScore)}}>{avgScore.toFixed(0)}</div></div>
        <div className="stat-card"><div className="stat-label">Single Source</div><div className="stat-value" style={{WebkitTextFillColor:'#fbbf24'}}>{singleSource}</div></div>
      </div>
      <div className="table-container">
        <table><thead><tr><th>Part</th><th>Part #</th><th>Category</th><th>Score</th><th>Probability</th><th>Impact</th><th>Supply Chain</th><th>Geopolitical</th><th>Single Src</th><th>Owner</th></tr></thead>
        <tbody>{items.map(item => (
          <tr key={item.id} onClick={() => { setSelected(item); setAiResult(null); }}>
            <td>{item.part_name}</td><td style={{color:'#60a5fa',fontWeight:600}}>{item.part_number}</td>
            <td>{item.risk_category}</td>
            <td style={{fontWeight:700, color: riskColor(item.risk_score)}}>{parseFloat(item.risk_score).toFixed(0)}</td>
            <td><span className={`badge badge-${item.probability === 'high' ? 'danger' : item.probability === 'medium' ? 'warning' : 'success'}`}>{item.probability}</span></td>
            <td><span className={`badge badge-${item.impact === 'high' ? 'danger' : item.impact === 'medium' ? 'warning' : 'success'}`}>{item.impact}</span></td>
            <td><span className={`badge badge-${item.supply_chain_risk === 'high' ? 'danger' : item.supply_chain_risk === 'medium' ? 'warning' : 'success'}`}>{item.supply_chain_risk}</span></td>
            <td><span className={`badge badge-${item.geopolitical_risk === 'high' ? 'danger' : item.geopolitical_risk === 'medium' ? 'warning' : 'success'}`}>{item.geopolitical_risk}</span></td>
            <td style={{color: item.single_source_risk ? '#f87171' : '#4ade80'}}>{item.single_source_risk ? 'Yes' : 'No'}</td>
            <td>{item.risk_owner}</td>
          </tr>
        ))}</tbody></table>
      </div>

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <h2>Risk Assessment Details</h2>
            <div className="detail-grid">
              <div className="detail-item"><label>Part</label><div className="value">{selected.part_name} ({selected.part_number})</div></div>
              <div className="detail-item"><label>Risk Category</label><div className="value">{selected.risk_category}</div></div>
              <div className="detail-item"><label>Risk Score</label><div className="value" style={{color: riskColor(selected.risk_score), fontSize:24, fontWeight:800}}>{parseFloat(selected.risk_score).toFixed(0)}/100</div></div>
              <div className="detail-item"><label>Probability / Impact</label><div className="value">{selected.probability} / {selected.impact}</div></div>
              <div className="detail-item"><label>Supply Chain Risk</label><div className="value"><span className={`badge badge-${selected.supply_chain_risk === 'high' ? 'danger' : selected.supply_chain_risk === 'medium' ? 'warning' : 'success'}`}>{selected.supply_chain_risk}</span></div></div>
              <div className="detail-item"><label>Geopolitical Risk</label><div className="value"><span className={`badge badge-${selected.geopolitical_risk === 'high' ? 'danger' : selected.geopolitical_risk === 'medium' ? 'warning' : 'success'}`}>{selected.geopolitical_risk}</span></div></div>
              <div className="detail-item"><label>Single Source</label><div className="value" style={{color: selected.single_source_risk ? '#f87171' : '#4ade80'}}>{selected.single_source_risk ? 'Yes - HIGH RISK' : 'No'}</div></div>
              <div className="detail-item"><label>Risk Owner</label><div className="value">{selected.risk_owner}</div></div>
              <div className="detail-item"><label>Review Date</label><div className="value">{selected.review_date ? new Date(selected.review_date).toLocaleDateString() : 'N/A'}</div></div>
              <div className="detail-item"><label>Manufacturer</label><div className="value">{selected.manufacturer}</div></div>
              <div className="detail-item detail-full"><label>Mitigation Plan</label><div className="value">{selected.mitigation_plan}</div></div>
              <div className="detail-item detail-full"><label>Contingency Plan</label><div className="value">{selected.contingency_plan}</div></div>
            </div>
            <button className="btn btn-ai" onClick={() => handleAi(selected.bom_item_id)} disabled={aiLoading} style={{width:'100%',marginBottom:12}}>
              {aiLoading ? <><span className="spinner"></span>AI Analyzing Risks...</> : 'AI Deep Risk Analysis'}
            </button>
            {aiResult && <AIAnalysis content={aiResult} title="AI Risk Assessment" />}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => { setForm({...selected, review_date: selected.review_date?.split('T')[0] || ''}); setSelected(null); }}>Edit</button>
              <button className="btn btn-danger" onClick={() => handleDelete(selected.id)}>Delete</button>
              <button className="btn btn-secondary" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {form && (
        <div className="modal-overlay" onClick={() => setForm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{form.id ? 'Edit Assessment' : 'New Risk Assessment'}</h2>
            <div className="form-grid">
              <div className="form-group form-full"><label>BOM Item</label><select value={form.bom_item_id} onChange={e => setForm({...form, bom_item_id: e.target.value})}><option value="">Select...</option>{bomItems.map(b => <option key={b.id} value={b.id}>{b.part_name} ({b.part_number})</option>)}</select></div>
              <div className="form-group"><label>Risk Category</label><select value={form.risk_category} onChange={e => setForm({...form, risk_category: e.target.value})}><option value="">Select...</option><option value="Supply Chain">Supply Chain</option><option value="Obsolescence">Obsolescence</option><option value="Geopolitical">Geopolitical</option><option value="Quality">Quality</option><option value="Reliability">Reliability</option><option value="Financial">Financial</option></select></div>
              <div className="form-group"><label>Risk Score (0-100)</label><input type="number" step="0.01" max="100" value={form.risk_score} onChange={e => setForm({...form, risk_score: e.target.value})} /></div>
              <div className="form-group"><label>Probability</label><select value={form.probability} onChange={e => setForm({...form, probability: e.target.value})}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
              <div className="form-group"><label>Impact</label><select value={form.impact} onChange={e => setForm({...form, impact: e.target.value})}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
              <div className="form-group"><label>Supply Chain Risk</label><select value={form.supply_chain_risk} onChange={e => setForm({...form, supply_chain_risk: e.target.value})}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
              <div className="form-group"><label>Geopolitical Risk</label><select value={form.geopolitical_risk} onChange={e => setForm({...form, geopolitical_risk: e.target.value})}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
              <div className="form-group"><label>Single Source Risk</label><select value={form.single_source_risk} onChange={e => setForm({...form, single_source_risk: e.target.value === 'true'})}><option value="false">No</option><option value="true">Yes</option></select></div>
              <div className="form-group"><label>Risk Owner</label><input value={form.risk_owner} onChange={e => setForm({...form, risk_owner: e.target.value})} /></div>
              <div className="form-group"><label>Review Date</label><input type="date" value={form.review_date} onChange={e => setForm({...form, review_date: e.target.value})} /></div>
              <div className="form-group form-full"><label>Mitigation Plan</label><textarea value={form.mitigation_plan} onChange={e => setForm({...form, mitigation_plan: e.target.value})} rows={2} /></div>
              <div className="form-group form-full"><label>Contingency Plan</label><textarea value={form.contingency_plan} onChange={e => setForm({...form, contingency_plan: e.target.value})} rows={2} /></div>
            </div>
            <div className="modal-actions"><button className="btn btn-secondary" onClick={() => setForm(null)}>Cancel</button><button className="btn btn-primary" onClick={handleSave}>Save</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
