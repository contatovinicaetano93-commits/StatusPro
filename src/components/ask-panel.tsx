"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { regenerateBriefingAction } from "@/app/actions";
import { askStatusProAction } from "@/app/ask-actions";

const SUGGESTIONS = [
  "Onde estou perdendo margem esta semana?",
  "Quais SKUs A estão em risco de ruptura?",
  "Quais clientes concentram risco de caixa?",
];

export function AskPanel() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string>("");
  const [pending, start] = useTransition();

  function ask(q: string) {
    const trimmed = q.trim();
    if (trimmed.length < 3) {
      setAnswer("Digite uma pergunta com pelo menos 3 caracteres.");
      return;
    }
    start(async () => {
      const text = await askStatusProAction(trimmed);
      setAnswer(text);
    });
  }

  return (
    <section className="panel">
      <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.15rem" }}>Pergunte ao StatusPro</h2>
      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
        Pergunta livre ou sugestões — fatos via tools no servidor, sem inventar número.
      </p>
      <form
        style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ex.: Por que o fill rate caiu hoje?"
          disabled={pending}
          maxLength={500}
          style={{
            flex: "1 1 220px",
            minWidth: 0,
            background: "var(--panel)",
            border: "1px solid var(--line)",
            color: "var(--ink)",
            borderRadius: 8,
            padding: "0.55rem 0.7rem",
            font: "inherit",
          }}
        />
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "Consultando…" : "Perguntar"}
        </button>
      </form>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {SUGGESTIONS.map((q) => (
          <button
            key={q}
            className="btn"
            type="button"
            disabled={pending}
            onClick={() => {
              setQuestion(q);
              ask(q);
            }}
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
  const router = useRouter();
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
            if (res.ok) router.refresh();
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
