import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const cards = [
  {
    key: 'bom', path: '/bom', title: 'BOM Cost Optimization',
    desc: 'Manage and optimize your Bill of Materials. Track unit costs, quantities, suppliers, and get AI-powered cost reduction recommendations.',
    className: 'card-bom', icon: '☰', endpoint: '/bom'
  },
  {
    key: 'alt', path: '/alternatives', title: 'Alternative Part Sourcing',
    desc: 'Discover drop-in replacements and cost-effective alternatives. Compare compatibility scores, pricing, and lead times across suppliers.',
    className: 'card-alt', icon: '⇄', endpoint: '/alternatives'
  },
  {
    key: 'obs', path: '/obsolescence', title: 'Obsolescence Prediction',
    desc: 'AI-driven lifecycle analysis and end-of-life forecasting. Identify at-risk components before they impact production.',
    className: 'card-obs', icon: '⚠', endpoint: '/obsolescence'
  },
  {
    key: 'lead', path: '/leadtime', title: 'Lead Time Tracking',
    desc: 'Monitor supplier lead times, track delivery trends, and get AI forecasts to optimize inventory and procurement planning.',
    className: 'card-lead', icon: '⏱', endpoint: '/leadtime'
  },
  {
    key: 'cost', path: '/costdown', title: 'Cost-Down Analysis',
    desc: 'Comprehensive cost reduction strategies powered by AI. Track savings targets, implementation status, and ROI across all components.',
    className: 'card-cost', icon: '↓', endpoint: '/costdown'
  },
  {
    key: 'sup', path: '/suppliers', title: 'Supplier Management',
    desc: 'Rate and manage your supplier network. Track quality, delivery, and pricing scores with AI-powered supplier evaluations.',
    className: 'card-sup', icon: '★', endpoint: '/suppliers'
  },
  {
    key: 'inv', path: '/inventory', title: 'Inventory Management',
    desc: 'Monitor stock levels, reorder points, and warehouse locations. AI optimizes inventory with EOQ and safety stock calculations.',
    className: 'card-inv', icon: '▦', endpoint: '/inventory'
  },
  {
    key: 'comp', path: '/compliance', title: 'Compliance & RoHS',
    desc: 'Track RoHS, REACH, conflict minerals, and other regulatory compliance. AI assesses compliance gaps and upcoming changes.',
    className: 'card-comp', icon: '✓', endpoint: '/compliance'
  },
  {
    key: 'ver', path: '/bomversions', title: 'BOM Versions',
    desc: 'Compare BOM versions, track changes, and analyze cost trends across revisions with AI-powered version comparison.',
    className: 'card-ver', icon: '⑂', endpoint: '/bomversions'
  },
  {
    key: 'risk', path: '/risks', title: 'Risk Assessment',
    desc: 'Comprehensive supply chain risk scoring. Evaluate geopolitical, single-source, and obsolescence risks with AI analysis.',
    className: 'card-risk', icon: '⚡', endpoint: '/risks'
  },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [counts, setCounts] = useState({});
  const [stats, setStats] = useState(null);

  useEffect(() => {
    cards.forEach(async card => {
      try {
        const { data } = await api.get(card.endpoint);
        setCounts(prev => ({ ...prev, [card.key]: data.length }));
      } catch {}
    });
    api.get('/reports/dashboard-stats').then(({ data }) => setStats(data)).catch(() => {});
  }, []);

  const bomCost = parseFloat(stats?.bom?.total_bom_cost || 0);
  const lowStock = parseInt(stats?.inventory?.low_stock_count || 0);
  const highRisks = parseInt(stats?.risks?.high_risks || 0);
  const nonCompliant = parseInt(stats?.compliance?.non_compliant_count || 0);

  return (
    <div>
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <p>AI-powered Bill of Materials optimization and intelligence platform</p>
      </div>

      {stats && (
        <div className="stats-bar" style={{marginBottom: 28}}>
          <div className="stat-card">
            <div className="stat-label">Total BOM Cost</div>
            <div className="stat-value">${bomCost.toLocaleString('en-US', {minimumFractionDigits: 2})}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Active Suppliers</div>
            <div className="stat-value">{stats?.suppliers?.active_suppliers || 0}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Low Stock Alerts</div>
            <div className="stat-value" style={lowStock > 0 ? {background: 'linear-gradient(135deg, #f59e0b, #fbbf24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'} : {}}>
              {lowStock}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">High Risks</div>
            <div className="stat-value" style={highRisks > 0 ? {background: 'linear-gradient(135deg, #ef4444, #f87171)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'} : {}}>
              {highRisks}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Non-Compliant</div>
            <div className="stat-value" style={nonCompliant > 0 ? {background: 'linear-gradient(135deg, #ef4444, #f87171)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'} : {}}>
              {nonCompliant}
            </div>
          </div>
        </div>
      )}

      <div className="dashboard-grid">
        {cards.map(card => (
          <div key={card.key} className={`dashboard-card ${card.className}`} onClick={() => navigate(card.path)}>
            <div className="card-icon">{card.icon}</div>
            <h3>{card.title}</h3>
            <p>{card.desc}</p>
            <div className="card-stat">
              <span>Records:</span>
              <span className="stat-value">{counts[card.key] ?? '...'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
