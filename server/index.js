const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { aiRateLimiter, generalRateLimiter } = require('./middleware/rateLimiter');
require('dotenv').config({ path: '../.env' });

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
app.listen(PORT, () => {
  console.log(`🚀 BOM Optimizer API running on port ${PORT}`);
});


// === Batch 01 Gaps & Frontend Mounts ===
app.use('/api/gap-only-1-mounted-ai-endpoint-despite-19-routes-no-ai', require('./routes/gap_only_1_mounted_ai_endpoint_despite_19_routes_no_ai'));
app.use('/api/gap-no-ai-obsolescence-prediction-logic-records-page-e', require('./routes/gap_no_ai_obsolescence_prediction_logic_records_page_e'));
app.use('/api/gap-no-ai-lead-time-forecasting-per-supplier', require('./routes/gap_no_ai_lead_time_forecasting_per_supplier'));
app.use('/api/gap-no-ai-compliance-clause-extraction-from-datasheets', require('./routes/gap_no_ai_compliance_clause_extraction_from_datasheets'));
app.use('/api/gap-no-ai-pcn-product-change-notification-summarizatio', require('./routes/gap_no_ai_pcn_product_change_notification_summarizatio'));
app.use('/api/gap-no-outbound-edi-for-supplier-purchase-orders-webho', require('./routes/gap_no_outbound_edi_for_supplier_purchase_orders_webho'));
app.use('/api/gap-notification-system-table-exists-but-no-email-sms-', require('./routes/gap_notification_system_table_exists_but_no_email_sms_'));
app.use('/api/gap-no-multi-currency-cost-tracking', require('./routes/gap_no_multi_currency_cost_tracking'));
app.use('/api/gap-no-pcn-ingestion-pipeline-only-an-obsolescence-pre', require('./routes/gap_no_pcn_ingestion_pipeline_only_an_obsolescence_pre'));
app.use('/api/gap-no-cad-eda-tool-import-altium-kicad-cadence', require('./routes/gap_no_cad_eda_tool_import_altium_kicad_cadence'));
