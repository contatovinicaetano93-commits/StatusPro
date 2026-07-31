import { AuthError, requireRoles, requireSession } from "@/infrastructure/auth/guards";
import { canAskAi, canRunBriefing, canRunSync } from "@/domain/access";
import { isFeatureEnabled } from "@/lib/env";
import { askStatusPro } from "@/application/ask-statuspro";
import { regenerateBriefing } from "@/application/regenerate-briefing";
import { runErpSync } from "@/application/run-erp-sync";

export async function askStatusProForSession(question: string): Promise<string> {
  const session = await requireSession();
  if (!canAskAi(session.role)) {
    return "Sem permissão para consultar o StatusPro.";
  }
  if (!isFeatureEnabled("ai_chat") && !isFeatureEnabled("ai_briefing")) {
    return "Chat IA desabilitado nas feature flags.";
  }
  return askStatusPro(session.organizationId, question);
}

export async function regenerateBriefingForSession() {
  const session = await requireSession();
  if (!canRunBriefing(session.role)) {
    return { ok: false as const, error: "Sem permissão para gerar briefing." };
  }
  return regenerateBriefing(session.organizationId);
}

export async function runErpSyncForSession() {
  const session = await requireRoles(["admin", "ceo"]);
  if (!canRunSync(session.role)) {
    return { ok: false as const, error: "Sem permissão para sync." };
  }
  return runErpSync(session.organizationId);
}

export function asAuthFailure(err: unknown): string | null {
  if (err instanceof AuthError) return err.message;
  return null;
}
