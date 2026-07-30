"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/actions";

const LINKS = [
  { href: "/ceo", label: "CEO Home" },
  { href: "/horizons/daily", label: "Diário" },
  { href: "/horizons/weekly", label: "Semanal" },
  { href: "/horizons/monthly", label: "Mensal" },
  { href: "/horizons/quarterly", label: "Trimestral" },
  { href: "/cash", label: "Caixa & Recebíveis" },
  { href: "/inventory", label: "Estoque & Rupturas" },
  { href: "/sales", label: "Vendas & Margem" },
  { href: "/service", label: "Serviço" },
  { href: "/risk", label: "Risco" },
  { href: "/alerts", label: "Alertas & Playbooks" },
  { href: "/sync", label: "Sync Center" },
  { href: "/config", label: "Config" },
] as const;

export function CockpitShell({
  children,
  userName,
  roleLabel,
}: {
  children: React.ReactNode;
  userName: string;
  roleLabel: string;
}) {
  const pathname = usePathname();
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand" style={{ fontSize: "1.6rem", marginBottom: "0.25rem" }}>
          StatusPro
        </div>
        <p className="muted" style={{ margin: "0 0 1.25rem", fontSize: 13 }}>
          Cockpit de decisão
        </p>
        <nav style={{ display: "grid", gap: 2 }}>
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="nav-link"
              data-active={pathname === link.href || pathname.startsWith(link.href + "/") ? "true" : "false"}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div style={{ marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid var(--line)" }}>
          <div style={{ fontSize: 14 }}>{userName}</div>
          <div className="muted" style={{ fontSize: 12, marginBottom: "0.75rem" }}>
            {roleLabel}
          </div>
          <form action={logoutAction}>
            <button className="btn" type="submit">
              Sair
            </button>
          </form>
        </div>
      </aside>
      <div className="main">{children}</div>
    </div>
  );
}
