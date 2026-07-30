import { redirect } from "next/navigation";
import { readSession, type SessionUser } from "@/infrastructure/auth/session";
import type { Role } from "@/domain/roles";
import { canAccessPath, homePathForRole } from "@/domain/access";

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export async function requireSession(): Promise<SessionUser> {
  const session = await readSession();
  if (!session) {
    throw new AuthError("Não autenticado");
  }
  return session;
}

export async function requireRoles(allowed: readonly Role[]): Promise<SessionUser> {
  const session = await requireSession();
  if (!allowed.includes(session.role)) {
    throw new AuthError("Sem permissão para esta ação");
  }
  return session;
}

export async function requirePageAccess(pathname: string): Promise<SessionUser> {
  const session = await readSession();
  if (!session) redirect("/login");
  if (!canAccessPath(session.role, pathname)) {
    redirect(homePathForRole(session.role));
  }
  return session;
}
