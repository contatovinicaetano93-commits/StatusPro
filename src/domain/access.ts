import type { Role } from "@/domain/roles";
import { assertNever } from "@/domain/roles";

/** Paths under the authenticated app and which roles may open them. */
export const ROUTE_ACCESS: Record<string, readonly Role[]> = {
  "/ceo": ["ceo", "admin"],
  "/cash": ["ceo", "finance", "admin"],
  "/inventory": ["ceo", "operations", "admin"],
  "/sales": ["ceo", "commercial", "admin"],
  "/service": ["ceo", "operations", "admin"],
  "/risk": ["ceo", "finance", "admin"],
  "/alerts": ["ceo", "finance", "commercial", "operations", "admin"],
  "/horizons": ["ceo", "admin"],
  "/sync": ["admin", "ceo"],
  "/config": ["admin", "ceo"],
};

export function rolesForPath(pathname: string): readonly Role[] | null {
  if (pathname.startsWith("/horizons")) return ROUTE_ACCESS["/horizons"];
  const exact = ROUTE_ACCESS[pathname];
  if (exact) return exact;
  const match = Object.keys(ROUTE_ACCESS)
    .filter((p) => pathname === p || pathname.startsWith(`${p}/`))
    .sort((a, b) => b.length - a.length)[0];
  return match ? ROUTE_ACCESS[match] : null;
}

export function canAccessPath(role: Role, pathname: string): boolean {
  const allowed = rolesForPath(pathname);
  if (!allowed) return role === "admin" || role === "ceo";
  return allowed.includes(role);
}

export function homePathForRole(role: Role): string {
  switch (role) {
    case "ceo":
    case "admin":
      return "/ceo";
    case "finance":
      return "/cash";
    case "commercial":
      return "/sales";
    case "operations":
      return "/inventory";
    default:
      return assertNever(role);
  }
}

export function canRunBriefing(role: Role): boolean {
  return role === "ceo" || role === "admin";
}

export function canRunSync(role: Role): boolean {
  return role === "admin" || role === "ceo";
}

export function canAskAi(role: Role): boolean {
  return role === "ceo" || role === "admin" || role === "finance" || role === "commercial" || role === "operations";
}
