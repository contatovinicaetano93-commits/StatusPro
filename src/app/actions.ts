"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  AUTH_COOKIE,
  DEMO_USERS,
  createSessionToken,
  type SessionUser,
} from "@/infrastructure/auth/session";
import { getOrganizationBySlug } from "@/infrastructure/db/repositories";
import { getEnv } from "@/lib/env";
import { AuthError, requireRoles, requireSession } from "@/infrastructure/auth/guards";
import { canRunBriefing, canRunSync, homePathForRole } from "@/domain/access";
import { regenerateBriefing } from "@/application/regenerate-briefing";
import { runErpSync } from "@/application/run-erp-sync";

export async function loginAction(formData: FormData) {
  const env = getEnv();
  if (env.NODE_ENV === "production" && !env.ALLOW_DEMO_AUTH) {
    redirect("/login?error=demo_disabled");
  }

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const demo = DEMO_USERS.find((u) => u.email === email && u.password === password);
  if (!demo) {
    redirect("/login?error=1");
  }

  const org = await getOrganizationBySlug(demo.organizationSlug);
  if (!org) {
    redirect("/login?error=org");
  }

  const user: SessionUser = {
    id: `demo-${demo.role}`,
    email: demo.email,
    name: demo.name,
    role: demo.role,
    organizationId: org.id,
    organizationSlug: demo.organizationSlug,
  };
  const token = await createSessionToken(user);
  const jar = await cookies();
  jar.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  redirect(homePathForRole(user.role));
}

export async function logoutAction() {
  const jar = await cookies();
  jar.delete(AUTH_COOKIE);
  redirect("/login");
}

export async function regenerateBriefingAction() {
  try {
    const session = await requireSession();
    if (!canRunBriefing(session.role)) {
      return { ok: false as const, error: "Sem permissão para gerar briefing." };
    }
    const result = await regenerateBriefing(session.organizationId);
    if (result.ok) revalidatePath("/ceo");
    return result;
  } catch (err) {
    if (err instanceof AuthError) {
      return { ok: false as const, error: err.message };
    }
    throw err;
  }
}

export async function runMockSyncAction() {
  try {
    const session = await requireRoles(["admin", "ceo"]);
    if (!canRunSync(session.role)) {
      return { ok: false as const, error: "Sem permissão para sync." };
    }
    const result = await runErpSync(session.organizationId);
    if (result.ok) {
      revalidatePath("/sync");
      revalidatePath("/ceo");
    }
    return result;
  } catch (err) {
    if (err instanceof AuthError) {
      return { ok: false as const, error: err.message };
    }
    throw err;
  }
}
