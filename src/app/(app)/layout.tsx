import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { readSession } from "@/infrastructure/auth/session";
import { ROLE_LABELS } from "@/domain/roles";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession();
  if (!session) redirect("/login");
  return (
    <AppShell userName={session.name} roleLabel={ROLE_LABELS[session.role]} role={session.role}>
      {children}
    </AppShell>
  );
}
