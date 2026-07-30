import { generateText, type LanguageModel } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { getEnv, isFeatureEnabled } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getKpiDefinition, formatKpiValue } from "@/domain/kpis/engine";
import { defaultSuggestedActions, rankAlerts } from "@/domain/alerts/rank";
import type { AlertItem } from "@/domain/types";

export { rankAlerts, defaultSuggestedActions as suggestActions } from "@/domain/alerts/rank";

export type Evidence = {
  kpiId: string;
  label: string;
  valueFormatted: string;
  period: string;
};

export type BriefingInput = {
  asOfDate: string;
  kpis: Array<{ kpiId: string; value: number; target?: number | null; band: string }>;
  alerts: AlertItem[];
};

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

export function explainKpiDeviation(args: {
  kpiId: string;
  value: number;
  target?: number | null;
  band: string;
  relatedAlerts: AlertItem[];
}): { summary: string; evidence: Evidence[]; actions: string[] } {
  const def = getKpiDefinition(args.kpiId);
  if (!def) {
    return {
      summary: "KPI não encontrado no catálogo. Não invento número sem definição.",
      evidence: [],
      actions: ["Verificar id do KPI em domain/kpis/catalog"],
    };
  }
  const formatted = formatKpiValue(def, args.value);
  const targetText =
    args.target != null ? ` Meta: ${formatKpiValue(def, args.target)}.` : "";
  const alertHints = args.relatedAlerts.map((a) => a.title).slice(0, 3);
  const summary = [
    `${def.name} está ${args.band === "green" ? "no alvo" : args.band === "yellow" ? "em atenção" : "fora do alvo"}: ${formatted}.${targetText}`,
    `Fórmula: ${def.formula}. Fonte: ${def.source}.`,
    alertHints.length ? `Sinais correlatos: ${alertHints.join("; ")}.` : "Sem alertas correlatos abertos.",
  ].join(" ");

  return {
    summary,
    evidence: [
      {
        kpiId: def.id,
        label: def.name,
        valueFormatted: formatted,
        period: "período corrente",
      },
    ],
    actions: def.playbook ?? ["Investigar breakdown por região/cliente/SKU", "Validar freshness da sync"],
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
    ...ranked.flatMap((a) => defaultSuggestedActions(a).slice(0, 2).map((s) => `- ${s}`)).slice(0, 6),
    "",
    "_Gerado em modo fail-soft (regras). Se a IA generativa estiver disponível, este texto é enriquecido sem alterar os números._",
  ];
  return { contentMd: lines.join("\n"), evidence, model: "rule-based" };
}

export async function generateCeoBriefing(input: BriefingInput) {
  if (!isFeatureEnabled("ai_briefing")) {
    return ruleBasedBriefing(input);
  }

  const fallback = ruleBasedBriefing(input);
  const llm = resolveLlm();
  if (!llm) return fallback;

  try {
    const evidenceBlock = fallback.evidence
      .map((e) => `${e.label}=${e.valueFormatted} [${e.kpiId}]`)
      .join("; ");
    const alertBlock = rankAlerts(input.alerts)
      .slice(0, 5)
      .map((a) => `${a.severity}: ${a.title} — ${a.detail}`)
      .join("\n");

    const { text } = await generateText({
      model: llm.model,
      temperature: 0.2,
      prompt: [
        "Você é o copiloto executivo do StatusPro para uma distribuidora de limpeza e papel (~R$100mi/ano).",
        "Escreva um briefing diário em português brasileiro, objetivo, para o CEO.",
        "NÃO invente números. Use APENAS os dados fornecidos. Cite KPI ids quando mencionar valores.",
        "Estruture: Pulse / O que está errado / Por quê (hipóteses) / O que fazer agora (máx 5 ações).",
        `Data: ${input.asOfDate}`,
        `Evidências: ${evidenceBlock}`,
        `Alertas:\n${alertBlock || "nenhum"}`,
      ].join("\n"),
    });

    return {
      contentMd: text,
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
  kpis: BriefingInput["kpis"];
  alerts: AlertItem[];
}) {
  const q = args.question.toLowerCase();
  if (q.includes("margem")) {
    const margin = args.kpis.find((k) => k.kpiId.includes("margin"));
    const def = margin ? getKpiDefinition(margin.kpiId) : null;
    if (!margin || !def) {
      return "Não tenho snapshot de margem disponível neste horizonte. Rode a sync ou abra Vendas & Margem.";
    }
    return `Margem observada: ${formatKpiValue(def, margin.value)} (${margin.kpiId}, banda ${margin.band}). Sem inventar breakdown além dos dados carregados — abra Vendas & Margem para família/região.`;
  }
  if (q.includes("ruptura") || q.includes("sku")) {
    const stock = args.kpis.find((k) => k.kpiId === "stockout_sku_a");
    const def = getKpiDefinition("stockout_sku_a");
    if (!stock || !def) return "Sem dado de ruptura SKU A.";
    return `Há ${formatKpiValue(def, stock.value)} SKUs A em risco/ruptura. Priorize reposição e substitutos nos pedidos abertos.`;
  }
  if (q.includes("caixa") || q.includes("cliente")) {
    const overdue = args.kpis.find((k) => k.kpiId === "overdue_ar");
    const def = getKpiDefinition("overdue_ar");
    if (!overdue || !def) return "Sem dado de recebíveis vencidos.";
    return `Risco de caixa: recebíveis vencidos em ${formatKpiValue(def, overdue.value)}. Foque top clientes inadimplentes e contas nacionais com maior open amount.`;
  }

  const llm = resolveLlm();
  if (!llm) {
    return "Posso responder com os KPIs carregados (margem, ruptura, caixa). Para perguntas livres, configure ANTHROPIC_API_KEY.";
  }
  try {
    const { text } = await generateText({
      model: llm.model,
      temperature: 0.2,
      prompt: `Responda em PT-BR, executivo, sem inventar números.\nPergunta: ${args.question}\nKPIs: ${JSON.stringify(args.kpis)}\nAlertas: ${JSON.stringify(args.alerts.slice(0, 5))}`,
    });
    return text;
  } catch {
    return "Falha ao consultar o modelo. Use as perguntas sugeridas ou tente novamente.";
  }
}
