import Link from "next/link";
import type { CSSProperties } from "react";
import { loginAction } from "@/app/actions";
import { DEMO_USERS } from "@/infrastructure/auth/session";
import { ROLE_LABELS } from "@/domain/roles";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: "4rem 1.25rem" }}>
      <p className="muted" style={{ letterSpacing: "0.16em", textTransform: "uppercase", fontSize: 12 }}>
        Distribuição · Limpeza & Papel
      </p>
      <h1 className="brand" style={{ fontSize: "clamp(2.6rem, 7vw, 3.8rem)", margin: "0.4rem 0" }}>
        StatusPro
      </h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Cockpit do CEO. Entre com um perfil demo (senha: <code>demo</code>).
      </p>

      {params.error ? (
        <div className="banner-stale" style={{ marginTop: "1rem" }}>
          Credenciais inválidas.
        </div>
      ) : null}

      <form action={loginAction} className="panel" style={{ marginTop: "1.5rem", display: "grid", gap: "0.75rem" }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span className="muted" style={{ fontSize: 13 }}>
            E-mail
          </span>
          <select name="email" defaultValue="ceo@statuspro.local" style={inputStyle}>
            {DEMO_USERS.map((u) => (
              <option key={u.email} value={u.email}>
                {ROLE_LABELS[u.role]} — {u.email}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span className="muted" style={{ fontSize: 13 }}>
            Senha
          </span>
          <input name="password" type="password" defaultValue="demo" style={inputStyle} />
        </label>
        <button className="btn btn-primary" type="submit">
          Entrar no cockpit
        </button>
      </form>

      <p className="muted" style={{ marginTop: "1.25rem", fontSize: 13 }}>
        Sem dados? <Link href="/sync">Sync Center</Link> · rode migrate/seed localmente.
      </p>
    </main>
  );
}

const inputStyle: CSSProperties = {
  background: "var(--bg-0)",
  border: "1px solid var(--line)",
  color: "var(--text)",
  padding: "0.65rem 0.75rem",
  borderRadius: 4,
  font: "inherit",
};
