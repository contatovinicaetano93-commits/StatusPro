import {
  ErpCustomerSchema,
  ErpFreightSchema,
  ErpInvoiceSchema,
  ErpOrderSchema,
  ErpPaymentSchema,
  ErpProductSchema,
  ErpReceivableSchema,
  ErpStockSchema,
  type ErpGateway,
  type ErpPullResult,
} from "@/infrastructure/erp/gateway";

const UFS = ["SP", "RJ", "MG", "PR", "RS", "BA", "GO", "SC", "PE", "DF"] as const;

function mulberry32(seed: number) {
  return function rand() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/**
 * Deterministic mock of a R$100M/year cleaning+paper distributor based in SP, multi-UF.
 */
export class MockErpGateway implements ErpGateway {
  readonly sourceName = "mock:sifwin";

  constructor(private readonly seed = 42) {}

  async healthcheck() {
    const started = Date.now();
    return { ok: true, latencyMs: Date.now() - started, detail: "mock healthy" };
  }

  async pullFull(): Promise<ErpPullResult> {
    return this.build(addDays(new Date(), -120));
  }

  async pullIncremental(since: Date): Promise<ErpPullResult> {
    return this.build(since);
  }

  private build(since: Date): ErpPullResult {
    const rand = mulberry32(this.seed);
    const today = new Date();
    today.setHours(12, 0, 0, 0);

    const products = [
      { sku: "LIMP-DET-5L", name: "Detergente neutro 5L", family: "limpeza" as const, abcClass: "A" as const, unitCostBrl: 12.4, unitPriceBrl: 19.9, minStock: 800 },
      { sku: "LIMP-ALC-1L", name: "Álcool 70% 1L", family: "limpeza" as const, abcClass: "A" as const, unitCostBrl: 6.1, unitPriceBrl: 9.8, minStock: 1200 },
      { sku: "LIMP-MULT-500", name: "Multiuso 500ml", family: "limpeza" as const, abcClass: "B" as const, unitCostBrl: 3.2, unitPriceBrl: 5.9, minStock: 600 },
      { sku: "PAP-TOALHA-20", name: "Papel toalha interfolha 20x200", family: "papel" as const, abcClass: "A" as const, unitCostBrl: 28.0, unitPriceBrl: 42.5, minStock: 500 },
      { sku: "PAP-HIG-16", name: "Papel higiênico 16x30m", family: "papel" as const, abcClass: "A" as const, unitCostBrl: 22.5, unitPriceBrl: 34.9, minStock: 700 },
      { sku: "PAP-NAP-50", name: "Guardanapo 50x50", family: "papel" as const, abcClass: "B" as const, unitCostBrl: 18.0, unitPriceBrl: 27.0, minStock: 300 },
      { sku: "DESC-LUVA-M", name: "Luva nitrílica M c/100", family: "descartaveis" as const, abcClass: "A" as const, unitCostBrl: 14.0, unitPriceBrl: 23.5, minStock: 400 },
      { sku: "DESC-SAC-100L", name: "Saco lixo 100L c/100", family: "descartaveis" as const, abcClass: "B" as const, unitCostBrl: 32.0, unitPriceBrl: 48.0, minStock: 250 },
      { sku: "QUIM-CLORO-5L", name: "Hipoclorito 5L", family: "quimicos" as const, abcClass: "A" as const, unitCostBrl: 9.5, unitPriceBrl: 15.9, minStock: 450 },
      { sku: "QUIM-DESINF-5L", name: "Desinfetante 5L", family: "quimicos" as const, abcClass: "B" as const, unitCostBrl: 11.0, unitPriceBrl: 17.5, minStock: 350 },
      { sku: "LIMP-SAB-5L", name: "Sabão líquido 5L", family: "limpeza" as const, abcClass: "C" as const, unitCostBrl: 10.0, unitPriceBrl: 16.5, minStock: 200 },
      { sku: "PAP-BOB-200", name: "Bobina industrial 200m", family: "papel" as const, abcClass: "C" as const, unitCostBrl: 40.0, unitPriceBrl: 62.0, minStock: 120 },
    ].map((p) => ErpProductSchema.parse(p));

    const customers = Array.from({ length: 40 }).map((_, i) => {
      const uf = UFS[i % UFS.length];
      const national = i < 8;
      return ErpCustomerSchema.parse({
        externalId: `C${String(i + 1).padStart(4, "0")}`,
        name: national
          ? `Conta Nacional ${i + 1} — Rede ${["Hotelaria", "Varejo", "Food", "Saúde", "Educação", "Indústria", "Facility", "Logística"][i]}`
          : `Cliente Regional ${i + 1} ${uf}`,
        document: `00.000.000/${String(i + 1).padStart(4, "0")}-00`,
        uf,
        segment: national ? "enterprise" : i % 3 === 0 ? "smb" : "midmarket",
        isNationalAccount: national,
        creditLimitBrl: national ? 800_000 + i * 50_000 : 80_000 + i * 5_000,
      });
    });

    const invoices = [];
    const orders = [];
    const receivables = [];
    const payments = [];
    const freight = [];

    // ~R$100M / year ≈ R$274k/day average
    for (let dayOffset = 0; dayOffset <= 120; dayOffset++) {
      const day = addDays(today, -dayOffset);
      if (day < since) continue;
      const dow = day.getDay();
      const season = dow === 0 ? 0.35 : dow === 6 ? 0.55 : 1;
      const dayRevenueTarget = 274_000 * season * (0.85 + rand() * 0.35);

      let remaining = dayRevenueTarget;
      let ticketIdx = 0;
      while (remaining > 5_000 && ticketIdx < 35) {
        const customer = customers[Math.floor(rand() * customers.length)];
        const amount = Math.min(remaining, 4_000 + rand() * (customer.isNationalAccount ? 45_000 : 18_000));
        const margin = 0.22 + rand() * 0.12;
        const cogs = amount * (1 - margin);
        const externalId = `NF-${isoDate(day)}-${ticketIdx}`;
        const orderId = `PD-${isoDate(day)}-${ticketIdx}`;
        const requestedLines = 3 + Math.floor(rand() * 8);
        const fill = 0.86 + rand() * 0.14;
        const fulfilledLines = Math.max(1, Math.round(requestedLines * fill));
        const otifOk = fulfilledLines === requestedLines && rand() > 0.12;

        orders.push(
          ErpOrderSchema.parse({
            externalId: orderId,
            customerExternalId: customer.externalId,
            orderDate: isoDate(day),
            dueDate: isoDate(addDays(day, 1 + Math.floor(rand() * 3))),
            status: "invoiced",
            uf: customer.uf,
            requestedLines,
            fulfilledLines,
            onTimeInFull: otifOk,
            netAmountBrl: Number(amount.toFixed(2)),
            cogsBrl: Number(cogs.toFixed(2)),
          }),
        );

        invoices.push(
          ErpInvoiceSchema.parse({
            externalId,
            customerExternalId: customer.externalId,
            invoiceDate: isoDate(day),
            netAmountBrl: Number(amount.toFixed(2)),
            cogsBrl: Number(cogs.toFixed(2)),
            uf: customer.uf,
          }),
        );

        const due = addDays(day, customer.isNationalAccount ? 35 : 28);
        const open = dayOffset < 25 ? amount * (0.3 + rand() * 0.7) : rand() > 0.7 ? amount * 0.4 : 0;
        if (open > 100) {
          receivables.push(
            ErpReceivableSchema.parse({
              externalId: `CR-${externalId}`,
              customerExternalId: customer.externalId,
              invoiceExternalId: externalId,
              dueDate: isoDate(due),
              openAmountBrl: Number(open.toFixed(2)),
              status: "open",
            }),
          );
        } else {
          payments.push(
            ErpPaymentSchema.parse({
              customerExternalId: customer.externalId,
              paymentDate: isoDate(addDays(due, -Math.floor(rand() * 5))),
              amountBrl: Number(amount.toFixed(2)),
              receivableExternalId: `CR-${externalId}`,
            }),
          );
        }

        freight.push(
          ErpFreightSchema.parse({
            costDate: isoDate(day),
            uf: customer.uf,
            amountBrl: Number((amount * (0.035 + rand() * 0.035)).toFixed(2)),
            orderExternalId: orderId,
          }),
        );

        remaining -= amount;
        ticketIdx += 1;
      }

      // cash-in today spike
      if (dayOffset === 0) {
        payments.push(
          ErpPaymentSchema.parse({
            customerExternalId: customers[0].externalId,
            paymentDate: isoDate(day),
            amountBrl: 180_000,
          }),
        );
      }
    }

    const stock = products.flatMap((p, idx) => {
      const onHand =
        p.abcClass === "A" && idx % 5 === 0
          ? Math.floor(p.minStock * (0.1 + rand() * 0.4))
          : Math.floor(p.minStock * (0.8 + rand() * 2.5));
      return [
        ErpStockSchema.parse({
          sku: p.sku,
          warehouseCode: "CD-SP",
          asOfDate: isoDate(today),
          onHand,
        }),
      ];
    });

    return {
      customers,
      products,
      orders,
      invoices,
      receivables,
      payments,
      stock,
      freight,
      pulledAt: new Date().toISOString(),
    };
  }
}

