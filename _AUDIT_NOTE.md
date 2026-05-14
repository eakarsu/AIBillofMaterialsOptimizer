# Audit Apply Note — AIBillofMaterialsOptimizer

Source: `_AUDIT/reports/batch_01.md` § 3.

## Audit findings vs. reality
The audit reported "1 AI endpoint" but in fact the project ships 9 (one in `routes/ai.js` and 8 more in `routes/aiNew.js`: volume-break-optimizer, geopolitical-diversification, supply-chain-simulation, lifecycle-roadmap, lead-time-alerts, bom-benchmarking, rohs-tracking, supplier-risk-score). Audit's "limited AI coverage" claim is inaccurate.

## Original audit recommendations
- Limited AI coverage (false; see above)
- Missing notifications system
- Missing integration API (no webhooks)
- Strategic features: agentic workflows, RAG, real-time anomaly detection, white-label

## Implemented in this pass (MECHANICAL)

| # | Item | File | Endpoints |
|---|------|------|-----------|
| 1 | Webhook subscription stub | `server/routes/webhooks.js` (new) + `server/index.js` | `GET/POST/DELETE /api/webhooks`, `POST /api/webhooks/:id/test`, `GET /api/webhooks/_/events` |

Allowed events: bom created/updated/version_published, part obsolescence_alert, part lead_time_changed, supplier risk_changed, compliance violation. Lazy table; payload-only test endpoint (no outbound HTTP). `node --check` passes.

## Backlog (not implemented)

| Item | Tag | Why deferred |
|------|-----|---------------|
| Email/SMS/push notifications | NEEDS-CREDS | SMTP / Twilio / FCM credentials |
| Outbound webhook delivery (HMAC, retry) | TOO-RISKY | Background job infra |
| RAG over BOM/playbook docs | NEEDS-PRODUCT-DECISION | Vector store choice |
| White-label/reseller platform | NEEDS-PRODUCT-DECISION | Multi-tenant model |
| Multi-agent orchestration | NEEDS-PRODUCT-DECISION | Agent topology |

## Apply pass 3 (frontend)

- **Action:** LEFT-AS-IS — FE already wired.
- `client/src/pages/AIInsights.jsx` covers all 8 aiNew endpoints + history pagination via `GET /api/ai/results`.
- `client/src/pages/Webhooks.jsx` covers the pass-2 webhooks router.
- Both routes registered in `client/src/App.jsx`. JWT comes from `client/src/services/api.js` (`localStorage.getItem('token')`).
- No FE files modified.

## Apply pass 4 (mechanical backlog)

- **Action:** SKIPPED — no items in the Backlog table are MECHANICAL. All remaining entries are tagged NEEDS-CREDS (Email/SMS/push, outbound webhook delivery), NEEDS-PRODUCT-DECISION (RAG, white-label, multi-agent), or TOO-RISKY. Project already has 9 AI endpoints; nothing to add this pass.
