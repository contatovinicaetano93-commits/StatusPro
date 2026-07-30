"use server";

import { answerStatusProQuestion } from "@/ai/tools";
import type { AlertItem } from "@/domain/types";
import { AuthError, requireSession } from "@/infrastructure/auth/guards";
import { canAskAi } from "@/domain/access";
import { isFeatureEnabled } from "@/lib/env";

export async function askStatusProAction(args: {
  question: string;
  kpis: Array<{ kpiId: string; value: number; target?: number | null; band: string }>;
  alerts: AlertItem[];
}) {
  try {
    const session = await requireSession();
    if (!canAskAi(session.role)) {
      return "Sem permissão para consultar o StatusPro.";
    }
    if (!isFeatureEnabled("ai_chat") && !isFeatureEnabled("ai_briefing")) {
      return "Chat IA desabilitado nas feature flags.";
    }
    return answerStatusProQuestion(args);
  } catch (err) {
    if (err instanceof AuthError) {
      return err.message;
    }
    throw err;
  }
}
