const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const auth = require('../middleware/auth');
const { queryOpenRouter, parseAIJson, persistAIResult } = require('../services/openrouter');
const router = express.Router();

const SYSTEM_PROMPT = 'You are a senior supply chain consultant with 20+ years of experience in supplier diversification, risk management, and procurement strategy for electronics and industrial components. Always respond with valid JSON.';

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

// POST /api/ai/diversify-supply — Supplier diversification advisor (structured JSON)
router.post('/diversify-supply',
  auth, aiRateLimit,
  [body('part_id').isInt({ min: 1 }).withMessage('part_id must be a positive integer')],
  validate,
  async (req, res) => {
    try {
      const { part_id } = req.body;

      const [partResult, riskResult, leadTimeResult, altPartsResult] = await Promise.all([
        pool.query('SELECT * FROM bom_items WHERE id = $1', [part_id]),
        pool.query('SELECT * FROM risk_assessments WHERE bom_item_id = $1', [part_id]),
        pool.query('SELECT * FROM lead_time_records WHERE bom_item_id = $1', [part_id]),
        pool.query('SELECT * FROM alternative_parts WHERE original_part_id = $1', [part_id]),
      ]);

      const part = partResult.rows[0];
      if (!part) return res.status(404).json({ error: 'Part not found' });

      const risks = riskResult.rows;
      const leadTimes = leadTimeResult.rows;
      const altParts = altPartsResult.rows;

      const prompt = `Perform supplier diversification analysis for this component. Respond ONLY in JSON format.

Component:
- Part: ${part.part_name} (${part.part_number})
- Category: ${part.category}, Supplier: ${part.supplier}, Manufacturer: ${part.manufacturer}
- Unit Cost: $${part.unit_cost}, Quantity: ${part.quantity}, Annual Spend: $${part.total_cost}

Current Risk Profile: ${JSON.stringify(risks.map(r => ({ risk_score: r.risk_score, single_source: r.single_source_risk, category: r.risk_category })))}
Lead Times: ${JSON.stringify(leadTimes.map(lt => ({ supplier: lt.supplier, days: lt.current_lead_time_days, reliability: lt.reliability_score })))}
Known Alternatives: ${JSON.stringify(altParts.map(a => ({ part: a.alt_part_number, supplier: a.alt_supplier, cost: a.alt_unit_cost })))}

{
  "single_source_risk_score": 8,
  "single_source_justification": "...",
  "alternative_suppliers": [
    {
      "company_name": "...",
      "country": "...",
      "estimated_lead_time_days": 0,
      "estimated_cost_delta_pct": 0.0,
      "qualification_effort": "low|medium|high",
      "notes": "..."
    }
  ],
  "switching_cost_estimate": {
    "tooling_usd": 0,
    "qualification_usd": 0,
    "testing_usd": 0,
    "logistics_usd": 0,
    "total_usd": 0,
    "notes": "..."
  },
  "diversification_roadmap": [
    {"month": 1, "milestone": "...", "action": "..."}
  ],
  "recommended_supplier_split": {"primary_pct": 60, "secondary_pct": 40, "notes": "..."},
  "risk_mitigation_during_transition": ["..."],
  "overall_recommendation": "..."
}`;

      const rawAnalysis = await queryOpenRouter(prompt, SYSTEM_PROMPT);
      const data = parseAIJson(rawAnalysis);
      await persistAIResult(pool, {
        feature: 'diversify-supply',
        entity_type: 'bom_item',
        entity_id: part_id,
        user_email: req.user?.email,
        request_payload: req.body,
        response: data,
      });

      res.json({ success: true, data, part, current_risks: risks, lead_times: leadTimes, known_alternatives: altParts });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

module.exports = router;
