"use client";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="panel" style={{ margin: "1.5rem auto", maxWidth: 520 }}>
      <h1 style={{ marginTop: 0, fontSize: "1.2rem" }}>Algo falhou no cockpit</h1>
      <p className="muted" style={{ lineHeight: 1.5 }}>
        {error.message || "Erro inesperado. Os dados do ERP não foram inventados — tente de novo."}
      </p>
      <button type="button" className="btn" onClick={reset}>
        Tentar novamente
      </button>
    </div>
  );
}
