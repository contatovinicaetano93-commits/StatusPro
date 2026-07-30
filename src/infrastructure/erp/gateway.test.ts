import { describe, expect, it } from "vitest";
import { MockErpGateway } from "@/infrastructure/erp/mock-gateway";
import {
  ErpCustomerSchema,
  ErpInvoiceSchema,
  ErpProductSchema,
  ErpPullResultSchema,
} from "@/infrastructure/erp/gateway";

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
