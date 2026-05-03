import React, { useState, useEffect } from 'react';
import api from '../services/api';

const FEATURES = [
  {
    key: 'volume-break-optimizer',
    label: 'Volume Break Optimizer',
    icon: '📦',
    description: 'Find optimal purchase quantities to maximize price breaks across your BOM.',
    default: () => ({
      bom_items: [
        { part_number: 'CAP-001', part_name: 'Ceramic Capacitor 0.1uF', current_volume: 5000, unit_price: 0.04 },
      ],
      volume_scenarios: [
        { qty: 5000, unit_price: 0.04 },
        { qty: 25000, unit_price: 0.028 },
        { qty: 100000, unit_price: 0.018 },
      ],
    }),
  },
  {
    key: 'geopolitical-diversification',
    label: 'Geopolitical Diversification',
    icon: '🌐',
    description: 'Identify country-concentration risk and propose alternative sourcing regions.',
    default: () => ({
      suppliers: [
        { name: 'Acme Components', country: 'CN', spend_usd: 1200000 },
        { name: 'EuroChip GmbH', country: 'DE', spend_usd: 480000 },
      ],
      country_data: {
        CN: { tariff_risk: 'high', political_stability: 'medium' },
        DE: { tariff_risk: 'low', political_stability: 'high' },
      },
    }),
  },
  {
    key: 'supply-chain-simulation',
    label: 'Supply Chain Simulation',
    icon: '🔥',
    description: 'Model production impact of supplier or geography disruption scenarios.',
    default: () => ({
      bom_items: [
        { part_number: 'IC-A1', part_name: 'MCU XYZ', supplier: 'Acme Components', quantity: 1, days_of_stock: 21 },
      ],
      disruption_scenario: { type: 'factory_fire', region: 'Shanghai', duration_weeks: 6 },
    }),
  },
  {
    key: 'lifecycle-roadmap',
    label: 'Lifecycle Roadmap',
    icon: '🛣️',
    description: 'Map technology maturity and refresh timing across your component portfolio.',
    default: () => ({
      components: [
        { part_number: 'IC-MCU01', part_name: 'MCU 8-bit', manufacturer: 'OldFab', introduced_year: 2009 },
        { part_number: 'IC-MCU02', part_name: 'MCU 32-bit', manufacturer: 'NewFab', introduced_year: 2022 },
      ],
    }),
  },
  {
    key: 'lead-time-alerts',
    label: 'Predictive Lead-Time Alerts',
    icon: '⏱️',
    description: 'Predict lead-time degradation and forward-buy recommendations from history.',
    default: () => ({ lookback_days: 90 }),
  },
  {
    key: 'bom-benchmarking',
    label: 'BOM Benchmarking',
    icon: '🏁',
    description: 'Estimate cost-position vs competitors in the same product category.',
    default: () => ({
      product_category: 'Industrial Sensor',
      competitor_products: [
        { name: 'Competitor A', list_price_usd: 199 },
        { name: 'Competitor B', list_price_usd: 179 },
      ],
    }),
  },
  {
    key: 'rohs-tracking',
    label: 'RoHS / Compliance Tracking',
    icon: '✅',
    description: 'Track regulatory compliance status & upcoming regulation changes.',
    default: () => ({ region: 'EU', regulations: ['RoHS', 'REACH', 'WEEE'] }),
  },
  {
    key: 'supplier-risk-score',
    label: 'Supplier Relationship Risk',
    icon: '⚖️',
    description: 'Unified Supplier Relationship Risk Score (SRRS) with mitigation steps.',
    default: () => ({}),
  },
];

function ResultRenderer({ data }) {
  if (!data) return null;
  if (typeof data === 'string') return <pre className="ai-pre">{data}</pre>;
  if (data.raw_response) return <pre className="ai-pre">{data.raw_response}</pre>;
  return (
    <pre className="ai-pre" style={{ maxHeight: 400, overflow: 'auto' }}>
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

export default function AIInsights() {
  const [feature, setFeature] = useState(FEATURES[0]);
  const [payload, setPayload] = useState(JSON.stringify(FEATURES[0].default(), null, 2));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);

  useEffect(() => {
    setPayload(JSON.stringify(feature.default(), null, 2));
    setResult(null);
    setError('');
    loadHistory(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feature.key]);

  const loadHistory = async (page = 1) => {
    try {
      const r = await api.get('/ai/results', { params: { page, limit: 10, feature: feature.key } });
      setHistory(r.data?.data || []);
      setHistoryTotal(r.data?.pagination?.total || 0);
      setHistoryPage(page);
    } catch { /* table may not exist yet */ }
  };

  const run = async () => {
    setLoading(true); setError(''); setResult(null);
    try {
      let body;
      try { body = JSON.parse(payload); }
      catch { setError('Invalid JSON payload'); setLoading(false); return; }
      const r = await api.post(`/ai/${feature.key}`, body);
      setResult(r.data?.data || r.data);
      loadHistory(1);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    }
    setLoading(false);
  };

  const totalPages = Math.max(1, Math.ceil(historyTotal / 10));

  return (
    <div>
      <div className="page-header">
        <h1>AI Insights</h1>
        <div className="actions">
          <span className="ai-badge">{FEATURES.length} AI Features</span>
        </div>
      </div>

      <div className="stats-bar">
        {FEATURES.map(f => (
          <div
            key={f.key}
            className="stat-card"
            style={{
              cursor: 'pointer',
              borderColor: feature.key === f.key ? '#6366f1' : undefined,
              background: feature.key === f.key ? 'rgba(99,102,241,0.10)' : undefined,
            }}
            onClick={() => setFeature(f)}
          >
            <div className="stat-label">{f.icon} {f.label}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{f.description}</div>
          </div>
        ))}
      </div>

      <div className="modal-wide" style={{ background: '#1e293b', padding: 16, borderRadius: 8, marginTop: 12 }}>
        <h2>{feature.icon} {feature.label}</h2>
        <p style={{ color: '#94a3b8', marginBottom: 12 }}>{feature.description}</p>
        <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Request payload (JSON):</label>
        <textarea
          value={payload}
          onChange={e => setPayload(e.target.value)}
          rows={12}
          style={{ width: '100%', fontFamily: 'monospace', fontSize: 13, background: '#0f172a', color: '#e2e8f0', padding: 8, borderRadius: 6, border: '1px solid #334155' }}
        />
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-primary" onClick={run} disabled={loading}>
            {loading ? 'Analyzing…' : `Run ${feature.label}`}
          </button>
          <button className="btn btn-secondary" style={{ marginLeft: 8 }} onClick={() => setPayload(JSON.stringify(feature.default(), null, 2))}>Reset payload</button>
        </div>
        {error && <div className="error-message" style={{ marginTop: 12 }}>{error}</div>}
      </div>

      {result && (
        <div className="modal-wide" style={{ background: '#1e293b', padding: 16, borderRadius: 8, marginTop: 12 }}>
          <h3>Result</h3>
          <ResultRenderer data={result} />
        </div>
      )}

      <div className="modal-wide" style={{ background: '#1e293b', padding: 16, borderRadius: 8, marginTop: 12 }}>
        <h3>Recent runs ({historyTotal})</h3>
        {history.length === 0 ? (
          <div style={{ color: '#94a3b8' }}>No runs yet for this feature.</div>
        ) : (
          <>
            <table style={{ width: '100%', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left' }}>
                  <th>When</th><th>By</th><th>Entity</th><th>Summary</th>
                </tr>
              </thead>
              <tbody>
                {history.map(h => (
                  <tr key={h.id}>
                    <td>{new Date(h.created_at).toLocaleString()}</td>
                    <td>{h.user_email || '—'}</td>
                    <td>{h.entity_type || '—'}{h.entity_id ? ` #${h.entity_id}` : ''}</td>
                    <td style={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {(h.response && (h.response.summary || h.response.impact_summary || h.response.portfolio_summary)) ? JSON.stringify(h.response.summary || h.response.impact_summary || h.response.portfolio_summary).slice(0, 160) : JSON.stringify(h.response).slice(0, 160)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <button className="btn btn-secondary" disabled={historyPage <= 1} onClick={() => loadHistory(historyPage - 1)}>Prev</button>
              <span>Page {historyPage} / {totalPages}</span>
              <button className="btn btn-secondary" disabled={historyPage >= totalPages} onClick={() => loadHistory(historyPage + 1)}>Next</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
