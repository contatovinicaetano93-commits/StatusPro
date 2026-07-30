import type { CSSProperties } from "react";
import { loginAction } from "@/app/actions";
import { DEMO_USERS } from "@/infrastructure/auth/session";
import { ROLE_LABELS } from "@/domain/roles";
import { getBrand } from "@/lib/brand";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const brand = getBrand();

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 animate-rise">
        <p className="text-[0.65rem] uppercase tracking-[0.25em] text-accent">{brand.displayName}</p>
        <h1 className="mt-2 text-xl font-semibold">Acesso ao cockpit</h1>
        <p className="mt-2 text-sm text-muted">{brand.loginSubtitle}</p>

        {params.error ? (
          <p className="mt-3 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            Credenciais inválidas.
          </p>
        ) : null}

        <form action={loginAction} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide text-muted">Perfil</span>
            <select name="email" defaultValue="ceo@statuspro.local" style={inputStyle}>
              {DEMO_USERS.map((u) => (
                <option key={u.email} value={u.email}>
                  {ROLE_LABELS[u.role]} — {u.email}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide text-muted">Senha</span>
            <input name="password" type="password" defaultValue="demo" style={inputStyle} />
          </label>
          <button
            className="rounded-xl border border-accent/50 bg-accent/15 px-4 py-3 text-sm font-semibold text-accent-strong transition-colors hover:bg-accent/25"
            type="submit"
          >
            Entrar
          </button>
        </form>
      </div>
    </main>
  );
}

const inputStyle: CSSProperties = {
  background: "var(--background)",
  border: "1px solid var(--border)",
  color: "var(--foreground)",
  padding: "0.7rem 0.8rem",
  borderRadius: "0.75rem",
  font: "inherit",
};
