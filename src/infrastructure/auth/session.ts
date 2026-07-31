import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getEnv } from "@/lib/env";
import { AUTH_COOKIE } from "@/lib/auth-secret";
import type { Role } from "@/domain/roles";
import { ROLES } from "@/domain/roles";

export { AUTH_COOKIE };

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  organizationId: string;
  organizationSlug: string;
};

function secretKey() {
  return new TextEncoder().encode(getEnv().AUTH_SECRET);
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey());
}

export async function readSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const role = String(payload.role);
    if (!ROLES.includes(role as Role)) return null;
    return {
      id: String(payload.id),
      email: String(payload.email),
      name: String(payload.name),
      role: role as Role,
      organizationId: String(payload.organizationId),
      organizationSlug: String(payload.organizationSlug),
    };
  } catch {
    return null;
  }
}

export const DEMO_USERS: Array<Omit<SessionUser, "id" | "organizationId"> & { password: string }> = [
  {
    email: "ceo@statuspro.local",
    name: "Ana CEO",
    role: "ceo",
    organizationSlug: "distribuidora-demo",
    password: "demo",
  },
  {
    email: "fin@statuspro.local",
    name: "Bruno Financeiro",
    role: "finance",
    organizationSlug: "distribuidora-demo",
    password: "demo",
  },
  {
    email: "com@statuspro.local",
    name: "Carla Comercial",
    role: "commercial",
    organizationSlug: "distribuidora-demo",
    password: "demo",
  },
  {
    email: "ops@statuspro.local",
    name: "Diego Operações",
    role: "operations",
    organizationSlug: "distribuidora-demo",
    password: "demo",
  },
  {
    email: "admin@statuspro.local",
    name: "Eva Admin",
    role: "admin",
    organizationSlug: "distribuidora-demo",
    password: "demo",
  },
];
