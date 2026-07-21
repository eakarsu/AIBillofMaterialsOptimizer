# Completeness Review: AIBillofMaterialsOptimizer

- **Review date:** 2026-07-18
- **Assessment basis:** Static source and configuration inspection only. Dependencies were not installed, and no build, database migration, external integration, or runtime workflow was executed.

## Classification

**Prototype-demo**

## Verdict

The repository presents a broad bill-of-materials optimization surface (81 source files and 35 route modules), but the static evidence is characteristic of a generated prototype. Pages and endpoints demonstrate concepts; they do not establish a verified execution path for ingest versioned product structures, alternates, costs, supply, compliance, and change constraints to produce feasible proposals.

## Why it is not complete

- 10 files are explicitly named as gap/gap-feature implementations; route/page count therefore overstates completed product capability.
- 43 files reference model-provider or chat-completion behavior; these generic LLM paths are not a substitute for deterministic domain execution, grounding, or evaluation.
- 21 files contain mock, sample, placeholder, or random-data signals, leaving important outcomes disconnected from authoritative systems.
- No recognizable application test files were found in the inspected tree.
- No CI workflow was found to continuously verify builds, tests, migrations, or security checks.
- No environment example/template was found, so required configuration and secret boundaries are undocumented.

## Needed features

- 1. Implement a workflow to ingest versioned product structures, alternates, costs, supply, compliance, and change constraints to produce feasible proposals.
- 2. Connect PLM/ERP/MRP, supplier, inventory, costing, and lifecycle systems; replace seed/demo records with durable, synchronized data and explicit failure handling.
- 3. Validate substitutions, effectivity, rollups, constraints, and change impact against released BOMs.
- 4. Enforce role approvals, supplier/IP controls, provenance, and auditable engineering changes.
- 5. Add contract, integration, authorization, migration, and end-to-end tests in CI, plus a documented non-destructive deployment/run path.

## Risks or launch blockers

- The root launcher can terminate unrelated processes occupying configured ports.
- The root launcher seeds, creates, migrates, or otherwise mutates database state during startup.
- The root launcher installs dependencies at run time, reducing reproducibility and expanding supply-chain risk.
- Ungrounded or malformed model output can become a domain action unless schemas, evidence, evaluations, and approval gates are added.

## Evidence inspected

- `client/package.json` — declared scripts, runtime dependencies, and application boundaries.
- `server/package.json` — declared scripts, runtime dependencies, and application boundaries.
- `client/src/App.jsx` — front-end navigation and visible workflow surface.
- `server/index.js` — service composition, middleware, and registered routes.
- `server/routes/agenticProcurement.js` — implemented API surface and domain/AI request handling.
- `server/routes/ai.js` — implemented API surface and domain/AI request handling.

## Recommended next action

Treat this as a prototype: select one narrow bill-of-materials optimization outcome, remove or quarantine generated gap routes, and implement that outcome end to end with real data, deterministic rules, and tests before adding features.

## Implementation progress

- **1 — Implemented locally:** `server/domain/bomProposal.js`, `server/routes/changeWorkflows.js`, and `server/migrations/001_governed_bom_workflows.sql` now provide an idempotent, tenant-scoped, durable released-BOM change workflow with deterministic rollups, effectivity/substitution checks, optimistic concurrency, engineering approval, and append-only events.
- **2 — Boundary implemented; external adapters blocked:** seed/generic gap endpoints are no longer mounted, provider fields must carry supplier and evidence identifiers, and `OPERATIONS.md` defines the required PLM/ERP/MRP, inventory, lifecycle, costing, currency, and supplier sync contract. Real systems, credentials, signed callbacks, cursor reconciliation, and failure-injection tests are still required.
- **3 — Implemented locally:** the evaluator blocks unreleased bases, duplicate parts, invalid quantities/costs/effectivity, mixed currencies without an explicit conversion path, inactive lifecycle state, failed compliance, unsupported substitutions, missing evidence, and cost-constraint violations. Validation against authoritative released BOMs remains an external acceptance requirement.
- **4 — Implemented locally:** authentication now carries controlled role/tenant claims; self-registration is `viewer`; engineering approval is role-gated; tenant predicates, evidence hashes, version checks, and audit events protect changes. Supplier/IP policy and organizational role provisioning require owner configuration.
- **5 and launch risks — Implemented locally:** dependency-free workflow tests, CI, `.env.example`, strict JWT/database configuration, non-destructive `start.sh`, explicit bootstrap/migrate scripts, and guarded destructive demo seeding were added. Static checks and three domain tests pass; dependencies, database, providers, and end-to-end services were not run in this review.
