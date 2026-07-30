"use server";

import { AuthError, requireSession } from "@/infrastructure/auth/guards";
import { canAskAi } from "@/domain/access";
import { isFeatureEnabled } from "@/lib/env";
import { askStatusPro } from "@/application/ask-statuspro";

export async function askStatusProAction(question: string) {
  try {
    const session = await requireSession();
    if (!canAskAi(session.role)) {
      return "Sem permissão para consultar o StatusPro.";
    }
    if (!isFeatureEnabled("ai_chat") && !isFeatureEnabled("ai_briefing")) {
      return "Chat IA desabilitado nas feature flags.";
    }
    return askStatusPro(session.organizationId, question);
  } catch (err) {
    if (err instanceof AuthError) {
      return err.message;
    }
    throw err;
  }
}
