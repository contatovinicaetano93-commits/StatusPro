"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { bottomNavForRole } from "@/components/shell/nav";
import type { Role } from "@/domain/roles";

export function BottomNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = bottomNavForRole(role);

  if (items.length === 0) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)] lg:hidden">
      <div className="mx-auto flex w-full max-w-lg">
        {items.map(({ href, shortLabel, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className="relative flex flex-1 flex-col items-center gap-1 py-3 text-xs"
            >
              {active ? <span className="absolute top-0 h-0.5 w-10 rounded-full bg-accent" /> : null}
              <Icon
                size={22}
                strokeWidth={active ? 2.4 : 1.8}
                className={active ? "text-accent" : "text-muted"}
              />
              <span className={`tracking-wide ${active ? "text-accent" : "text-muted"}`}>
                {shortLabel}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
