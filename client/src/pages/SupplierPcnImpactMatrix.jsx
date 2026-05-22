import React, { useEffect, useState } from 'react';

export default function SupplierPcnImpactMatrix() {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch('/api/supplier-pcn-impact-matrix').then((res) => res.json()).then(setData).catch(() => setData(null));
  }, []);
  return (
    <div className="page">
      <h1>Supplier PCN Impact Matrix</h1>
      <p>Map product-change notices to affected BOMs, alternates, and redesign risk.</p>
      <div className="stats-grid">
        {data && Object.entries(data.summary).map(([key, value]) => <div className="stat-card" key={key}><span>{key.replaceAll('_', ' ')}</span><strong>{value}</strong></div>)}
      </div>
      <div className="card">
        {(data?.impacts || []).map((item) => <div key={item.pcn} style={{ padding: 12, borderBottom: '1px solid #e5e7eb' }}><strong>{item.pcn}</strong><div>{item.part} - {item.boms} BOMs - {item.risk} - {item.action}</div></div>)}
      </div>
    </div>
  );
}
