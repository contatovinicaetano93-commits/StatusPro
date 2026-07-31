import { z } from "zod";
import { answerStatusProQuestion } from "@/ai/tools";
import { getAiContext } from "@/application/get-ai-context";
import { getEnv } from "@/lib/env";

const AskInputSchema = z.object({
  question: z.string().trim().min(3).max(500),
});

function hasLlmKey(): boolean {
  const env = getEnv();
  return Boolean(env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY || env.AI_GATEWAY_API_KEY);
}

/** Ask — LLM path uses tools only (no preload). Fail-soft path preloads KPIs. */
export async function askStatusPro(organizationId: string, rawQuestion: string): Promise<string> {
  const parsed = AskInputSchema.safeParse({ question: rawQuestion });
  if (!parsed.success) {
    return "Pergunta inválida. Use de 3 a 500 caracteres.";
  }

  if (hasLlmKey()) {
    return answerStatusProQuestion({
      question: parsed.data.question,
      organizationId,
      kpis: [],
      alerts: [],
    });
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
