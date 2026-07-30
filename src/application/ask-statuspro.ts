import { z } from "zod";
import { answerStatusProQuestion } from "@/ai/tools";
import { getAiContext } from "@/application/get-ceo-home";

const AskInputSchema = z.object({
  question: z.string().trim().min(3).max(500),
});

/** Ask loads facts on the server from tenant — client only sends the question. */
export async function askStatusPro(organizationId: string, rawQuestion: string): Promise<string> {
  const parsed = AskInputSchema.safeParse({ question: rawQuestion });
  if (!parsed.success) {
    return "Pergunta inválida. Use de 3 a 500 caracteres.";
  }

  const ctx = await getAiContext(organizationId);
  return answerStatusProQuestion({
    question: parsed.data.question,
    organizationId,
    kpis: ctx.kpis.map((k) => ({
      kpiId: k.kpiId,
      value: k.value,
      target: k.target,
      band: k.band,
    })),
    alerts: ctx.alerts,
  });
}
