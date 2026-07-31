import { describe, expect, it, beforeEach } from "vitest";
import { MockErpGateway } from "@/infrastructure/erp/mock-gateway";
import {
  ErpCustomerSchema,
  ErpInvoiceSchema,
  ErpProductSchema,
  ErpPullResultSchema,
  type ErpPullResult,
} from "@/infrastructure/erp/gateway";
import { mapFknPullToErpResult } from "@/infrastructure/erp/fkn-map";
import { FknSifwinErpGateway } from "@/infrastructure/erp/fkn-sifwin-gateway";
import { resetEnvCache } from "@/lib/env";

describe("MockErpGateway contract", () => {
  it("returns zod-valid payloads", async () => {
    const erp = new MockErpGateway(7);
    const health = await erp.healthcheck();
    expect(health.ok).toBe(true);

    const pull = await erp.pullFull();
    expect(erp.sourceName).toBeTruthy();
    expect(() => ErpPullResultSchema.parse(pull)).not.toThrow();
    expect(pull.customers.length).toBeGreaterThan(10);
    expect(pull.products.length).toBeGreaterThan(5);
    expect(pull.invoices.length).toBeGreaterThan(100);

    for (const c of pull.customers.slice(0, 5)) {
      expect(() => ErpCustomerSchema.parse(c)).not.toThrow();
    }
    for (const p of pull.products) {
      expect(() => ErpProductSchema.parse(p)).not.toThrow();
    }
    for (const i of pull.invoices.slice(0, 10)) {
      expect(() => ErpInvoiceSchema.parse(i)).not.toThrow();
    }
  });
});

describe("mapFknPullToErpResult", () => {
  const sample: ErpPullResult = {
    customers: [],
    products: [],
    orders: [],
    invoices: [],
    receivables: [],
    payments: [],
    stock: [],
    freight: [],
    pulledAt: "2026-07-31T12:00:00.000Z",
  };

  it("accepts already-normalized ErpPullResult", () => {
    expect(mapFknPullToErpResult(sample).pulledAt).toBe(sample.pulledAt);
  });

  it("accepts { data: ErpPullResult } envelopes", () => {
    expect(mapFknPullToErpResult({ data: sample }).pulledAt).toBe(sample.pulledAt);
  });

  it("rejects unknown vendor shapes until mapper is filled", () => {
    expect(() => mapFknPullToErpResult({ foo: 1 })).toThrow(/mapper/i);
  });
});

describe("FknSifwinErpGateway", () => {
  beforeEach(() => {
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ?? "postgresql://test:test@localhost/statuspro_test";
    process.env.ERP_FKN_BASE_URL = "";
    process.env.ERP_FKN_API_KEY = "";
    resetEnvCache();
  });

  it("healthcheck fails soft without credentials", async () => {
    const erp = new FknSifwinErpGateway();
    const health = await erp.healthcheck();
    expect(health.ok).toBe(false);
    expect(health.detail).toMatch(/ERP_FKN_BASE_URL|credentials/i);
  });
});
