-- Upsert keys for ERP ingest + optional payment/freight external ids

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS external_id TEXT;

ALTER TABLE freight_costs
  ADD COLUMN IF NOT EXISTS external_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_org_external
  ON customers (organization_id, external_id)
  WHERE external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_orders_org_external
  ON sales_orders (organization_id, external_id)
  WHERE external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_org_external
  ON invoices (organization_id, external_id)
  WHERE external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_receivables_org_external
  ON receivables (organization_id, external_id)
  WHERE external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_org_external
  ON payments (organization_id, external_id)
  WHERE external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_freight_org_external
  ON freight_costs (organization_id, external_id)
  WHERE external_id IS NOT NULL;
