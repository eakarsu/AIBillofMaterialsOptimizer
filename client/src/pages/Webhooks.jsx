import React, { useState, useEffect } from 'react';
import api from '../services/api';

const ALLOWED_EVENTS = [
  'bom.created',
  'bom.updated',
  'bom.version_published',
  'part.obsolescence_alert',
  'part.lead_time_changed',
  'supplier.risk_changed',
  'compliance.violation',
];

export default function Webhooks() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ url: '', secret: '', events: ['bom.created'] });
  const [error, setError] = useState('');
  const [testResult, setTestResult] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/webhooks');
      setItems(data?.data || data || []);
    } catch (e) { setError(e.response?.data?.error || e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const toggleEvent = (ev) => {
    setForm((f) => ({
      ...f,
      events: f.events.includes(ev) ? f.events.filter((e) => e !== ev) : [...f.events, ev],
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.url) { setError('URL is required'); return; }
    if (form.events.length === 0) { setError('Select at least one event'); return; }
    setCreating(true); setError('');
    try {
      await api.post('/webhooks', { url: form.url, events: form.events, secret: form.secret || null });
      setForm({ url: '', secret: '', events: ['bom.created'] });
      load();
    } catch (e) { setError(e.response?.data?.error || e.message); }
    setCreating(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this webhook?')) return;
    try {
      await api.delete(`/webhooks/${id}`);
      setItems((xs) => xs.filter((x) => x.id !== id));
    } catch (e) { setError(e.response?.data?.error || e.message); }
  };

  const handleTest = async (id) => {
    setTestResult(null); setError('');
    try {
      const { data } = await api.post(`/webhooks/${id}/test`);
      setTestResult(data);
    } catch (e) { setError(e.response?.data?.error || e.message); }
  };

  if (loading) return <div className="loading-container"><div className="spinner-lg"></div>Loading webhooks...</div>;

  return (
    <div>
      <div className="page-header"><h1>Webhook Subscriptions</h1></div>
      {error && <div className="error-message">{error} <button onClick={() => setError('')} style={{float:'right',background:'none',border:'none',color:'#f87171',cursor:'pointer'}}>x</button></div>}

      <div className="table-container" style={{ padding: 16, marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>New Subscription</h3>
        <form onSubmit={submit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label>Endpoint URL</label>
              <input type="url" placeholder="https://example.com/hooks/bom" value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })} required style={inp} />
            </div>
            <div>
              <label>Signing Secret (optional)</label>
              <input type="text" placeholder="hex/base64 string" value={form.secret}
                onChange={(e) => setForm({ ...form, secret: e.target.value })} style={inp} />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label>Events</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {ALLOWED_EVENTS.map((ev) => (
                <label key={ev} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="checkbox" checked={form.events.includes(ev)} onChange={() => toggleEvent(ev)} />
                  <span>{ev}</span>
                </label>
              ))}
            </div>
          </div>
          <button type="submit" className="btn btn-primary" style={{ marginTop: 12 }} disabled={creating}>
            {creating ? 'Creating...' : '+ Create Subscription'}
          </button>
        </form>
      </div>

      <div className="table-container">
        <table>
          <thead><tr><th>ID</th><th>URL</th><th>Events</th><th>Active</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>No webhooks subscribed.</td></tr>
            ) : items.map((w) => (
              <tr key={w.id}>
                <td>{w.id}</td>
                <td style={{ wordBreak: 'break-all', maxWidth: 320, color: '#60a5fa' }}>{w.url}</td>
                <td>{(w.events || []).join(', ')}</td>
                <td><span className={`badge badge-${w.active ? 'active' : 'inactive'}`}>{w.active ? 'Yes' : 'No'}</span></td>
                <td>{w.created_at ? new Date(w.created_at).toLocaleString() : ''}</td>
                <td>
                  <button className="btn btn-secondary" onClick={() => handleTest(w.id)} style={{ marginRight: 8 }}>Test</button>
                  <button className="btn btn-secondary" onClick={() => handleDelete(w.id)}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {testResult && (
        <div className="table-container" style={{ padding: 16, marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>Test Payload</h3>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 400, overflow: 'auto' }}>
            {JSON.stringify(testResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

const inp = { width: '100%', padding: 8, marginTop: 4, background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 4 };
