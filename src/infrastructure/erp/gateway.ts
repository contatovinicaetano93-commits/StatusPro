import { z } from "zod";

export const ErpCustomerSchema = z.object({
  externalId: z.string(),
  name: z.string(),
  document: z.string().optional(),
  uf: z.string().length(2),
  segment: z.string(),
  isNationalAccount: z.boolean().default(false),
  creditLimitBrl: z.number().nonnegative(),
});

export const ErpProductSchema = z.object({
  sku: z.string(),
  name: z.string(),
  family: z.enum(["limpeza", "papel", "descartaveis", "quimicos"]),
  abcClass: z.enum(["A", "B", "C"]),
  unitCostBrl: z.number().positive(),
  unitPriceBrl: z.number().positive(),
  minStock: z.number().nonnegative(),
});

export const ErpInvoiceSchema = z.object({
  externalId: z.string(),
  customerExternalId: z.string(),
  invoiceDate: z.string(),
  netAmountBrl: z.number(),
  cogsBrl: z.number(),
  uf: z.string().length(2),
});

export const ErpReceivableSchema = z.object({
  externalId: z.string(),
  customerExternalId: z.string(),
  invoiceExternalId: z.string().optional(),
  dueDate: z.string(),
  openAmountBrl: z.number(),
  status: z.enum(["open", "paid", "partial", "written_off"]),
});

export const ErpStockSchema = z.object({
  sku: z.string(),
  warehouseCode: z.string(),
  asOfDate: z.string(),
  onHand: z.number(),
});

export const ErpOrderSchema = z.object({
  externalId: z.string(),
  customerExternalId: z.string(),
  orderDate: z.string(),
  dueDate: z.string().optional(),
  status: z.string(),
  uf: z.string().length(2),
  requestedLines: z.number().int().nonnegative(),
  fulfilledLines: z.number().int().nonnegative(),
  onTimeInFull: z.boolean().nullable(),
  netAmountBrl: z.number(),
  cogsBrl: z.number(),
});

export const ErpFreightSchema = z.object({
  costDate: z.string(),
  uf: z.string().length(2),
  amountBrl: z.number(),
  orderExternalId: z.string().optional(),
});

export const ErpPaymentSchema = z.object({
  customerExternalId: z.string(),
  paymentDate: z.string(),
  amountBrl: z.number(),
  receivableExternalId: z.string().optional(),
});

export type ErpCustomer = z.infer<typeof ErpCustomerSchema>;
export type ErpProduct = z.infer<typeof ErpProductSchema>;
export type ErpInvoice = z.infer<typeof ErpInvoiceSchema>;
export type ErpReceivable = z.infer<typeof ErpReceivableSchema>;
export type ErpStock = z.infer<typeof ErpStockSchema>;
export type ErpOrder = z.infer<typeof ErpOrderSchema>;
export type ErpFreight = z.infer<typeof ErpFreightSchema>;
export type ErpPayment = z.infer<typeof ErpPaymentSchema>;

export const ErpPullResultSchema = z.object({
  customers: z.array(ErpCustomerSchema),
  products: z.array(ErpProductSchema),
  orders: z.array(ErpOrderSchema),
  invoices: z.array(ErpInvoiceSchema),
  receivables: z.array(ErpReceivableSchema),
  payments: z.array(ErpPaymentSchema),
  stock: z.array(ErpStockSchema),
  freight: z.array(ErpFreightSchema),
  pulledAt: z.string(),
});

export type ErpPullResult = z.infer<typeof ErpPullResultSchema>;

/**
 * Boundary for FKN/SIFWin (and mocks). No UI/DB imports here.
 * Real FKN adapter should call vendor API once credentials exist; until then use MockErpGateway.
 */
export interface ErpGateway {
  readonly sourceName: string;
  healthcheck(): Promise<{ ok: boolean; latencyMs: number; detail?: string }>;
  pullIncremental(since: Date): Promise<ErpPullResult>;
  pullFull(): Promise<ErpPullResult>;
}
