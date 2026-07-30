"use client";

import { useState, useTransition } from "react";
import { runMockSyncAction } from "@/app/actions";

export function SyncControls() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  return (
    <div className="panel" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <button
        className="btn btn-primary"
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await runMockSyncAction();
            setMsg(res.ok ? `Sync ok — ${res.records} invoices puxadas` : res.error);
          })
        }
      >
        {pending ? "Sincronizando…" : "Rodar sync incremental (mock)"}
      </button>
      {msg ? <span className="muted">{msg}</span> : null}
    </div>
  );
}
