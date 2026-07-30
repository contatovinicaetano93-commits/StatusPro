export type Role = "ceo" | "finance" | "commercial" | "operations" | "admin";

export const ROLES: readonly Role[] = [
  "ceo",
  "finance",
  "commercial",
  "operations",
  "admin",
] as const;

export const ROLE_LABELS: Record<Role, string> = {
  ceo: "CEO / Diretoria",
  finance: "Financeiro",
  commercial: "Comercial",
  operations: "Operações",
  admin: "Admin",
};

export function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${String(value)}`);
}
