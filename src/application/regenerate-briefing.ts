import { generateCeoBriefing } from "@/ai/tools";
import { getAiContext } from "@/application/get-ceo-home";
import { insertAiBriefing } from "@/infrastructure/db/repositories";
import { logger } from "@/lib/logger";

export type RegenerateBriefingResult =
  | { ok: true; contentMd: string; model: string }
  | { ok: false; error: string };

export async function regenerateBriefing(organizationId: string): Promise<RegenerateBriefingResult> {
  const ctx = await getAiContext(organizationId);
  if (!ctx.org) {
    return { ok: false, error: "Org não encontrada. Rode npm run db:seed." };
  }

  const asOfDate = new Date().toISOString().slice(0, 10);
  const generated = await generateCeoBriefing(
    {
      asOfDate,
      kpis: ctx.kpis.map((k) => ({
        kpiId: k.kpiId,
        value: k.value,
        target: k.target,
        band: k.band,
      })),
      alerts: ctx.alerts,
    },
    ctx.org.id,
  );

  try {
    await insertAiBriefing({
      organizationId: ctx.org.id,
      horizon: "daily",
      asOfDate: generated.evidence[0]?.period ?? asOfDate,
      contentMd: generated.contentMd,
      evidenceJson: JSON.stringify(generated.evidence),
      model: generated.model,
    });
  } catch (err) {
    logger.warn("persist briefing failed", { err: String(err) });
    return {
      ok: false,
      error: "Briefing gerado mas não persistiu. Tente novamente.",
    };
  }

  return { ok: true, contentMd: generated.contentMd, model: generated.model };
}
