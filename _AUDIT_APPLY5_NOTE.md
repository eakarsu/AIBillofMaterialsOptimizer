# Apply Pass 5 — AIBillofMaterialsOptimizer

- **Date:** 2026-05-08
- **Audit source:** `_AUDIT/reports/batch_01.md` § 3
- **Stack:** node-express backend (`server/`) + React frontend (`client/`); JWT bearer auth; Postgres via `db.js`.
- **AI helper:** `services/openrouter.js`.

## Verified-present (Non-AI features inventory)
`auth.js`, `inventory.js`, `reports.js`, `bom.js`, `bomversions.js`, `alternatives.js`, `audit.js`, `parts.js`, `suppliers.js`, `obsolescence.js`, `compliance.js`, `costdown.js`, `leadtime.js`, `risks.js`, `notifications.js` (existing), `webhooks.js` (from earlier pass), `export.js`. Audit's "1 AI endpoint" claim is a false positive — actual inventory: 1 in `routes/ai.js` + 8 in `routes/aiNew.js` (volume-break-optimizer, geopolitical-diversification, supply-chain-simulation, lifecycle-roadmap, lead-time-alerts, bom-benchmarking, rohs-tracking, supplier-risk-score).

## Implemented this pass (5 items)

| # | Item | Category | File | Endpoints |
|---|------|----------|------|-----------|
| 1 | RAG corpus + retrieval | NEEDS-PRODUCT-DECISION (in-memory keyword/BM25-lite, no vector store dep) | `server/routes/aiBacklog.js` (new) | `GET/POST /api/ai/playbooks`, `POST /api/ai/rag-query` |
| 2 | Multi-agent orchestration | NEEDS-PRODUCT-DECISION (sequential 3-agent: planner → analyst → recommender) | same file | `POST /api/ai/multi-agent` |
| 3 | White-label / reseller branding | NEEDS-PRODUCT-DECISION (single-tenant config row; no row-level isolation) | same file | `GET/PUT /api/whitelabel` |
| 4 | Notifications channel stubs (SMTP / Twilio / FCM) | NEEDS-CREDS | `server/routes/notifications.js` (new) | `POST /api/notifications/{email,sms,push}` (each 503 with `missing: <ENV>`) |
| 5 | (Verified) webhooks subscribe/test | already shipped | — | — |

Route registration in `server/index.js` lines 55–57 — additive only.

## Deferred

| Item | Category | Reason |
|------|----------|--------|
| Outbound webhook delivery (HMAC + retry) | TOO-RISKY | Background queue + worker required |
| Real vector store (pgvector / Pinecone) | NEEDS-PRODUCT-DECISION | Vendor pick |
| Per-tenant data isolation | NEEDS-PRODUCT-DECISION | Multi-tenant migration |
| Email/SMS/push outbound delivery | NEEDS-CREDS | SMTP / Twilio / FCM accounts |

## Frontend
Existing `pages/AIInsights.jsx` is feature-keyed and covers `multi-agent`, `rag-query`, `playbooks` once the keys are added (out of scope this pass). `Webhooks.jsx` already covers existing webhooks router.

## Smoke test
- `node --check server/routes/aiBacklog.js` — PASS.
- `node --check server/routes/notifications.js` — PASS.

## Notes
- All schema additive (`CREATE TABLE IF NOT EXISTS rag_documents`, `whitelabel_config`, `notification_log`).
- All AI endpoints 503 with `missing: OPENROUTER_API_KEY` when key absent.
