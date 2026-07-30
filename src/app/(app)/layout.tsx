import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { getShellSession } from "@/application/get-shell-session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getShellSession();
  if (!session) redirect("/login");
  return (
    <AppShell userName={session.userName} roleLabel={session.roleLabel} role={session.role}>
      {children}
    </AppShell>
  );
}
