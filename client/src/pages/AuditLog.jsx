import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ entity_type: '', action: '', search: '' });

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 50 });
      if (filters.entity_type) params.set('entity_type', filters.entity_type);
      if (filters.action) params.set('action', filters.action);
      if (filters.search) params.set('search', filters.search);
      const { data } = await api.get(`/audit?${params}`);
      // Handle both {data, pagination} and legacy {logs, total, total_pages} format
      setLogs(data.data || data.logs || []);
      setTotalPages(data.pagination?.total_pages || data.total_pages || 1);
      setTotal(data.pagination?.total || data.total || 0);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const loadStats = async () => {
    try {
      const { data } = await api.get('/audit/stats');
      setStats(data);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { load(); }, [page, filters]);
  useEffect(() => { loadStats(); }, []);

  const formatDate = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleString();
  };

  const actionColor = (action) => {
    switch (action) {
      case 'CREATE': return '#4ade80';
      case 'UPDATE': return '#60a5fa';
      case 'DELETE': return '#f87171';
      default: return '#94a3b8';
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Audit Log</h1>
        <div className="actions">
          <span style={{color:'#64748b', fontSize: 13}}>{total} total entries</span>
        </div>
      </div>

      {stats && (
        <div className="stats-bar">
          {stats.by_action.map((s, i) => (
            <div key={i} className="stat-card">
              <div className="stat-label">{s.action} Actions</div>
              <div className="stat-value">{s.count}</div>
            </div>
          ))}
        </div>
      )}

      <div className="filter-bar">
        <input
          className="filter-input"
          placeholder="Search audit logs..."
          value={filters.search}
          onChange={e => { setFilters({...filters, search: e.target.value}); setPage(1); }}
        />
        <select className="filter-select" value={filters.action} onChange={e => { setFilters({...filters, action: e.target.value}); setPage(1); }}>
          <option value="">All Actions</option>
          <option value="CREATE">Create</option>
          <option value="UPDATE">Update</option>
          <option value="DELETE">Delete</option>
        </select>
        <select className="filter-select" value={filters.entity_type} onChange={e => { setFilters({...filters, entity_type: e.target.value}); setPage(1); }}>
          <option value="">All Types</option>
          <option value="bom_item">BOM Items</option>
          <option value="supplier">Suppliers</option>
          <option value="inventory">Inventory</option>
        </select>
        {(filters.search || filters.action || filters.entity_type) && (
          <button className="btn btn-sm btn-secondary" onClick={() => { setFilters({entity_type: '', action: '', search: ''}); setPage(1); }}>Clear</button>
        )}
      </div>

      {loading ? (
        <div className="loading-container"><div className="spinner-lg"></div>Loading audit logs...</div>
      ) : logs.length === 0 ? (
        <div style={{textAlign:'center', padding: 60, color: '#64748b'}}>
          <p style={{fontSize: 16, marginBottom: 8}}>No audit log entries found</p>
          <p style={{fontSize: 13}}>Actions like creating, updating, and deleting records will appear here.</p>
        </div>
      ) : (
        <>
          <div className="table-container">
            <table>
              <thead><tr>
                <th>Timestamp</th><th>User</th><th>Action</th><th>Type</th><th>Entity</th><th>Details</th>
              </tr></thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} style={{cursor: 'default'}}>
                    <td style={{fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap'}}>{formatDate(log.created_at)}</td>
                    <td>{log.user_email}</td>
                    <td><span style={{color: actionColor(log.action), fontWeight: 700, fontSize: 12, textTransform: 'uppercase'}}>{log.action}</span></td>
                    <td><span className="badge badge-active">{log.entity_type}</span></td>
                    <td style={{fontWeight: 600}}>{log.entity_name || `#${log.entity_id}`}</td>
                    <td style={{color: '#94a3b8', fontSize: 12}}>{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button className="btn btn-sm btn-secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
              <span style={{color: '#94a3b8', fontSize: 13}}>Page {page} of {totalPages}</span>
              <button className="btn btn-sm btn-secondary" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
