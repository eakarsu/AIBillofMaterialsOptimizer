const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const { queryOpenRouter, parseAIJson, persistAIResult } = require('../services/openrouter');
const auth = require('../middleware/auth');
const router = express.Router();

const SYSTEM_PROMPT = 'You are an expert supply chain engineer and BOM optimization specialist. Provide actionable cost reduction and risk mitigation recommendations. Always respond with valid JSON.';

function aiRateLimit(req, res, next) {
  const limiter = req.app.get('aiRateLimiter');
  if (limiter) return limiter(req, res, next);
  next();
}

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
}

async function runAI({ req, res, feature, entity_type, entity_id, prompt }) {
  try {
    const analysis = await queryOpenRouter(prompt, SYSTEM_PROMPT);
    const data = parseAIJson(analysis);
    await persistAIResult(pool, {
      feature, entity_type, entity_id,
      user_email: req.user?.email,
      request_payload: req.body,
      response: data,
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ─── 1. Smart Volume Break Optimizer ─────────────────────────────────────────
router.post('/volume-break-optimizer',
  auth, aiRateLimit,
  [
    body('bom_items').isArray({ min: 1 }).withMessage('bom_items must be a non-empty array'),
    body('volume_scenarios').isArray({ min: 1 }).withMessage('volume_scenarios must be a non-empty array'),
  ],
  validate,
  async (req, res) => {
    const { bom_items, volume_scenarios } = req.body;
    const prompt = `Analyze the following BOM items and volume scenarios to identify optimal purchase volume thresholds that maximize price breaks and minimize total cost.

BOM Items:
${JSON.stringify(bom_items, null, 2)}

Volume Scenarios to evaluate:
${JSON.stringify(volume_scenarios, null, 2)}

Respond ONLY in JSON format:
{
  "recommendations": [
    {"part_number": "...", "part_name": "...", "current_volume": N, "optimal_volume": N,
     "price_break_thresholds": [{"quantity": N, "unit_price": N, "total_savings": N}],
     "recommended_scenario": "...", "annual_savings": N, "rationale": "..."}
  ],
  "consolidated_opportunities": ["..."],
  "total_potential_savings": N,
  "implementation_priority": ["..."],
  "risks": ["..."]
}`;
    return runAI({ req, res, feature: 'volume-break-optimizer', entity_type: 'bom_set', entity_id: null, prompt });
  }
);

// ─── 2. Geopolitical Supply Diversification ─────────────────────────────────
router.post('/geopolitical-diversification',
  auth, aiRateLimit,
  [
    body('suppliers').isArray({ min: 1 }).withMessage('suppliers must be a non-empty array'),
    body('country_data').optional().isObject(),
  ],
  validate,
  async (req, res) => {
    const { suppliers, country_data = {} } = req.body;
    const prompt = `Perform a geopolitical risk assessment for the following supplier base and provide alternative sourcing recommendations to reduce country concentration risk.

Current Suppliers:
${JSON.stringify(suppliers, null, 2)}

Country Risk Data:
${JSON.stringify(country_data, null, 2)}

Respond ONLY in JSON format:
{
  "country_risk_scores": [{"country": "...", "risk_score": N, "risk_factors": ["..."], "trend": "...", "recommendations": "..."}],
  "concentration_risk": {"high_risk_countries": ["..."], "spend_concentration_pct": N, "diversification_score": N},
  "alternative_sourcing": [{"current_supplier": "...", "current_country": "...", "alternative_countries": ["..."], "estimated_cost_delta_pct": N, "lead_time_impact_days": N, "qualification_effort": "low|medium|high", "rationale": "..."}],
  "priority_actions": ["..."],
  "target_country_distribution": {"country": "target_pct"},
  "overall_geopolitical_risk": "low|medium|high|critical"
}`;
    return runAI({ req, res, feature: 'geopolitical-diversification', entity_type: 'suppliers', entity_id: null, prompt });
  }
);

// ─── 3. Supply Chain Simulation ─────────────────────────────────────────────
router.post('/supply-chain-simulation',
  auth, aiRateLimit,
  [
    body('bom_items').isArray({ min: 1 }).withMessage('bom_items must be a non-empty array'),
    body('disruption_scenario').isObject().withMessage('disruption_scenario must be an object'),
    body('disruption_scenario.type').notEmpty().withMessage('disruption_scenario.type is required'),
  ],
  validate,
  async (req, res) => {
    const { bom_items, disruption_scenario } = req.body;
    const prompt = `Simulate the production impact of the following supply chain disruption scenario on the given BOM items.

BOM Items:
${JSON.stringify(bom_items, null, 2)}

Disruption Scenario:
${JSON.stringify(disruption_scenario, null, 2)}

Respond ONLY in JSON format:
{
  "impact_summary": {"severity": "low|medium|high|critical", "affected_parts_count": N, "production_downtime_days": N, "estimated_revenue_loss": N, "recovery_time_weeks": N},
  "affected_items": [{"part_number": "...", "part_name": "...", "impact_level": "...", "days_of_stock_remaining": N, "alternative_available": true, "recommended_action": "..."}],
  "mitigation_steps": ["..."],
  "contingency_suppliers": ["..."],
  "buffer_stock_recommendations": [{"part_number": "...", "recommended_buffer_days": N}],
  "recovery_roadmap": ["..."],
  "risk_score": N
}`;
    return runAI({ req, res, feature: 'supply-chain-simulation', entity_type: 'bom_set', entity_id: null, prompt });
  }
);

// ─── 4. Component Lifecycle Roadmap ─────────────────────────────────────────
router.post('/lifecycle-roadmap',
  auth, aiRateLimit,
  [ body('components').isArray({ min: 1 }).withMessage('components must be a non-empty array') ],
  validate,
  async (req, res) => {
    const { components } = req.body;
    const prompt = `Analyze the following components and generate technology maturity curves with refresh recommendations.

Components:
${JSON.stringify(components, null, 2)}

Respond ONLY in JSON format:
{
  "lifecycle_analysis": [{"part_number": "...", "part_name": "...", "manufacturer": "...", "lifecycle_stage": "introduction|growth|maturity|decline|obsolete", "estimated_eol_date": "YYYY-MM-DD", "years_remaining": N, "maturity_score": N, "technology_trend": "...", "refresh_urgency": "...", "recommended_replacement": "...", "migration_effort": "...", "cost_impact": "..."}],
  "refresh_roadmap": [{"priority": N, "part_number": "...", "action": "...", "timeline": "...", "estimated_cost": N, "risk_if_deferred": "..."}],
  "summary": {"critical_eol_count": N, "components_needing_action_12mo": N, "estimated_refresh_budget": N, "overall_portfolio_health": "good|fair|poor|critical"}
}`;
    return runAI({ req, res, feature: 'lifecycle-roadmap', entity_type: 'components', entity_id: null, prompt });
  }
);

// ─── 5. Predictive Lead Time Alerts (NEW) ───────────────────────────────────
router.post('/lead-time-alerts',
  auth, aiRateLimit,
  [
    body('part_id').optional().isInt({ min: 1 }),
    body('lookback_days').optional().isInt({ min: 7, max: 365 }),
  ],
  validate,
  async (req, res) => {
    try {
      const { part_id, lookback_days = 90 } = req.body;
      let leadtimes = [];
      let bomItems = [];
      try {
        if (part_id) {
          const r = await pool.query(
            `SELECT * FROM lead_time_records WHERE bom_item_id = $1 AND created_at >= NOW() - INTERVAL '${parseInt(lookback_days)} days' ORDER BY created_at ASC`,
            [part_id]
          );
          leadtimes = r.rows;
          const b = await pool.query('SELECT * FROM bom_items WHERE id = $1', [part_id]);
          bomItems = b.rows;
        } else {
          const r = await pool.query(
            `SELECT * FROM lead_time_records WHERE created_at >= NOW() - INTERVAL '${parseInt(lookback_days)} days' ORDER BY bom_item_id, created_at ASC`
          );
          leadtimes = r.rows;
          const b = await pool.query('SELECT id, part_number, part_name, supplier, manufacturer, quantity FROM bom_items ORDER BY id LIMIT 200');
          bomItems = b.rows;
        }
      } catch { /* tables might be missing */ }

      const prompt = `You are a supply-chain analyst. Examine the following lead-time observations and BOM context, and produce predictive lead-time alerts highlighting parts where lead times are increasing or volatile, with a forward-buy recommendation.

Lookback: ${lookback_days} days
BOM Items (${bomItems.length}):
${JSON.stringify(bomItems, null, 2)}

Lead Time Records (${leadtimes.length}):
${JSON.stringify(leadtimes, null, 2)}

Respond ONLY in JSON format:
{
  "alerts": [
    {"part_number": "...", "part_name": "...", "current_lead_time_days": N, "trend_pct": N, "trend_direction": "increasing|decreasing|stable", "volatility_score": N, "alert_severity": "info|warning|critical", "recommended_forward_buy_qty": N, "recommended_action": "..."}
  ],
  "summary": {"parts_at_risk": N, "average_increase_pct": N, "estimated_buffer_investment_usd": N},
  "recommended_priority": ["..."]
}`;
      return runAI({ req, res, feature: 'lead-time-alerts', entity_type: 'bom_item', entity_id: part_id || null, prompt });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// ─── 6. BOM Benchmarking vs Competitors (NEW) ──────────────────────────────
router.post('/bom-benchmarking',
  auth, aiRateLimit,
  [
    body('product_category').notEmpty().withMessage('product_category is required'),
    body('competitor_products').optional().isArray(),
  ],
  validate,
  async (req, res) => {
    try {
      const { product_category, competitor_products = [] } = req.body;
      let topCost = [];
      try {
        const r = await pool.query(
          `SELECT id, part_number, part_name, category, manufacturer, supplier, unit_cost, quantity, total_cost
           FROM bom_items
           WHERE ($1 = '' OR category ILIKE $2)
           ORDER BY total_cost::numeric DESC NULLS LAST LIMIT 50`,
          [product_category || '', `%${product_category}%`]
        );
        topCost = r.rows;
      } catch {}

      const totalCost = topCost.reduce((s, i) => s + parseFloat(i.total_cost || 0), 0);
      const prompt = `You are a competitive teardown analyst. Estimate where this BOM's cost structure stands relative to competitor products in the same category.

Product Category: ${product_category}
Total BOM Cost (top 50 items): $${totalCost.toFixed(2)}
Top BOM Items:
${JSON.stringify(topCost, null, 2)}

Competitor Products (provided):
${JSON.stringify(competitor_products, null, 2)}

Respond ONLY in JSON format:
{
  "estimated_market_band": {"low": N, "median": N, "high": N},
  "current_total_cost": ${totalCost.toFixed(2)},
  "delta_vs_market_pct": N,
  "competitive_position": "leader|parity|laggard",
  "category_breakdown": [{"category": "...", "your_share_pct": N, "competitor_avg_pct": N, "delta": N, "interpretation": "..."}],
  "high_cost_outliers": [{"part_number": "...", "part_name": "...", "estimated_overpay_pct": N, "rationale": "..."}],
  "competitor_inferences": [{"competitor": "...", "estimated_total_cost": N, "key_advantages": ["..."], "key_disadvantages": ["..."]}],
  "savings_opportunity_usd": N,
  "strategic_recommendations": ["..."]
}`;
      return runAI({ req, res, feature: 'bom-benchmarking', entity_type: 'category', entity_id: null, prompt });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// ─── 7. Automated RoHS / Compliance Certification Tracking (NEW) ───────────
router.post('/rohs-tracking',
  auth, aiRateLimit,
  [
    body('region').optional().isString(),
    body('regulations').optional().isArray(),
  ],
  validate,
  async (req, res) => {
    try {
      const { region = 'GLOBAL', regulations = ['RoHS', 'REACH', 'Conflict Minerals', 'Prop 65'] } = req.body;
      let parts = [];
      let complianceRecords = [];
      try {
        const p = await pool.query('SELECT id, part_number, part_name, manufacturer, supplier, category FROM bom_items LIMIT 200');
        parts = p.rows;
        const c = await pool.query('SELECT * FROM compliance_records ORDER BY created_at DESC LIMIT 200');
        complianceRecords = c.rows;
      } catch {}

      const prompt = `You are a global compliance specialist. Evaluate the BOM for the listed regulations in ${region} and produce a tracking dashboard with required actions, certification status, and update triggers as regulations evolve.

Regulations: ${regulations.join(', ')}
Region: ${region}

BOM (${parts.length}):
${JSON.stringify(parts, null, 2)}

Existing Compliance Records (${complianceRecords.length}):
${JSON.stringify(complianceRecords, null, 2)}

Respond ONLY in JSON format:
{
  "regulation_status": [
    {"regulation": "...", "compliant_pct": N, "non_compliant_pct": N, "unknown_pct": N, "last_review_date": "YYYY-MM-DD", "next_review_due_days": N, "regulatory_change_alert": "..."}
  ],
  "non_compliant_parts": [{"part_number": "...", "regulation": "...", "issue": "...", "remediation": "...", "deadline_days": N}],
  "certification_renewal_calendar": [{"item": "...", "due_date": "YYYY-MM-DD", "owner": "..."}],
  "regulation_updates_to_track": [{"regulation": "...", "expected_effective_date": "YYYY-MM-DD", "expected_impact": "...", "preparation_steps": ["..."]}],
  "overall_compliance_score": N,
  "priority_actions": ["..."]
}`;
      return runAI({ req, res, feature: 'rohs-tracking', entity_type: 'compliance', entity_id: null, prompt });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// ─── 8. Supplier Relationship Risk Score (NEW) ─────────────────────────────
router.post('/supplier-risk-score',
  auth, aiRateLimit,
  [
    body('supplier_id').optional().isInt({ min: 1 }),
  ],
  validate,
  async (req, res) => {
    try {
      const { supplier_id } = req.body;
      let suppliers = [];
      let leadtimes = [];
      let parts = [];
      try {
        if (supplier_id) {
          const s = await pool.query('SELECT * FROM suppliers WHERE id = $1', [supplier_id]);
          suppliers = s.rows;
          const lt = await pool.query(
            `SELECT lt.* FROM lead_time_records lt
             JOIN bom_items bi ON lt.bom_item_id = bi.id
             WHERE bi.supplier = (SELECT name FROM suppliers WHERE id = $1)
             ORDER BY lt.created_at DESC LIMIT 50`,
            [supplier_id]
          );
          leadtimes = lt.rows;
          const p = await pool.query(
            `SELECT id, part_number, part_name, total_cost FROM bom_items WHERE supplier = (SELECT name FROM suppliers WHERE id = $1) LIMIT 50`,
            [supplier_id]
          );
          parts = p.rows;
        } else {
          const s = await pool.query('SELECT * FROM suppliers ORDER BY id LIMIT 25');
          suppliers = s.rows;
        }
      } catch {}

      const prompt = `You are a supplier risk analyst. Score each supplier across financial health, quality, delivery reliability, geopolitical exposure, and relationship strength to produce a unified Supplier Relationship Risk Score (SRRS) with mitigation recommendations.

Suppliers:
${JSON.stringify(suppliers, null, 2)}

Lead Time Observations (last 50):
${JSON.stringify(leadtimes, null, 2)}

Top Parts From Supplier (if supplier_id specified):
${JSON.stringify(parts, null, 2)}

Respond ONLY in JSON format:
{
  "supplier_scores": [
    {"supplier_id": N, "supplier_name": "...", "srrs_score": N, "tier": "A|B|C|D",
     "financial_health": N, "quality_score": N, "delivery_reliability": N,
     "geopolitical_exposure": N, "relationship_strength": N,
     "early_warning_indicators": ["..."], "recommended_action": "expand|maintain|monitor|reduce|exit",
     "mitigation_steps": ["..."]}
  ],
  "portfolio_summary": {"avg_srrs": N, "tier_distribution": {"A": N, "B": N, "C": N, "D": N}, "single_source_risk_count": N},
  "priority_actions": ["..."]
}`;
      return runAI({ req, res, feature: 'supplier-risk-score', entity_type: 'supplier', entity_id: supplier_id || null, prompt });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// ─── GET /api/ai/results — paginated AI history ─────────────────────────────
router.get('/results', auth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
    const offset = (page - 1) * limit;
    const { feature, entity_type, entity_id } = req.query;

    const conditions = [];
    const params = [];
    if (feature) { params.push(feature); conditions.push(`feature = $${params.length}`); }
    if (entity_type) { params.push(entity_type); conditions.push(`entity_type = $${params.length}`); }
    if (entity_id) { params.push(parseInt(entity_id)); conditions.push(`entity_id = $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Table is created in schema.sql — no inline CREATE TABLE needed

    const countResult = await pool.query(`SELECT COUNT(*) FROM ai_results ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(limit, offset);
    const result = await pool.query(
      `SELECT * FROM ai_results ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({
      data: result.rows,
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) || 1 },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
