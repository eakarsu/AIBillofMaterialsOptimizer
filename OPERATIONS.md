# Governed BOM workflow

`POST /api/change-workflows` accepts a released base version, versioned proposal, costs, effectivity, supplier/lifecycle/compliance state, and evidence references. Send an `Idempotency-Key`; retries with changed input are rejected. The deterministic evaluator blocks invalid quantities, mixed currencies without conversion, missing evidence, unreleased bases, inactive lifecycle state, failed compliance, invalid substitutions, and cost overruns. `POST /:id/approve` requires an `engineer` or `admin` role and appends an immutable event.

Copy `.env.example`, run `scripts/bootstrap.sh`, provision the existing base schema, then run `scripts/migrate.sh`. `start.sh` only starts the two processes and only stops the PIDs it created. Demo seeding is destructive and requires `CONFIRM_DESTRUCTIVE_DEMO_SEED=yes`.

PLM/ERP/MRP, supplier, inventory, lifecycle, currency-rate, and engineering-document adapters are not fabricated here. Production use must authenticate their webhooks, persist sync cursors/failures, reconcile released BOMs, and validate the rules against authoritative engineering policy.
