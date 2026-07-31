"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ackDeadLetterAction,
  retryDeadLetterAction,
  runMockSyncAction,
} from "@/app/actions";

export function SyncControls({ circuitOpen }: { circuitOpen: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  return (
    <div className="panel" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      {circuitOpen ? (
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--danger, #c45c5c)",
            border: "1px solid color-mix(in oklab, var(--danger, #c45c5c) 40%, transparent)",
            background: "color-mix(in oklab, var(--danger, #c45c5c) 12%, transparent)",
            borderRadius: 8,
            padding: "0.35rem 0.65rem",
          }}
        >
          Circuit aberto (~5 min)
        </span>
      ) : (
        <span className="muted" style={{ fontSize: 12 }}>
          Circuit fechado
        </span>
      )}
      <button
        className="btn btn-primary"
        type="button"
        disabled={pending || circuitOpen}
        onClick={() =>
          start(async () => {
            const res = await runMockSyncAction();
            setMsg(res.ok ? `Sync ok — ${res.records} registros` : res.error);
          })
        }
      >
        {pending ? "Sincronizando…" : "Rodar sync incremental (mock)"}
      </button>
      {msg ? <span className="muted">{msg}</span> : null}
    </div>
  );
}

export function DeadLetterActions({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <button
        className="btn"
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await retryDeadLetterAction(id);
            setMsg(res.ok ? "Retry ok" : res.error);
            if (res.ok) router.refresh();
          })
        }
      >
        Retry
      </button>
      <button
        className="btn"
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await ackDeadLetterAction(id);
            setMsg(res.ok ? "Ack" : res.error);
            if (res.ok) router.refresh();
          })
        }
      >
        Ack
      </button>
      {msg ? (
        <span className="muted" style={{ fontSize: 11 }}>
          {msg}
        </span>
      ) : null}
    </div>
  );
}
