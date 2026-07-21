const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { aiRateLimiter, generalRateLimiter } = require('./middleware/rateLimiter');
require('dotenv').config({ path: '../.env' });

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be configured with at least 32 characters');
}

const app = express();
const PORT = process.env.BACKEND_PORT || 4001;

// Security headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// Env-driven CORS allowlist
const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3001,http://localhost:5173')
  .split(',').map(o => o.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (corsOrigins.includes('*') || corsOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS blocked for origin ${origin}`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '5mb' }));

// General rate limiter: 100 requests per 15 minutes per IP
app.use('/api', generalRateLimiter);

// Store AI rate limiter for per-route use
app.set('aiRateLimiter', aiRateLimiter);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/bom', require('./routes/bom'));
app.use('/api/alternatives', require('./routes/alternatives'));
app.use('/api/obsolescence', require('./routes/obsolescence'));
app.use('/api/leadtime', require('./routes/leadtime'));
app.use('/api/costdown', require('./routes/costdown'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/compliance', require('./routes/compliance'));
app.use('/api/bomversions', require('./routes/bomversions'));
app.use('/api/risks', require('./routes/risks'));
app.use('/api/export', require('./routes/export'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/ai', require('./routes/aiNew'));
app.use('/api/parts', require('./routes/parts'));
app.use('/api/webhooks', require('./routes/webhooks'));
// Pass-5 backlog: notifications stub (NEEDS-CREDS), RAG/multi-agent/whitelabel (NEEDS-PRODUCT-DECISION)
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/ai', require('./routes/aiBacklog'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));


app.use('/api/agentic-procurement', require('./routes/agenticProcurement')); // apply pass 6 — audit custom suggestion

app.use('/api/datasheet-rag', require('./routes/datasheetRag')); // apply pass 6 — audit custom suggestion

app.use('/api/lead-time-drift', require('./routes/leadTimeDriftDetector')); // apply pass 6 — audit custom suggestion

app.use('/api/white-label-tenant', require('./routes/whiteLabelTenant')); // apply pass 6 — audit custom suggestion
app.use('/api/supplier-pcn-impact-matrix', require('./routes/supplierPcnImpactMatrix'));
app.use('/api/change-workflows', require('./routes/changeWorkflows'));
app.listen(PORT, () => {
  console.log(`🚀 BOM Optimizer API running on port ${PORT}`);
});
