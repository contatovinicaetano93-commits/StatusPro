-- StatusPro initial schema
-- Distribuidora limpeza/papel — multi-UF

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  annual_revenue_target_brl NUMERIC(18,2) NOT NULL DEFAULT 100000000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ceo','finance','commercial','operations','admin')),
  password_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, email)
);

CREATE TABLE IF NOT EXISTS regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  uf TEXT NOT NULL,
  UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  external_id TEXT,
  name TEXT NOT NULL,
  document TEXT,
  uf TEXT NOT NULL,
  region_id UUID REFERENCES regions(id),
  segment TEXT NOT NULL DEFAULT 'midmarket',
  credit_limit_brl NUMERIC(18,2) NOT NULL DEFAULT 0,
  is_national_account BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_org ON customers(organization_id);

CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  external_id TEXT,
  name TEXT NOT NULL,
  uf TEXT,
  risk_score NUMERIC(5,2) NOT NULL DEFAULT 0.5
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  family TEXT NOT NULL,
  abc_class TEXT NOT NULL CHECK (abc_class IN ('A','B','C')),
  unit_cost_brl NUMERIC(18,4) NOT NULL,
  unit_price_brl NUMERIC(18,4) NOT NULL,
  min_stock NUMERIC(18,3) NOT NULL DEFAULT 0,
  UNIQUE (organization_id, sku)
);

CREATE TABLE IF NOT EXISTS sales_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  external_id TEXT,
  customer_id UUID NOT NULL REFERENCES customers(id),
  order_date DATE NOT NULL,
  due_date DATE,
  status TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'inside_sales',
  uf TEXT NOT NULL,
  requested_lines INT NOT NULL DEFAULT 0,
  fulfilled_lines INT NOT NULL DEFAULT 0,
  on_time_in_full BOOLEAN,
  net_amount_brl NUMERIC(18,2) NOT NULL DEFAULT 0,
  cogs_brl NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_orders_org_date ON sales_orders(organization_id, order_date);

CREATE TABLE IF NOT EXISTS sales_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  qty_requested NUMERIC(18,3) NOT NULL,
  qty_fulfilled NUMERIC(18,3) NOT NULL DEFAULT 0,
  unit_price_brl NUMERIC(18,4) NOT NULL,
  unit_cost_brl NUMERIC(18,4) NOT NULL
);

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sales_order_id UUID REFERENCES sales_orders(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  invoice_date DATE NOT NULL,
  net_amount_brl NUMERIC(18,2) NOT NULL,
  cogs_brl NUMERIC(18,2) NOT NULL DEFAULT 0,
  uf TEXT NOT NULL,
  external_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_invoices_org_date ON invoices(organization_id, invoice_date);

CREATE TABLE IF NOT EXISTS receivables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id),
  invoice_id UUID REFERENCES invoices(id),
  due_date DATE NOT NULL,
  open_amount_brl NUMERIC(18,2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open','paid','partial','written_off')),
  external_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_receivables_org_status ON receivables(organization_id, status, due_date);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  receivable_id UUID REFERENCES receivables(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  payment_date DATE NOT NULL,
  amount_brl NUMERIC(18,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS payables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id),
  due_date DATE NOT NULL,
  open_amount_brl NUMERIC(18,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
);

CREATE TABLE IF NOT EXISTS stock_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  product_id UUID NOT NULL REFERENCES products(id),
  as_of_date DATE NOT NULL,
  on_hand NUMERIC(18,3) NOT NULL,
  UNIQUE (organization_id, warehouse_id, product_id, as_of_date)
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  movement_date DATE NOT NULL,
  qty NUMERIC(18,3) NOT NULL,
  movement_type TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS freight_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  cost_date DATE NOT NULL,
  uf TEXT NOT NULL,
  amount_brl NUMERIC(18,2) NOT NULL,
  sales_order_id UUID REFERENCES sales_orders(id)
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  order_date DATE NOT NULL,
  status TEXT NOT NULL,
  amount_brl NUMERIC(18,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kpi_id TEXT NOT NULL,
  horizon TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  target_value NUMERIC(18,4) NOT NULL,
  UNIQUE (organization_id, kpi_id, period_start, period_end)
);

CREATE TABLE IF NOT EXISTS kpi_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kpi_id TEXT NOT NULL,
  horizon TEXT NOT NULL,
  as_of TIMESTAMPTZ NOT NULL,
  value NUMERIC(18,6) NOT NULL,
  target_value NUMERIC(18,6),
  previous_value NUMERIC(18,6),
  source TEXT NOT NULL,
  quality TEXT NOT NULL CHECK (quality IN ('ok','stale','partial','error')),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_kpi_snapshots_lookup
  ON kpi_snapshots(organization_id, kpi_id, as_of DESC);

CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  kpi_id TEXT,
  impact_brl NUMERIC(18,2),
  suggested_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  horizon TEXT NOT NULL DEFAULT 'daily',
  as_of_date DATE NOT NULL,
  content_md TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('incremental','full')),
  status TEXT NOT NULL CHECK (status IN ('running','success','partial','failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  records_in INT NOT NULL DEFAULT 0,
  records_ok INT NOT NULL DEFAULT 0,
  records_error INT NOT NULL DEFAULT 0,
  error_summary TEXT,
  latency_ms INT
);

CREATE TABLE IF NOT EXISTS sync_dead_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_run_id UUID REFERENCES sync_runs(id) ON DELETE SET NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  error_message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reprocessed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (id) VALUES ('001_init')
ON CONFLICT (id) DO NOTHING;
