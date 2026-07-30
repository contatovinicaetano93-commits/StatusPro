import { readSession } from "@/infrastructure/auth/session";
import { ROLE_LABELS } from "@/domain/roles";
import type { Role } from "@/domain/roles";

export type ShellSessionView = {
  userName: string;
  roleLabel: string;
  role: Role;
};

export async function getShellSession(): Promise<ShellSessionView | null> {
  const session = await readSession();
  if (!session) return null;
  return {
    userName: session.name,
    roleLabel: ROLE_LABELS[session.role],
    role: session.role,
  };
}
