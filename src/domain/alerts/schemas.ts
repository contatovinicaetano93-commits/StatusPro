import { z } from "zod";

export const AlertSeveritySchema = z.enum(["critical", "high", "medium", "low"]);

export const AlertItemSchema = z.object({
  id: z.string(),
  severity: AlertSeveritySchema,
  title: z.string(),
  detail: z.string(),
  kpiId: z.string().optional(),
  impactBrl: z.number().optional(),
  suggestedActions: z.array(z.string()),
  createdAt: z.string(),
});

export const OperationalAlertDraftSchema = z.object({
  severity: AlertSeveritySchema,
  title: z.string(),
  detail: z.string(),
  kpiId: z.string().optional(),
  impactBrl: z.number().optional(),
  suggestedActions: z.array(z.string()),
});

export type AlertItemParsed = z.infer<typeof AlertItemSchema>;
export type OperationalAlertDraft = z.infer<typeof OperationalAlertDraftSchema>;
