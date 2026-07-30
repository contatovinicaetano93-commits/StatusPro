import { generateText, stepCountIs, tool, type LanguageModel } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { getEnv, isFeatureEnabled } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getKpiDefinition, formatKpiValue } from "@/domain/kpis/engine";
import { defaultSuggestedActions, rankAlerts } from "@/domain/alerts/rank";
import { toRankedAlertView } from "@/domain/alerts/to-ranked-view";
import type { KpiEvidence } from "@/domain/kpis/explain";
import type { AlertItem, Horizon } from "@/domain/types";
import {
  getLatestKpis,
  getOpenAlerts,
  getStockoutSkus,
  getTopOverdueCustomers,
} from "@/infrastructure/db/repositories";

export type Evidence = KpiEvidence;

export type BriefingInput = {
  asOfDate: string;
  kpis: Array<{ kpiId: string; value: number; target?: number | null; band: string }>;
  alerts: AlertItem[];
};

const LLM_TIMEOUT_MS = 12_000;

function resolveLlm(): { model: LanguageModel; modelId: string } | null {
  const env = getEnv();
  if (env.ANTHROPIC_API_KEY) {
    const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });
    return { model: anthropic("claude-sonnet-4-5"), modelId: "claude-sonnet-4-5" };
  }
  const openAiKey = env.OPENAI_API_KEY || env.AI_GATEWAY_API_KEY;
  if (openAiKey) {
    const openai = createOpenAI({ apiKey: openAiKey });
    return { model: openai("gpt-4o-mini"), modelId: "gpt-4o-mini" };
  }
  return null;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`LLM timeout after ${ms}ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function buildEvidence(input: BriefingInput): Evidence[] {
  return input.kpis.slice(0, 8).flatMap((k) => {
    const def = getKpiDefinition(k.kpiId);
    if (!def) return [];
    return [
      {
        kpiId: k.kpiId,
        label: def.name,
        valueFormatted: formatKpiValue(def, k.value),
        period: input.asOfDate,
      },
    ];
  });
}

/** Tool-backed cockpit facts — AI narrates only what tools return. */
export function createStatusProTools(organizationId: string) {
  return {
    getKpis: tool({
      description: "Lista KPIs do horizonte com valor, meta e banda. Cite kpiId nas respostas.",
      inputSchema: z.object({
        horizon: z.enum(["daily", "weekly", "monthly", "quarterly"]).default("daily"),
      }),
      execute: async ({ horizon }: { horizon: Horizon }) => {
        const kpis = await getLatestKpis(organizationId, horizon);
        return kpis.map((k) => ({
          kpiId: k.kpiId,
          name: k.definition.name,
          value: k.value,
          formatted: k.formatted,
          target: k.target,
          band: k.band,
          quality: k.quality,
        }));
      },
    }),
    getOpenAlerts: tool({
      description: "Alertas abertos ranqueados por severidade e impacto financeiro.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(20).default(8),
      }),
      execute: async ({ limit }: { limit: number }) => {
        const alerts = await getOpenAlerts(organizationId, 100);
        return toRankedAlertView(alerts, { limit, withExplain: false }).map((a) => ({
          id: a.id,
          severity: a.severity,
          title: a.title,
          detail: a.detail,
          kpiId: a.kpiId,
          impactBrl: a.impactBrl,
          actions: a.actions,
        }));
      },
    }),
    getStockouts: tool({
      description: "SKUs classe A abaixo do estoque mínimo.",
      inputSchema: z.object({}),
      execute: async () => {
        const rows = await getStockoutSkus(organizationId);
        return rows.map((s) => ({
          sku: String(s.sku),
          name: String(s.name),
          family: String(s.family),
          onHand: Number(s.on_hand),
          minStock: Number(s.min_stock),
          warehouse: String(s.warehouse),
        }));
      },
    }),
    getOverdueCustomers: tool({
      description: "Top clientes com recebíveis vencidos em aberto.",
      inputSchema: z.object({}),
      execute: async () => {
        const rows = await getTopOverdueCustomers(organizationId);
        return rows.map((c) => ({
          name: String(c.name),
          uf: String(c.uf),
          isNationalAccount: Boolean(c.is_national_account),
          openAmountBrl: Number(c.open_amount),
        }));
      },
    }),
  };
}

export function ruleBasedBriefing(input: BriefingInput): {
  contentMd: string;
  evidence: Evidence[];
  model: string;
} {
  const ranked = rankAlerts(input.alerts).slice(0, 4);
  const evidence = buildEvidence(input);
  const lines = [
    "## Briefing diário do CEO",
    "",
    `Atualizado em **${input.asOfDate}** com base nos KPIs do cockpit (sem inventar valores).`,
    "",
    "### Pulse",
    ...evidence.map((e) => `- **${e.label}**: ${e.valueFormatted} (${e.period})`),
    "",
    "### O que está errado / em risco",
    ...(ranked.length
      ? ranked.map((a, i) => `${i + 1}. **${a.title}** — ${a.detail}`)
      : ["- Nenhum alerta crítico aberto no momento."]),
    "",
    "### O que fazer agora",
    ...ranked
      .flatMap((a) => defaultSuggestedActions(a).slice(0, 2).map((s) => `- ${s}`))
      .slice(0, 6),
    "",
    "_Gerado em modo fail-soft (regras). Se a IA generativa estiver disponível, este texto é enriquecido sem alterar os números._",
  ];
  return { contentMd: lines.join("\n"), evidence, model: "rule-based" };
}

export async function generateCeoBriefing(input: BriefingInput, organizationId: string) {
  if (!isFeatureEnabled("ai_briefing")) {
    return ruleBasedBriefing(input);
  }

  const fallback = ruleBasedBriefing(input);
  const llm = resolveLlm();
  if (!llm) return fallback;

  try {
    const result = await withTimeout(
      generateText({
        model: llm.model,
        temperature: 0.2,
        stopWhen: stepCountIs(4),
        tools: createStatusProTools(organizationId),
        prompt: [
          "Você é o copiloto executivo do StatusPro (distribuidora limpeza/papel ~R$100mi/ano).",
          "Use as tools para obter KPIs e alertas. NÃO invente números.",
          "Cite kpiId ao mencionar valores. Estruture: Pulse / O que está errado / Por quê / O que fazer (máx 5).",
          `Data: ${input.asOfDate}`,
        ].join("\n"),
      }),
      LLM_TIMEOUT_MS,
    );
    return {
      contentMd: result.text || fallback.contentMd,
      evidence: fallback.evidence,
      model: llm.modelId,
    };
  } catch (err) {
    logger.warn("generateCeoBriefing LLM failed; using rule-based", { err: String(err) });
    return fallback;
  }
}

export async function answerStatusProQuestion(args: {
  question: string;
  organizationId: string;
  kpis: BriefingInput["kpis"];
  alerts: AlertItem[];
}) {
  const llm = resolveLlm();
  if (!llm) {
    const q = args.question.toLowerCase();
    if (q.includes("margem")) {
      const margin = args.kpis.find((k) => k.kpiId.includes("margin"));
      const def = margin ? getKpiDefinition(margin.kpiId) : null;
      if (!margin || !def) {
        return "Não tenho snapshot de margem. Rode a sync ou configure ANTHROPIC_API_KEY.";
      }
      return `Margem observada: ${formatKpiValue(def, margin.value)} (${margin.kpiId}, banda ${margin.band}).`;
    }
    if (q.includes("ruptura") || q.includes("sku")) {
      const stock = args.kpis.find((k) => k.kpiId === "stockout_sku_a");
      const def = getKpiDefinition("stockout_sku_a");
      if (!stock || !def) return "Sem dado de ruptura SKU A.";
      return `Há ${formatKpiValue(def, stock.value)} SKUs A em risco/ruptura.`;
    }
    if (q.includes("caixa") || q.includes("cliente")) {
      const overdue = args.kpis.find((k) => k.kpiId === "overdue_ar");
      const def = getKpiDefinition("overdue_ar");
      if (!overdue || !def) return "Sem dado de recebíveis vencidos.";
      return `Recebíveis vencidos: ${formatKpiValue(def, overdue.value)}.`;
    }
    return "Para perguntas livres, configure ANTHROPIC_API_KEY (IA tool-backed).";
  }

  try {
    const result = await withTimeout(
      generateText({
        model: llm.model,
        temperature: 0.2,
        stopWhen: stepCountIs(5),
        tools: createStatusProTools(args.organizationId),
        prompt: [
          "Responda em PT-BR, tom executivo.",
          "Use tools para fatos. NÃO invente números. Se a tool não trouxer o dado, diga que não tem.",
          "Cite kpiId quando mencionar valores.",
          `Pergunta: ${args.question}`,
        ].join("\n"),
      }),
      LLM_TIMEOUT_MS,
    );
    return result.text || "Sem resposta do modelo. Tente uma pergunta sobre margem, ruptura ou caixa.";
  } catch (err) {
    logger.warn("answerStatusProQuestion LLM failed", { err: String(err) });
    return "Falha ao consultar o modelo. Use as perguntas sugeridas ou tente novamente.";
  }
}
