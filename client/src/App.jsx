import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import BomItems from './pages/BomItems';
import AlternativeParts from './pages/AlternativeParts';
import ObsolescencePredictions from './pages/ObsolescencePredictions';
import LeadTimeTracking from './pages/LeadTimeTracking';
import CostDownAnalysis from './pages/CostDownAnalysis';
import Suppliers from './pages/Suppliers';
import Inventory from './pages/Inventory';
import Compliance from './pages/Compliance';
import BomVersions from './pages/BomVersions';
import RiskAssessment from './pages/RiskAssessment';
import Reports from './pages/Reports';
import AuditLog from './pages/AuditLog';
import AIInsights from './pages/AIInsights';
import Webhooks from './pages/Webhooks';
import SupplierPcnImpactMatrix from './pages/SupplierPcnImpactMatrix';
import Layout from './components/Layout';
import './styles.css';

import CodexCustomVizFeature from './pages/CodexCustomVizFeature';
import CodexOperationsFeature from './pages/CodexOperationsFeature';

import TimelineView from './pages/TimelineView';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'));

  const handleLogin = (t, u) => {
    localStorage.setItem('token', t);
    localStorage.setItem('user', JSON.stringify(u));
    setToken(t);
    setUser(u);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  if (!token) return (
    <BrowserRouter>
      <Routes>
        <Route path="/insights/timeline" element={<TimelineView />} />
        <Route path="/codex/custom-viz" element={<CodexCustomVizFeature />} />
        <Route path="/codex/operations" element={<CodexOperationsFeature />} />

        <Route path="*" element={<Login onLogin={handleLogin} />} />
      </Routes>
    </BrowserRouter>
  );

  return (
    <BrowserRouter>
      <Layout user={user} onLogout={handleLogout}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/bom" element={<BomItems />} />
          <Route path="/alternatives" element={<AlternativeParts />} />
          <Route path="/obsolescence" element={<ObsolescencePredictions />} />
          <Route path="/leadtime" element={<LeadTimeTracking />} />
          <Route path="/costdown" element={<CostDownAnalysis />} />
          <Route path="/suppliers" element={<Suppliers />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/compliance" element={<Compliance />} />
          <Route path="/bomversions" element={<BomVersions />} />
          <Route path="/risks" element={<RiskAssessment />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/audit" element={<AuditLog />} />
          <Route path="/ai-insights" element={<AIInsights />} />
          <Route path="/webhooks" element={<Webhooks />} />
          <Route path="/supplier-pcn-impact-matrix" element={<SupplierPcnImpactMatrix />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
