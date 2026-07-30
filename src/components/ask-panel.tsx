"use client";

import { useState, useTransition } from "react";
import { regenerateBriefingAction } from "@/app/actions";
import { askStatusProAction } from "@/app/ask-actions";

const SUGGESTIONS = [
  "Onde estou perdendo margem esta semana?",
  "Quais SKUs A estão em risco de ruptura?",
  "Quais clientes concentram risco de caixa?",
];

export function AskPanel({
  kpis,
  alerts,
}: {
  kpis: Array<{ kpiId: string; value: number; target?: number | null; band: string }>;
  alerts: Array<{
    id: string;
    severity: "critical" | "high" | "medium" | "low";
    title: string;
    detail: string;
    kpiId?: string;
    impactBrl?: number;
    suggestedActions: string[];
    createdAt: string;
  }>;
}) {
  const [answer, setAnswer] = useState<string>("");
  const [pending, start] = useTransition();

  return (
    <section className="panel">
      <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.15rem" }}>Pergunte ao StatusPro</h2>
      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
        Respostas com base nos KPIs carregados — sem inventar número.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {SUGGESTIONS.map((q) => (
          <button
            key={q}
            className="btn"
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const text = await askStatusProAction({ question: q, kpis, alerts });
                setAnswer(text);
              })
            }
          >
            {q}
          </button>
        ))}
      </div>
      {answer ? (
        <p style={{ marginTop: "0.9rem", whiteSpace: "pre-wrap", lineHeight: 1.45 }}>{answer}</p>
      ) : null}
    </section>
  );
}

export function BriefingActions() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <button
        className="btn btn-primary"
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await regenerateBriefingAction();
            setMsg(res.ok ? `Briefing gerado (${res.model})` : res.error);
          })
        }
      >
        {pending ? "Gerando…" : "Gerar briefing IA"}
      </button>
      {msg ? (
        <span className="muted" style={{ fontSize: 13 }}>
          {msg}
        </span>
      ) : null}
    </div>
  );
}
