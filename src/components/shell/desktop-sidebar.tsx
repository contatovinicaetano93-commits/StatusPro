"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/actions";
import { getBrand } from "@/lib/brand";
import { APP_NAV, SECONDARY_NAV } from "@/components/shell/nav";

export function DesktopSidebar({
  userName,
  roleLabel,
}: {
  userName: string;
  roleLabel: string;
}) {
  const pathname = usePathname();
  const brand = getBrand();
  const initial = userName.trim().charAt(0).toUpperCase() || "S";

  return (
    <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col border-r border-border bg-surface">
      <div className="flex items-baseline gap-1.5 border-b border-border px-6 py-6">
        <span className="font-mono text-xl font-semibold tracking-[0.2em] text-accent">
          {brand.shortMonogram}
        </span>
        <span className="text-[0.65rem] uppercase tracking-[0.3em] text-muted">
          {brand.locationSubtitle}
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-4">
        {APP_NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                active
                  ? "border border-accent/40 bg-accent/10 text-accent"
                  : "text-foreground/85 hover:bg-card hover:text-foreground"
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-1 px-4 pb-2">
        {SECONDARY_NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-xs transition-colors hover:bg-card hover:text-foreground ${
                active ? "text-accent" : "text-muted"
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </div>

      <div className="border-t border-border px-4 py-4">
        <div className="mb-3 flex items-center gap-3 px-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-bold text-background">
            {initial}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-accent-strong">{userName}</p>
            <p className="text-xs text-muted">{roleLabel}</p>
          </div>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="w-full rounded-xl border border-border px-3 py-2 text-xs text-muted transition-colors hover:bg-card hover:text-foreground"
          >
            Sair
          </button>
        </form>
        <p className="mt-4 text-[0.65rem] text-muted/70">StatusPro · KPIs · v0.1</p>
      </div>
    </aside>
  );
}
