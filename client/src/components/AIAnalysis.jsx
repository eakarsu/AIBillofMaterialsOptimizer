import React from 'react';
import ReactMarkdown from 'react-markdown';

export default function AIAnalysis({ content, title = 'AI Analysis' }) {
  if (!content) return null;
  return (
    <div className="ai-analysis">
      <div className="ai-analysis-header">
        <span className="ai-badge">AI POWERED</span>
        <h3>{title}</h3>
      </div>
      <div className="ai-analysis-content">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
}
