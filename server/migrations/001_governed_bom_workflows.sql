ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(40) NOT NULL DEFAULT 'viewer';
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100);

CREATE TABLE IF NOT EXISTS bom_change_workflows (
  id UUID PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  idempotency_key VARCHAR(200) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  bom_id VARCHAR(200) NOT NULL,
  status VARCHAR(60) NOT NULL CHECK (status IN ('blocked', 'awaiting_engineering_approval', 'approved')),
  proposal JSONB NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  approved_by INTEGER REFERENCES users(id),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS bom_change_events (
  id UUID PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES bom_change_workflows(id) ON DELETE CASCADE,
  tenant_id VARCHAR(100) NOT NULL,
  actor_id INTEGER NOT NULL REFERENCES users(id),
  event_type VARCHAR(80) NOT NULL,
  from_status VARCHAR(60),
  to_status VARCHAR(60) NOT NULL,
  evidence_hash CHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bom_change_tenant_status ON bom_change_workflows(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_bom_change_events_workflow ON bom_change_events(workflow_id, created_at);
