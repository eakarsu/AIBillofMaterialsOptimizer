import React, { useState, useEffect } from 'react';
import api from '../services/api';
import AIAnalysis from '../components/AIAnalysis';

const emptyItem = { bom_item_id: '', regulation_type: '', compliance_status: 'compliant', certificate_number: '', expiry_date: '', testing_lab: '', test_date: '', rohs_compliant: false, reach_compliant: false, conflict_mineral_free: false, documentation_url: '', notes: '' };

export default function Compliance() {
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
      const [comp, bom] = await Promise.all([
        api.get('/compliance', { params: { limit: 200 } }),
        api.get('/bom', { params: { limit: 200 } }),
      ]);
      setItems(comp.data?.data || comp.data || []);
      setBomItems(bom.data?.data || bom.data || []);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleSave = async () => { try { if (form.id) await api.put(`/compliance/${form.id}`, form); else await api.post('/compliance', form); setForm(null); load(); } catch (e) { setError(e.response?.data?.error || e.message); } };
  const handleDelete = async (id) => { if (!confirm('Delete this record?')) return; try { await api.delete(`/compliance/${id}`); setSelected(null); load(); } catch (e) { setError(e.message); } };
  const handleAi = async (bomItemId) => {
    setAiLoading(true); setAiResult(null);
    try {
      const { data } = await api.post(`/compliance/ai/assess/${bomItemId}`);
      setAiResult(typeof data.data === 'object' ? JSON.stringify(data.data, null, 2) : data.analysis);
    } catch (e) { setError(e.message); }
    setAiLoading(false);
  };

  if (loading) return <div className="loading-container"><div className="spinner-lg"></div>Loading compliance...</div>;

  const compliant = items.filter(i => i.compliance_status === 'compliant').length;
  const nonCompliant = items.filter(i => i.compliance_status === 'non_compliant').length;

  return (
    <div>
      <div className="page-header"><h1>Compliance & RoHS Tracking</h1><div className="actions"><button className="btn btn-primary" onClick={() => setForm({ ...emptyItem })}>+ New Record</button></div></div>
      {error && <div className="error-message">{error} <button onClick={() => setError('')} style={{float:'right',background:'none',border:'none',color:'#f87171',cursor:'pointer'}}>x</button></div>}
      <div className="stats-bar">
        <div className="stat-card"><div className="stat-label">Total Records</div><div className="stat-value">{items.length}</div></div>
        <div className="stat-card"><div className="stat-label">Compliant</div><div className="stat-value" style={{WebkitTextFillColor:'#4ade80'}}>{compliant}</div></div>
        <div className="stat-card"><div className="stat-label">Non-Compliant</div><div className="stat-value" style={{WebkitTextFillColor:'#f87171'}}>{nonCompliant}</div></div>
        <div className="stat-card"><div className="stat-label">Under Review</div><div className="stat-value" style={{WebkitTextFillColor:'#fbbf24'}}>{items.filter(i => i.compliance_status === 'under_review' || i.compliance_status === 'expiring').length}</div></div>
      </div>
      <div className="table-container">
        <table><thead><tr><th>Part</th><th>Part #</th><th>Regulation</th><th>Status</th><th>Certificate</th><th>RoHS</th><th>REACH</th><th>Conflict Free</th><th>Expiry</th></tr></thead>
        <tbody>{items.map(item => (
          <tr key={item.id} onClick={() => { setSelected(item); setAiResult(null); }}>
            <td>{item.part_name}</td><td style={{color:'#60a5fa',fontWeight:600}}>{item.part_number}</td>
            <td style={{fontWeight:600}}>{item.regulation_type}</td>
            <td><span className={`badge badge-${item.compliance_status === 'compliant' ? 'success' : item.compliance_status === 'non_compliant' ? 'danger' : 'warning'}`}>{item.compliance_status}</span></td>
            <td style={{fontSize:11}}>{item.certificate_number || '—'}</td>
            <td style={{color: item.rohs_compliant ? '#4ade80' : '#f87171'}}>{item.rohs_compliant ? 'Yes' : 'No'}</td>
            <td style={{color: item.reach_compliant ? '#4ade80' : '#f87171'}}>{item.reach_compliant ? 'Yes' : 'No'}</td>
            <td style={{color: item.conflict_mineral_free ? '#4ade80' : '#f87171'}}>{item.conflict_mineral_free ? 'Yes' : 'No'}</td>
            <td>{item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : '—'}</td>
          </tr>
        ))}</tbody></table>
      </div>

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <h2>Compliance Record Details</h2>
            <div className="detail-grid">
              <div className="detail-item"><label>Part</label><div className="value">{selected.part_name} ({selected.part_number})</div></div>
              <div className="detail-item"><label>Regulation</label><div className="value">{selected.regulation_type}</div></div>
              <div className="detail-item"><label>Status</label><div className="value"><span className={`badge badge-${selected.compliance_status === 'compliant' ? 'success' : selected.compliance_status === 'non_compliant' ? 'danger' : 'warning'}`}>{selected.compliance_status}</span></div></div>
              <div className="detail-item"><label>Certificate #</label><div className="value">{selected.certificate_number || 'N/A'}</div></div>
              <div className="detail-item"><label>Testing Lab</label><div className="value">{selected.testing_lab || 'N/A'}</div></div>
              <div className="detail-item"><label>Test Date</label><div className="value">{selected.test_date ? new Date(selected.test_date).toLocaleDateString() : 'N/A'}</div></div>
              <div className="detail-item"><label>Expiry Date</label><div className="value">{selected.expiry_date ? new Date(selected.expiry_date).toLocaleDateString() : 'N/A'}</div></div>
              <div className="detail-item"><label>RoHS / REACH / Conflict Free</label><div className="value">{selected.rohs_compliant ? 'RoHS' : ''} {selected.reach_compliant ? 'REACH' : ''} {selected.conflict_mineral_free ? 'CMF' : ''}</div></div>
              <div className="detail-item detail-full"><label>Notes</label><div className="value">{selected.notes || 'N/A'}</div></div>
            </div>
            <button className="btn btn-ai" onClick={() => handleAi(selected.bom_item_id)} disabled={aiLoading} style={{width:'100%',marginBottom:12}}>
              {aiLoading ? <><span className="spinner"></span>AI Assessing...</> : 'AI Assess Compliance Risk'}
            </button>
            {aiResult && <AIAnalysis content={aiResult} title="AI Compliance Assessment" />}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => { setForm({...selected, expiry_date: selected.expiry_date?.split('T')[0] || '', test_date: selected.test_date?.split('T')[0] || ''}); setSelected(null); }}>Edit</button>
              <button className="btn btn-danger" onClick={() => handleDelete(selected.id)}>Delete</button>
              <button className="btn btn-secondary" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {form && (
        <div className="modal-overlay" onClick={() => setForm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{form.id ? 'Edit Compliance Record' : 'New Compliance Record'}</h2>
            <div className="form-grid">
              <div className="form-group form-full"><label>BOM Item</label><select value={form.bom_item_id} onChange={e => setForm({...form, bom_item_id: e.target.value})}><option value="">Select...</option>{bomItems.map(b => <option key={b.id} value={b.id}>{b.part_name} ({b.part_number})</option>)}</select></div>
              <div className="form-group"><label>Regulation Type</label><select value={form.regulation_type} onChange={e => setForm({...form, regulation_type: e.target.value})}><option value="">Select...</option><option value="RoHS 3">RoHS 3</option><option value="REACH">REACH</option><option value="Conflict Minerals">Conflict Minerals</option><option value="UL">UL</option><option value="CE">CE</option><option value="FCC">FCC</option><option value="WEEE">WEEE</option></select></div>
              <div className="form-group"><label>Status</label><select value={form.compliance_status} onChange={e => setForm({...form, compliance_status: e.target.value})}><option value="compliant">Compliant</option><option value="non_compliant">Non-Compliant</option><option value="under_review">Under Review</option><option value="expiring">Expiring</option></select></div>
              <div className="form-group"><label>Certificate #</label><input value={form.certificate_number} onChange={e => setForm({...form, certificate_number: e.target.value})} /></div>
              <div className="form-group"><label>Testing Lab</label><input value={form.testing_lab} onChange={e => setForm({...form, testing_lab: e.target.value})} /></div>
              <div className="form-group"><label>Test Date</label><input type="date" value={form.test_date} onChange={e => setForm({...form, test_date: e.target.value})} /></div>
              <div className="form-group"><label>Expiry Date</label><input type="date" value={form.expiry_date} onChange={e => setForm({...form, expiry_date: e.target.value})} /></div>
              <div className="form-group"><label>RoHS Compliant</label><select value={form.rohs_compliant} onChange={e => setForm({...form, rohs_compliant: e.target.value === 'true'})}><option value="true">Yes</option><option value="false">No</option></select></div>
              <div className="form-group"><label>REACH Compliant</label><select value={form.reach_compliant} onChange={e => setForm({...form, reach_compliant: e.target.value === 'true'})}><option value="true">Yes</option><option value="false">No</option></select></div>
              <div className="form-group"><label>Conflict Mineral Free</label><select value={form.conflict_mineral_free} onChange={e => setForm({...form, conflict_mineral_free: e.target.value === 'true'})}><option value="true">Yes</option><option value="false">No</option></select></div>
              <div className="form-group form-full"><label>Notes</label><textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={3} /></div>
            </div>
            <div className="modal-actions"><button className="btn btn-secondary" onClick={() => setForm(null)}>Cancel</button><button className="btn btn-primary" onClick={handleSave}>Save</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
