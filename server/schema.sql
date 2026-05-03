DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS risk_assessments CASCADE;
DROP TABLE IF EXISTS bom_versions CASCADE;
DROP TABLE IF EXISTS compliance_records CASCADE;
DROP TABLE IF EXISTS inventory_records CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS cost_down_analyses CASCADE;
DROP TABLE IF EXISTS lead_time_records CASCADE;
DROP TABLE IF EXISTS obsolescence_predictions CASCADE;
DROP TABLE IF EXISTS alternative_parts CASCADE;
DROP TABLE IF EXISTS bom_items CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE bom_items (
  id SERIAL PRIMARY KEY,
  part_number VARCHAR(100) NOT NULL,
  part_name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  manufacturer VARCHAR(255),
  unit_cost DECIMAL(12,2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  total_cost DECIMAL(12,2),
  supplier VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active',
  parent_id INTEGER REFERENCES bom_items(id) ON DELETE SET NULL,
  ai_optimization_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE alternative_parts (
  id SERIAL PRIMARY KEY,
  original_part_id INTEGER REFERENCES bom_items(id) ON DELETE CASCADE,
  alt_part_number VARCHAR(100) NOT NULL,
  alt_part_name VARCHAR(255) NOT NULL,
  alt_manufacturer VARCHAR(255),
  alt_unit_cost DECIMAL(12,2),
  alt_supplier VARCHAR(255),
  compatibility_score DECIMAL(5,2),
  cost_savings_percent DECIMAL(5,2),
  lead_time_days INTEGER,
  notes TEXT,
  ai_recommendation TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE obsolescence_predictions (
  id SERIAL PRIMARY KEY,
  bom_item_id INTEGER REFERENCES bom_items(id) ON DELETE CASCADE,
  risk_level VARCHAR(20) NOT NULL,
  predicted_eol_date DATE,
  confidence_score DECIMAL(5,2),
  lifecycle_stage VARCHAR(50),
  last_buy_date DATE,
  recommended_action TEXT,
  ai_analysis TEXT,
  mitigation_strategy TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE lead_time_records (
  id SERIAL PRIMARY KEY,
  bom_item_id INTEGER REFERENCES bom_items(id) ON DELETE CASCADE,
  supplier VARCHAR(255) NOT NULL,
  standard_lead_time_days INTEGER,
  current_lead_time_days INTEGER,
  expedited_lead_time_days INTEGER,
  last_order_date DATE,
  next_delivery_date DATE,
  reliability_score DECIMAL(5,2),
  trend VARCHAR(20),
  ai_forecast TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE cost_down_analyses (
  id SERIAL PRIMARY KEY,
  bom_item_id INTEGER REFERENCES bom_items(id) ON DELETE CASCADE,
  analysis_type VARCHAR(100) NOT NULL,
  current_cost DECIMAL(12,2),
  target_cost DECIMAL(12,2),
  achieved_cost DECIMAL(12,2),
  savings_amount DECIMAL(12,2),
  savings_percent DECIMAL(5,2),
  strategy TEXT,
  implementation_status VARCHAR(50) DEFAULT 'proposed',
  priority VARCHAR(20),
  ai_suggestions TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE suppliers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  address TEXT,
  country VARCHAR(100),
  rating DECIMAL(3,1),
  quality_score DECIMAL(5,2),
  delivery_score DECIMAL(5,2),
  price_score DECIMAL(5,2),
  total_orders INTEGER DEFAULT 0,
  on_time_delivery_percent DECIMAL(5,2),
  category VARCHAR(100),
  status VARCHAR(50) DEFAULT 'active',
  notes TEXT,
  ai_evaluation TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE inventory_records (
  id SERIAL PRIMARY KEY,
  bom_item_id INTEGER REFERENCES bom_items(id) ON DELETE CASCADE,
  warehouse_location VARCHAR(100),
  current_stock INTEGER DEFAULT 0,
  minimum_stock INTEGER DEFAULT 0,
  reorder_point INTEGER DEFAULT 0,
  reorder_quantity INTEGER DEFAULT 0,
  max_stock INTEGER DEFAULT 0,
  unit_of_measure VARCHAR(20) DEFAULT 'pcs',
  last_restock_date DATE,
  next_restock_date DATE,
  stock_status VARCHAR(50),
  holding_cost_per_unit DECIMAL(10,2),
  ai_recommendation TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE compliance_records (
  id SERIAL PRIMARY KEY,
  bom_item_id INTEGER REFERENCES bom_items(id) ON DELETE CASCADE,
  regulation_type VARCHAR(100) NOT NULL,
  compliance_status VARCHAR(50) NOT NULL,
  certificate_number VARCHAR(100),
  expiry_date DATE,
  testing_lab VARCHAR(255),
  test_date DATE,
  rohs_compliant BOOLEAN DEFAULT false,
  reach_compliant BOOLEAN DEFAULT false,
  conflict_mineral_free BOOLEAN DEFAULT false,
  documentation_url VARCHAR(500),
  notes TEXT,
  ai_assessment TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE bom_versions (
  id SERIAL PRIMARY KEY,
  version_name VARCHAR(255) NOT NULL,
  version_number VARCHAR(20),
  description TEXT,
  total_cost DECIMAL(12,2),
  total_items INTEGER,
  change_type VARCHAR(100),
  changed_by VARCHAR(255),
  change_reason TEXT,
  baseline_version_id INTEGER,
  cost_difference DECIMAL(12,2),
  status VARCHAR(50) DEFAULT 'draft',
  ai_comparison TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  user_email VARCHAR(255),
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id INTEGER,
  entity_name VARCHAR(255),
  details TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE risk_assessments (
  id SERIAL PRIMARY KEY,
  bom_item_id INTEGER REFERENCES bom_items(id) ON DELETE CASCADE,
  risk_category VARCHAR(100) NOT NULL,
  risk_score DECIMAL(5,2),
  probability VARCHAR(20),
  impact VARCHAR(20),
  supply_chain_risk VARCHAR(20),
  geopolitical_risk VARCHAR(20),
  single_source_risk BOOLEAN DEFAULT false,
  mitigation_plan TEXT,
  contingency_plan TEXT,
  risk_owner VARCHAR(255),
  review_date DATE,
  ai_analysis TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE ai_results (
  id SERIAL PRIMARY KEY,
  feature VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id INTEGER,
  user_email VARCHAR(255),
  request_payload JSONB,
  response JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_results_feature ON ai_results(feature);
CREATE INDEX IF NOT EXISTS idx_ai_results_entity ON ai_results(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ai_results_created ON ai_results(created_at DESC);

CREATE TABLE bom_version_items (
  id SERIAL PRIMARY KEY,
  bom_version_id INTEGER REFERENCES bom_versions(id) ON DELETE CASCADE,
  bom_item_id INTEGER REFERENCES bom_items(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
