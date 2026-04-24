import React, { useState, useEffect } from 'react';
import api from '../services/api';
import AIAnalysis from '../components/AIAnalysis';

const emptyItem = { version_name: '', version_number: '', description: '', total_cost: '', total_items: '', change_type: '', changed_by: '', change_reason: '', baseline_version_id: '', cost_difference: '', status: 'draft' };

export default function BomVersions() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [error, setError] = useState('');

  const load = async () => { setLoading(true); try { const { data } = await api.get('/bomversions'); setItems(data); } catch (e) { setError(e.message); } setLoading(false); };
  useEffect(() => { load(); }, []);

  const handleSave = async () => { try { if (form.id) await api.put(`/bomversions/${form.id}`, form); else await api.post('/bomversions', form); setForm(null); load(); } catch (e) { setError(e.response?.data?.error || e.message); } };
  const handleDelete = async (id) => { if (!confirm('Delete this version?')) return; try { await api.delete(`/bomversions/${id}`); setSelected(null); load(); } catch (e) { setError(e.message); } };
  const handleAiCompare = async () => { setAiLoading(true); setAiResult(null); try { const { data } = await api.post('/bomversions/ai/compare'); setAiResult(data.analysis); } catch (e) { setError(e.message); } setAiLoading(false); };

  if (loading) return <div className="loading-container"><div className="spinner-lg"></div>Loading versions...</div>;

  const released = items.filter(i => i.status === 'released').length;
  const latestCost = items.length > 0 ? parseFloat(items[0].total_cost) : 0;

  return (
    <div>
      <div className="page-header"><h1>BOM Version Comparison</h1><div className="actions">
        <button className="btn btn-ai" onClick={handleAiCompare} disabled={aiLoading}>{aiLoading ? <><span className="spinner"></span>Comparing...</> : 'AI Compare All Versions'}</button>
        <button className="btn btn-primary" onClick={() => setForm({ ...emptyItem })}>+ New Version</button>
      </div></div>
      {error && <div className="error-message">{error} <button onClick={() => setError('')} style={{float:'right',background:'none',border:'none',color:'#f87171',cursor:'pointer'}}>x</button></div>}
      <div className="stats-bar">
        <div className="stat-card"><div className="stat-label">Total Versions</div><div className="stat-value">{items.length}</div></div>
        <div className="stat-card"><div className="stat-label">Released</div><div className="stat-value" style={{WebkitTextFillColor:'#4ade80'}}>{released}</div></div>
        <div className="stat-card"><div className="stat-label">Latest Cost</div><div className="stat-value">${latestCost.toLocaleString()}</div></div>
        <div className="stat-card"><div className="stat-label">Drafts</div><div className="stat-value">{items.filter(i => i.status === 'draft').length}</div></div>
      </div>

      {aiResult && <AIAnalysis content={aiResult} title="AI BOM Version Comparison" />}

      <div className="table-container" style={{marginTop:20}}>
        <table><thead><tr><th>Version</th><th>#</th><th>Change Type</th><th>Items</th><th>Total Cost</th><th>Cost Diff</th><th>Changed By</th><th>Status</th><th>Date</th></tr></thead>
        <tbody>{items.map(item => (
          <tr key={item.id} onClick={() => { setSelected(item); }}>
            <td style={{fontWeight:600,color:'#60a5fa'}}>{item.version_name}</td>
            <td style={{fontWeight:600}}>{item.version_number}</td>
            <td>{item.change_type}</td><td>{item.total_items}</td>
            <td style={{fontWeight:600}}>${parseFloat(item.total_cost).toLocaleString()}</td>
            <td style={{color: item.cost_difference > 0 ? '#f87171' : item.cost_difference < 0 ? '#4ade80' : '#94a3b8', fontWeight:600}}>
              {item.cost_difference ? `${item.cost_difference > 0 ? '+' : ''}$${parseFloat(item.cost_difference).toLocaleString()}` : '—'}
            </td>
            <td>{item.changed_by}</td>
            <td><span className={`badge badge-${item.status === 'released' ? 'success' : item.status === 'approved' ? 'active' : 'pending'}`}>{item.status}</span></td>
            <td>{new Date(item.created_at).toLocaleDateString()}</td>
          </tr>
        ))}</tbody></table>
      </div>

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <h2>BOM Version Details</h2>
            <div className="detail-grid">
              <div className="detail-item"><label>Version Name</label><div className="value">{selected.version_name}</div></div>
              <div className="detail-item"><label>Version Number</label><div className="value">{selected.version_number}</div></div>
              <div className="detail-item"><label>Change Type</label><div className="value">{selected.change_type}</div></div>
              <div className="detail-item"><label>Changed By</label><div className="value">{selected.changed_by}</div></div>
              <div className="detail-item"><label>Total Cost</label><div className="value">${parseFloat(selected.total_cost).toLocaleString()}</div></div>
              <div className="detail-item"><label>Cost Difference</label><div className="value" style={{color: selected.cost_difference > 0 ? '#f87171' : '#4ade80'}}>{selected.cost_difference ? `$${parseFloat(selected.cost_difference).toLocaleString()}` : 'N/A'}</div></div>
              <div className="detail-item"><label>Total Items</label><div className="value">{selected.total_items}</div></div>
              <div className="detail-item"><label>Status</label><div className="value"><span className={`badge badge-${selected.status === 'released' ? 'success' : selected.status === 'approved' ? 'active' : 'pending'}`}>{selected.status}</span></div></div>
              <div className="detail-item detail-full"><label>Description</label><div className="value">{selected.description}</div></div>
              <div className="detail-item detail-full"><label>Change Reason</label><div className="value">{selected.change_reason}</div></div>
            </div>
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
            <h2>{form.id ? 'Edit Version' : 'New BOM Version'}</h2>
            <div className="form-grid">
              <div className="form-group"><label>Version Name</label><input value={form.version_name} onChange={e => setForm({...form, version_name: e.target.value})} /></div>
              <div className="form-group"><label>Version Number</label><input value={form.version_number} onChange={e => setForm({...form, version_number: e.target.value})} placeholder="e.g. v2.7" /></div>
              <div className="form-group"><label>Total Cost</label><input type="number" step="0.01" value={form.total_cost} onChange={e => setForm({...form, total_cost: e.target.value})} /></div>
              <div className="form-group"><label>Total Items</label><input type="number" value={form.total_items} onChange={e => setForm({...form, total_items: e.target.value})} /></div>
              <div className="form-group"><label>Change Type</label><select value={form.change_type} onChange={e => setForm({...form, change_type: e.target.value})}><option value="">Select...</option><option value="Component Change">Component Change</option><option value="Supplier Change">Supplier Change</option><option value="Design Change">Design Change</option><option value="Cost Reduction">Cost Reduction</option><option value="Major Revision">Major Revision</option><option value="Price Update">Price Update</option><option value="Compliance">Compliance</option></select></div>
              <div className="form-group"><label>Changed By</label><input value={form.changed_by} onChange={e => setForm({...form, changed_by: e.target.value})} /></div>
              <div className="form-group"><label>Cost Difference</label><input type="number" step="0.01" value={form.cost_difference || ''} onChange={e => setForm({...form, cost_difference: e.target.value})} /></div>
              <div className="form-group"><label>Status</label><select value={form.status} onChange={e => setForm({...form, status: e.target.value})}><option value="draft">Draft</option><option value="approved">Approved</option><option value="released">Released</option><option value="obsolete">Obsolete</option></select></div>
              <div className="form-group form-full"><label>Description</label><textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={2} /></div>
              <div className="form-group form-full"><label>Change Reason</label><textarea value={form.change_reason} onChange={e => setForm({...form, change_reason: e.target.value})} rows={2} /></div>
            </div>
            <div className="modal-actions"><button className="btn btn-secondary" onClick={() => setForm(null)}>Cancel</button><button className="btn btn-primary" onClick={handleSave}>Save</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
