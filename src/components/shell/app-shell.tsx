"use client";

import { usePathname } from "next/navigation";
import { DesktopSidebar } from "@/components/shell/desktop-sidebar";
import { TopBar } from "@/components/shell/top-bar";
import { BottomNav } from "@/components/shell/bottom-nav";
import type { Role } from "@/domain/roles";

const STANDALONE_PATHS = ["/login"];

export function AppShell({
  children,
  userName,
  roleLabel,
  role,
}: {
  children: React.ReactNode;
  userName: string;
  roleLabel: string;
  role: Role;
}) {
  const pathname = usePathname();

  if (STANDALONE_PATHS.includes(pathname)) {
    return <>{children}</>;
  }

  return (
    <>
      <div className="flex min-h-screen w-full bg-background">
        <DesktopSidebar userName={userName} roleLabel={roleLabel} role={role} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar userName={userName} roleLabel={roleLabel} role={role} />
          <div className="flex flex-1 flex-col px-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] pt-4 lg:px-8 lg:pb-8">
            {children}
          </div>
        </div>
      </div>
      <BottomNav role={role} />
    </>
  );
}
