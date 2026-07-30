import { generateCeoBriefing } from "@/ai/tools";
import { getCeoHome } from "@/application/get-ceo-home";
import { insertAiBriefing } from "@/infrastructure/db/repositories";
import { logger } from "@/lib/logger";

export type RegenerateBriefingResult =
  | { ok: true; contentMd: string; model: string }
  | { ok: false; error: string };

export async function regenerateBriefing(organizationId: string): Promise<RegenerateBriefingResult> {
  const home = await getCeoHome("daily", organizationId);
  if (!home.org) {
    return { ok: false, error: "Org não encontrada. Rode npm run db:seed." };
  }

  const asOfDate = new Date().toISOString().slice(0, 10);
  const generated = await generateCeoBriefing({
    asOfDate,
    kpis: home.kpis.map((k) => ({
      kpiId: k.kpiId,
      value: k.value,
      target: k.target,
      band: k.band,
    })),
    alerts: home.alerts,
  });

  try {
    await insertAiBriefing({
      organizationId: home.org.id,
      horizon: "daily",
      asOfDate: generated.evidence[0]?.period ?? asOfDate,
      contentMd: generated.contentMd,
      evidenceJson: JSON.stringify(generated.evidence),
      model: generated.model,
    });
  } catch (err) {
    logger.warn("persist briefing failed", { err: String(err) });
  }

  return { ok: true, contentMd: generated.contentMd, model: generated.model };
}
