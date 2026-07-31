import {
  AUTH_COOKIE,
  DEMO_USERS,
  createSessionToken,
  type SessionUser,
} from "@/infrastructure/auth/session";
import { getOrganizationBySlug } from "@/infrastructure/db/repositories";
import { getEnv } from "@/lib/env";
import { homePathForRole } from "@/domain/access";

export type LoginDemoResult =
  | {
      ok: true;
      token: string;
      cookieName: string;
      maxAge: number;
      secure: boolean;
      redirectTo: string;
    }
  | { ok: false; error: "demo_disabled" | "invalid" | "org" };

export async function loginDemoUser(input: {
  email: string;
  password: string;
}): Promise<LoginDemoResult> {
  const env = getEnv();
  if (env.NODE_ENV === "production" && !env.ALLOW_DEMO_AUTH) {
    return { ok: false, error: "demo_disabled" };
  }

  const demo = DEMO_USERS.find((u) => u.email === input.email && u.password === input.password);
  if (!demo) return { ok: false, error: "invalid" };

  const org = await getOrganizationBySlug(demo.organizationSlug);
  if (!org) return { ok: false, error: "org" };

  const user: SessionUser = {
    id: `demo-${demo.role}`,
    email: demo.email,
    name: demo.name,
    role: demo.role,
    organizationId: org.id,
    organizationSlug: demo.organizationSlug,
  };

  return {
    ok: true,
    token: await createSessionToken(user),
    cookieName: AUTH_COOKIE,
    maxAge: 60 * 60 * 24 * 7,
    secure: env.NODE_ENV === "production",
    redirectTo: homePathForRole(user.role),
  };
}

export function logoutCookieName(): string {
  return AUTH_COOKIE;
}
