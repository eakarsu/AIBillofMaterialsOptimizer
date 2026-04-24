import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function Reports() {
  const [stats, setStats] = useState(null);
  const [costByCategory, setCostByCategory] = useState([]);
  const [costBySupplier, setCostBySupplier] = useState([]);
  const [topItems, setTopItems] = useState([]);
  const [savingsSummary, setSavingsSummary] = useState([]);
  const [inventoryValue, setInventoryValue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const loadAll = async () => {
      try {
        const [s, cat, sup, top, sav, inv] = await Promise.all([
          api.get('/reports/dashboard-stats'),
          api.get('/reports/cost-by-category'),
          api.get('/reports/cost-by-supplier'),
          api.get('/reports/top-cost-items'),
          api.get('/reports/savings-summary'),
          api.get('/reports/inventory-value')
        ]);
        setStats(s.data);
        setCostByCategory(cat.data);
        setCostBySupplier(sup.data);
        setTopItems(top.data);
        setSavingsSummary(sav.data);
        setInventoryValue(inv.data);
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    loadAll();
  }, []);

  if (loading) return <div className="loading-container"><div className="spinner-lg"></div>Loading reports...</div>;

  const totalBomCost = parseFloat(stats?.bom?.total_bom_cost || 0);

  return (
    <div>
      <div className="page-header">
        <h1>Reports & Analytics</h1>
        <div className="actions">
          <button className="btn btn-secondary" onClick={() => window.print()}>Print Report</button>
        </div>
      </div>

      <div className="report-tabs">
        {['overview', 'category', 'supplier', 'inventory', 'savings'].map(tab => (
          <button key={tab} className={`report-tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div>
          <div className="stats-bar">
            <div className="stat-card"><div className="stat-label">Total BOM Cost</div><div className="stat-value">${totalBomCost.toLocaleString('en-US', {minimumFractionDigits: 2})}</div></div>
            <div className="stat-card"><div className="stat-label">Total Items</div><div className="stat-value">{stats?.bom?.total_items || 0}</div></div>
            <div className="stat-card"><div className="stat-label">Avg Unit Cost</div><div className="stat-value">${parseFloat(stats?.bom?.avg_unit_cost || 0).toFixed(2)}</div></div>
            <div className="stat-card"><div className="stat-label">Highest Item</div><div className="stat-value">${parseFloat(stats?.bom?.highest_item_cost || 0).toFixed(2)}</div></div>
          </div>

          <div className="report-grid">
            <div className="report-section">
              <h3>BOM Status Breakdown</h3>
              <div className="report-bars">
                <div className="report-bar-item">
                  <span className="report-bar-label">Active</span>
                  <div className="report-bar-track">
                    <div className="report-bar-fill bar-blue" style={{width: `${(stats?.bom?.active_count / stats?.bom?.total_items * 100) || 0}%`}}></div>
                  </div>
                  <span className="report-bar-value">{stats?.bom?.active_count || 0}</span>
                </div>
                <div className="report-bar-item">
                  <span className="report-bar-label">Inactive</span>
                  <div className="report-bar-track">
                    <div className="report-bar-fill bar-yellow" style={{width: `${(stats?.bom?.inactive_count / stats?.bom?.total_items * 100) || 0}%`}}></div>
                  </div>
                  <span className="report-bar-value">{stats?.bom?.inactive_count || 0}</span>
                </div>
                <div className="report-bar-item">
                  <span className="report-bar-label">Discontinued</span>
                  <div className="report-bar-track">
                    <div className="report-bar-fill bar-red" style={{width: `${(stats?.bom?.discontinued_count / stats?.bom?.total_items * 100) || 0}%`}}></div>
                  </div>
                  <span className="report-bar-value">{stats?.bom?.discontinued_count || 0}</span>
                </div>
              </div>
            </div>

            <div className="report-section">
              <h3>Risk Overview</h3>
              <div className="report-bars">
                <div className="report-bar-item">
                  <span className="report-bar-label">High Risk</span>
                  <div className="report-bar-track">
                    <div className="report-bar-fill bar-red" style={{width: `${(stats?.risks?.high_risks / Math.max(stats?.risks?.total_risks, 1) * 100) || 0}%`}}></div>
                  </div>
                  <span className="report-bar-value">{stats?.risks?.high_risks || 0}</span>
                </div>
                <div className="report-bar-item">
                  <span className="report-bar-label">Medium Risk</span>
                  <div className="report-bar-track">
                    <div className="report-bar-fill bar-yellow" style={{width: `${(stats?.risks?.medium_risks / Math.max(stats?.risks?.total_risks, 1) * 100) || 0}%`}}></div>
                  </div>
                  <span className="report-bar-value">{stats?.risks?.medium_risks || 0}</span>
                </div>
                <div className="report-bar-item">
                  <span className="report-bar-label">Single Source</span>
                  <div className="report-bar-track">
                    <div className="report-bar-fill bar-orange" style={{width: `${(stats?.risks?.single_source_count / Math.max(stats?.risks?.total_risks, 1) * 100) || 0}%`}}></div>
                  </div>
                  <span className="report-bar-value">{stats?.risks?.single_source_count || 0}</span>
                </div>
              </div>
            </div>

            <div className="report-section">
              <h3>Supplier Performance</h3>
              <div className="report-bars">
                <div className="report-bar-item">
                  <span className="report-bar-label">Avg Rating</span>
                  <div className="report-bar-track">
                    <div className="report-bar-fill bar-blue" style={{width: `${(parseFloat(stats?.suppliers?.avg_rating || 0) / 5 * 100)}%`}}></div>
                  </div>
                  <span className="report-bar-value">{parseFloat(stats?.suppliers?.avg_rating || 0).toFixed(1)}/5</span>
                </div>
                <div className="report-bar-item">
                  <span className="report-bar-label">Avg Quality</span>
                  <div className="report-bar-track">
                    <div className="report-bar-fill bar-green" style={{width: `${parseFloat(stats?.suppliers?.avg_quality || 0)}%`}}></div>
                  </div>
                  <span className="report-bar-value">{parseFloat(stats?.suppliers?.avg_quality || 0).toFixed(0)}%</span>
                </div>
                <div className="report-bar-item">
                  <span className="report-bar-label">Avg Delivery</span>
                  <div className="report-bar-track">
                    <div className="report-bar-fill bar-teal" style={{width: `${parseFloat(stats?.suppliers?.avg_delivery || 0)}%`}}></div>
                  </div>
                  <span className="report-bar-value">{parseFloat(stats?.suppliers?.avg_delivery || 0).toFixed(0)}%</span>
                </div>
              </div>
            </div>

            <div className="report-section">
              <h3>Compliance Status</h3>
              <div className="report-bars">
                <div className="report-bar-item">
                  <span className="report-bar-label">Compliant</span>
                  <div className="report-bar-track">
                    <div className="report-bar-fill bar-green" style={{width: `${(stats?.compliance?.compliant_count / Math.max(stats?.compliance?.total_records, 1) * 100) || 0}%`}}></div>
                  </div>
                  <span className="report-bar-value">{stats?.compliance?.compliant_count || 0}</span>
                </div>
                <div className="report-bar-item">
                  <span className="report-bar-label">Non-Compliant</span>
                  <div className="report-bar-track">
                    <div className="report-bar-fill bar-red" style={{width: `${(stats?.compliance?.non_compliant_count / Math.max(stats?.compliance?.total_records, 1) * 100) || 0}%`}}></div>
                  </div>
                  <span className="report-bar-value">{stats?.compliance?.non_compliant_count || 0}</span>
                </div>
                <div className="report-bar-item">
                  <span className="report-bar-label">RoHS</span>
                  <div className="report-bar-track">
                    <div className="report-bar-fill bar-blue" style={{width: `${(stats?.compliance?.rohs_count / Math.max(stats?.compliance?.total_records, 1) * 100) || 0}%`}}></div>
                  </div>
                  <span className="report-bar-value">{stats?.compliance?.rohs_count || 0}</span>
                </div>
              </div>
            </div>
          </div>

          <h3 style={{marginTop: 28, marginBottom: 16}}>Top 10 Highest Cost Items</h3>
          <div className="table-container">
            <table>
              <thead><tr><th>Part #</th><th>Name</th><th>Category</th><th>Supplier</th><th>Unit Cost</th><th>Qty</th><th>Total</th><th>% of BOM</th></tr></thead>
              <tbody>
                {topItems.map((item, i) => (
                  <tr key={i}>
                    <td style={{fontWeight:600, color:'#60a5fa'}}>{item.part_number}</td>
                    <td>{item.part_name}</td>
                    <td>{item.category}</td>
                    <td>{item.supplier}</td>
                    <td>${parseFloat(item.unit_cost).toFixed(2)}</td>
                    <td>{item.quantity}</td>
                    <td style={{fontWeight:600}}>${parseFloat(item.total_cost).toFixed(2)}</td>
                    <td>{totalBomCost > 0 ? (parseFloat(item.total_cost) / totalBomCost * 100).toFixed(1) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'category' && (
        <div>
          <h3 style={{marginBottom: 16}}>Cost Breakdown by Category</h3>
          <div className="report-breakdown">
            {costByCategory.map((cat, i) => (
              <div key={i} className="breakdown-card">
                <div className="breakdown-header">
                  <h4>{cat.category}</h4>
                  <span className="breakdown-total">${parseFloat(cat.total_cost).toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                </div>
                <div className="breakdown-details">
                  <span>{cat.item_count} items</span>
                  <span>Avg: ${parseFloat(cat.avg_unit_cost).toFixed(2)}</span>
                  <span>{totalBomCost > 0 ? (parseFloat(cat.total_cost) / totalBomCost * 100).toFixed(1) : 0}% of total</span>
                </div>
                <div className="report-bar-track" style={{marginTop: 8}}>
                  <div className="report-bar-fill bar-blue" style={{width: `${totalBomCost > 0 ? (parseFloat(cat.total_cost) / totalBomCost * 100) : 0}%`}}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'supplier' && (
        <div>
          <h3 style={{marginBottom: 16}}>Cost Breakdown by Supplier</h3>
          <div className="table-container">
            <table>
              <thead><tr><th>Supplier</th><th>Items</th><th>Total Qty</th><th>Avg Unit Cost</th><th>Total Cost</th><th>% of BOM</th></tr></thead>
              <tbody>
                {costBySupplier.map((sup, i) => (
                  <tr key={i}>
                    <td style={{fontWeight:600}}>{sup.supplier}</td>
                    <td>{sup.item_count}</td>
                    <td>{sup.total_quantity}</td>
                    <td>${parseFloat(sup.avg_unit_cost).toFixed(2)}</td>
                    <td style={{fontWeight:600, color:'#60a5fa'}}>${parseFloat(sup.total_cost).toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                    <td>{totalBomCost > 0 ? (parseFloat(sup.total_cost) / totalBomCost * 100).toFixed(1) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'inventory' && inventoryValue && (
        <div>
          <div className="stats-bar">
            <div className="stat-card"><div className="stat-label">Total Inventory Value</div><div className="stat-value">${inventoryValue.total_value.toLocaleString('en-US', {minimumFractionDigits: 2})}</div></div>
            <div className="stat-card"><div className="stat-label">Total Stock Units</div><div className="stat-value">{stats?.inventory?.total_stock || 0}</div></div>
            <div className="stat-card"><div className="stat-label">Low Stock Items</div><div className="stat-value" style={{color: '#fbbf24'}}>{stats?.inventory?.low_stock_count || 0}</div></div>
            <div className="stat-card"><div className="stat-label">Out of Stock</div><div className="stat-value" style={{color: '#f87171'}}>{stats?.inventory?.out_of_stock_count || 0}</div></div>
          </div>
          <h3 style={{marginBottom: 16}}>Inventory Value by Item</h3>
          <div className="table-container">
            <table>
              <thead><tr><th>Part #</th><th>Name</th><th>Unit Cost</th><th>Stock</th><th>Location</th><th>Status</th><th>Stock Value</th></tr></thead>
              <tbody>
                {inventoryValue.items.map((item, i) => (
                  <tr key={i}>
                    <td style={{fontWeight:600, color:'#60a5fa'}}>{item.part_number}</td>
                    <td>{item.part_name}</td>
                    <td>${parseFloat(item.unit_cost).toFixed(2)}</td>
                    <td>{item.current_stock}</td>
                    <td>{item.warehouse_location}</td>
                    <td><span className={`badge badge-${item.stock_status}`}>{item.stock_status}</span></td>
                    <td style={{fontWeight:600}}>${parseFloat(item.stock_value).toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'savings' && (
        <div>
          <h3 style={{marginBottom: 16}}>Cost-Down Savings by Status</h3>
          {savingsSummary.length === 0 ? (
            <p style={{color: '#64748b'}}>No cost-down analyses found.</p>
          ) : (
            <div className="report-breakdown">
              {savingsSummary.map((s, i) => (
                <div key={i} className="breakdown-card">
                  <div className="breakdown-header">
                    <h4><span className={`badge badge-${s.implementation_status}`}>{s.implementation_status}</span></h4>
                    <span className="breakdown-total">${parseFloat(s.total_savings).toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                  </div>
                  <div className="breakdown-details">
                    <span>{s.count} initiatives</span>
                    <span>Avg savings: {parseFloat(s.avg_savings_percent).toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
