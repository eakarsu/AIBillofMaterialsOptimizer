import React, { useState, useEffect } from 'react';
import api from '../services/api';
import AIAnalysis from '../components/AIAnalysis';

const emptyItem = { name: '', contact_email: '', contact_phone: '', address: '', country: '', rating: '', quality_score: '', delivery_score: '', price_score: '', total_orders: '', on_time_delivery_percent: '', category: 'Distributor', status: 'active', notes: '' };

export default function Suppliers() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [error, setError] = useState('');

  const load = async () => { setLoading(true); try { const { data } = await api.get('/suppliers'); setItems(data); } catch (e) { setError(e.message); } setLoading(false); };
  useEffect(() => { load(); }, []);

  const handleSave = async () => { try { if (form.id) await api.put(`/suppliers/${form.id}`, form); else await api.post('/suppliers', form); setForm(null); load(); } catch (e) { setError(e.response?.data?.error || e.message); } };
  const handleDelete = async (id) => { if (!confirm('Delete this supplier?')) return; try { await api.delete(`/suppliers/${id}`); setSelected(null); load(); } catch (e) { setError(e.message); } };
  const handleAi = async (id) => { setAiLoading(true); setAiResult(null); try { const { data } = await api.post(`/suppliers/ai/evaluate/${id}`); setAiResult(data.analysis); } catch (e) { setError(e.message); } setAiLoading(false); };

  if (loading) return <div className="loading-container"><div className="spinner-lg"></div>Loading suppliers...</div>;

  const avgRating = items.reduce((s, i) => s + parseFloat(i.rating || 0), 0) / (items.length || 1);

  return (
    <div>
      <div className="page-header"><h1>Supplier Management</h1><div className="actions"><button className="btn btn-primary" onClick={() => setForm({ ...emptyItem })}>+ New Supplier</button></div></div>
      {error && <div className="error-message">{error} <button onClick={() => setError('')} style={{float:'right',background:'none',border:'none',color:'#f87171',cursor:'pointer'}}>x</button></div>}
      <div className="stats-bar">
        <div className="stat-card"><div className="stat-label">Total Suppliers</div><div className="stat-value">{items.length}</div></div>
        <div className="stat-card"><div className="stat-label">Avg Rating</div><div className="stat-value">{avgRating.toFixed(1)}/5</div></div>
        <div className="stat-card"><div className="stat-label">Countries</div><div className="stat-value">{new Set(items.map(i => i.country)).size}</div></div>
        <div className="stat-card"><div className="stat-label">Total Orders</div><div className="stat-value">{items.reduce((s, i) => s + (i.total_orders || 0), 0)}</div></div>
      </div>
      <div className="table-container">
        <table><thead><tr><th>Name</th><th>Country</th><th>Rating</th><th>Quality</th><th>Delivery</th><th>Price</th><th>Orders</th><th>On-Time %</th><th>Category</th><th>Status</th></tr></thead>
        <tbody>{items.map(item => (
          <tr key={item.id} onClick={() => { setSelected(item); setAiResult(null); }}>
            <td style={{fontWeight:600,color:'#60a5fa'}}>{item.name}</td><td>{item.country}</td>
            <td style={{fontWeight:600}}>{parseFloat(item.rating).toFixed(1)}</td>
            <td>{parseFloat(item.quality_score).toFixed(0)}%</td><td>{parseFloat(item.delivery_score).toFixed(0)}%</td><td>{parseFloat(item.price_score).toFixed(0)}%</td>
            <td>{item.total_orders}</td><td>{parseFloat(item.on_time_delivery_percent).toFixed(0)}%</td>
            <td>{item.category}</td><td><span className={`badge badge-${item.status}`}>{item.status}</span></td>
          </tr>
        ))}</tbody></table>
      </div>

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <h2>Supplier Details</h2>
            <div className="detail-grid">
              <div className="detail-item"><label>Name</label><div className="value">{selected.name}</div></div>
              <div className="detail-item"><label>Country</label><div className="value">{selected.country}</div></div>
              <div className="detail-item"><label>Email</label><div className="value">{selected.contact_email}</div></div>
              <div className="detail-item"><label>Phone</label><div className="value">{selected.contact_phone}</div></div>
              <div className="detail-item"><label>Rating</label><div className="value">{parseFloat(selected.rating).toFixed(1)}/5.0</div></div>
              <div className="detail-item"><label>Category</label><div className="value">{selected.category}</div></div>
              <div className="detail-item"><label>Quality Score</label><div className="value">{parseFloat(selected.quality_score).toFixed(1)}%</div></div>
              <div className="detail-item"><label>Delivery Score</label><div className="value">{parseFloat(selected.delivery_score).toFixed(1)}%</div></div>
              <div className="detail-item"><label>Price Score</label><div className="value">{parseFloat(selected.price_score).toFixed(1)}%</div></div>
              <div className="detail-item"><label>On-Time Delivery</label><div className="value">{parseFloat(selected.on_time_delivery_percent).toFixed(1)}%</div></div>
              <div className="detail-item detail-full"><label>Address</label><div className="value">{selected.address}</div></div>
              <div className="detail-item detail-full"><label>Notes</label><div className="value">{selected.notes || 'N/A'}</div></div>
            </div>
            <button className="btn btn-ai" onClick={() => handleAi(selected.id)} disabled={aiLoading} style={{width:'100%',marginBottom:12}}>
              {aiLoading ? <><span className="spinner"></span>AI Evaluating...</> : 'AI Evaluate Supplier'}
            </button>
            {aiResult && <AIAnalysis content={aiResult} title="AI Supplier Evaluation" />}
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
            <h2>{form.id ? 'Edit Supplier' : 'New Supplier'}</h2>
            <div className="form-grid">
              <div className="form-group"><label>Name</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
              <div className="form-group"><label>Country</label><input value={form.country} onChange={e => setForm({...form, country: e.target.value})} /></div>
              <div className="form-group"><label>Email</label><input value={form.contact_email} onChange={e => setForm({...form, contact_email: e.target.value})} /></div>
              <div className="form-group"><label>Phone</label><input value={form.contact_phone} onChange={e => setForm({...form, contact_phone: e.target.value})} /></div>
              <div className="form-group"><label>Rating (0-5)</label><input type="number" step="0.1" max="5" value={form.rating} onChange={e => setForm({...form, rating: e.target.value})} /></div>
              <div className="form-group"><label>Quality Score (%)</label><input type="number" step="0.01" value={form.quality_score} onChange={e => setForm({...form, quality_score: e.target.value})} /></div>
              <div className="form-group"><label>Delivery Score (%)</label><input type="number" step="0.01" value={form.delivery_score} onChange={e => setForm({...form, delivery_score: e.target.value})} /></div>
              <div className="form-group"><label>Price Score (%)</label><input type="number" step="0.01" value={form.price_score} onChange={e => setForm({...form, price_score: e.target.value})} /></div>
              <div className="form-group"><label>Total Orders</label><input type="number" value={form.total_orders} onChange={e => setForm({...form, total_orders: e.target.value})} /></div>
              <div className="form-group"><label>On-Time %</label><input type="number" step="0.01" value={form.on_time_delivery_percent} onChange={e => setForm({...form, on_time_delivery_percent: e.target.value})} /></div>
              <div className="form-group"><label>Category</label><select value={form.category} onChange={e => setForm({...form, category: e.target.value})}><option value="Distributor">Distributor</option><option value="Manufacturer">Manufacturer</option><option value="Broker">Broker</option></select></div>
              <div className="form-group"><label>Status</label><select value={form.status} onChange={e => setForm({...form, status: e.target.value})}><option value="active">Active</option><option value="inactive">Inactive</option><option value="probation">Probation</option></select></div>
              <div className="form-group form-full"><label>Address</label><input value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></div>
              <div className="form-group form-full"><label>Notes</label><textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={3} /></div>
            </div>
            <div className="modal-actions"><button className="btn btn-secondary" onClick={() => setForm(null)}>Cancel</button><button className="btn btn-primary" onClick={handleSave}>Save</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
