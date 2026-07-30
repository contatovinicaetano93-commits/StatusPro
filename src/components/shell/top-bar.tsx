"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Menu, X } from "lucide-react";
import { logoutAction } from "@/app/actions";
import { getBrand } from "@/lib/brand";
import { APP_NAV, SECONDARY_NAV, pageTitleFromPath } from "@/components/shell/nav";

export function TopBar({
  userName,
  roleLabel,
}: {
  userName: string;
  roleLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const title = pageTitleFromPath(pathname);
  const brand = getBrand();
  const initial = userName.trim().charAt(0).toUpperCase() || "S";

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="flex items-center justify-between gap-4 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] lg:px-8 lg:pt-4">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
            className="flex h-9 w-9 items-center justify-center rounded-full text-foreground/90 active:bg-card lg:hidden"
          >
            <Menu size={22} />
          </button>

          <div className="min-w-0 flex-1 lg:flex lg:items-center lg:justify-between">
            <Link href="/ceo" className="flex items-baseline justify-center gap-1 lg:justify-start">
              <span className="font-mono text-lg font-semibold tracking-[0.2em] text-accent lg:hidden">
                {brand.shortMonogram}
              </span>
              <span className="text-[0.6rem] uppercase tracking-[0.3em] text-muted lg:hidden">
                {brand.locationSubtitle}
              </span>
              <span className="hidden text-lg font-semibold text-foreground lg:inline">{title}</span>
            </Link>
            <p className="mt-0.5 hidden text-xs text-muted lg:block">{brand.tagline}</p>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 py-1 pl-1 pr-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-background">
              {initial}
            </span>
            <div className="hidden leading-tight sm:block">
              <p className="text-[0.6rem] text-muted">{brand.displayName}</p>
              <p className="-mt-0.5 text-[0.7rem] font-semibold text-accent-strong">{roleLabel}</p>
            </div>
          </div>
        </div>
      </header>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="animate-fade-in absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="animate-slide-in-left absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col border-r border-border bg-surface pt-[env(safe-area-inset-top)]">
            <div className="flex items-center justify-between px-5 py-5">
              <div className="flex items-baseline gap-1">
                <span className="font-mono text-lg font-semibold tracking-[0.2em] text-accent">
                  {brand.shortMonogram}
                </span>
                <span className="text-[0.6rem] uppercase tracking-[0.3em] text-muted">
                  {brand.locationSubtitle}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar menu"
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted active:bg-card"
              >
                <X size={20} />
              </button>
            </div>

            <nav className="flex flex-col gap-1 px-3">
              {[...APP_NAV, ...SECONDARY_NAV].map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center justify-between rounded-xl border px-3 py-3 text-sm transition-colors ${
                      active
                        ? "border-accent/50 bg-accent/10 text-accent"
                        : "border-transparent text-foreground/90 active:bg-card"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Icon size={19} strokeWidth={active ? 2.2 : 1.8} />
                      {label}
                    </span>
                    <ChevronRight size={16} className={active ? "text-accent/70" : "text-muted"} />
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto space-y-4 px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-6">
              <p className="text-sm text-foreground">{userName}</p>
              <p className="text-xs text-muted">{roleLabel}</p>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="w-full rounded-xl border border-border px-3 py-2 text-xs text-muted"
                >
                  Sair
                </button>
              </form>
              <p className="text-[0.65rem] text-muted">{brand.productName} · KPIs</p>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
