import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const navItems = [
  { path: '/', label: 'Dashboard', icon: '⊞' },
  { path: '/bom', label: 'BOM Items', icon: '☰' },
  { path: '/alternatives', label: 'Alternative Parts', icon: '⇄' },
  { path: '/obsolescence', label: 'Obsolescence', icon: '⚠' },
  { path: '/leadtime', label: 'Lead Time', icon: '⏱' },
  { path: '/costdown', label: 'Cost-Down', icon: '↓' },
  { path: '/suppliers', label: 'Suppliers', icon: '★' },
  { path: '/inventory', label: 'Inventory', icon: '▦' },
  { path: '/compliance', label: 'Compliance', icon: '✓' },
  { path: '/bomversions', label: 'BOM Versions', icon: '⑂' },
  { path: '/risks', label: 'Risk Assessment', icon: '⚡' },
  { path: '/reports', label: 'Reports', icon: '◩' },
  { path: '/audit', label: 'Audit Log', icon: '⧉' },
];

export default function Layout({ children, user, onLogout }) {
  const location = useLocation();
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h2>BOM Optimizer</h2>
          <small>AI-Powered Manufacturing Intelligence</small>
        </div>
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <Link key={item.path} to={item.path} className={location.pathname === item.path ? 'active' : ''}>
              <span className="icon">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
            <div>
              <div className="user-name">{user?.name}</div>
              <div className="user-email">{user?.email}</div>
            </div>
            <button className="logout-btn" onClick={onLogout}>Logout</button>
          </div>
        </div>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
}
