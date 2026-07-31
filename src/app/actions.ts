"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { loginDemoUser, logoutCookieName } from "@/application/login-demo";
import {
  asAuthFailure,
  regenerateBriefingForSession,
  runErpSyncForSession,
} from "@/application/session-actions";
import {
  ackSyncDeadLetter,
  retrySyncDeadLetter,
} from "@/application/dead-letter-actions";

export async function loginAction(formData: FormData) {
  const result = await loginDemoUser({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });

  if (!result.ok) {
    redirect(`/login?error=${result.error === "invalid" ? "1" : result.error}`);
  }

  const jar = await cookies();
  jar.set(result.cookieName, result.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: result.secure,
    path: "/",
    maxAge: result.maxAge,
  });
  redirect(result.redirectTo);
}

export async function logoutAction() {
  const jar = await cookies();
  jar.delete(logoutCookieName());
  redirect("/login");
}

export async function regenerateBriefingAction() {
  try {
    const result = await regenerateBriefingForSession();
    if (result.ok) revalidatePath("/ceo");
    return result;
  } catch (err) {
    const msg = asAuthFailure(err);
    if (msg) return { ok: false as const, error: msg };
    throw err;
  }
}

export async function runMockSyncAction() {
  try {
    const result = await runErpSyncForSession();
    // Always refresh Sync Center (failed runs feed circuit + history).
    revalidatePath("/sync");
    if (result.ok) revalidatePath("/ceo");
    return result;
  } catch (err) {
    const msg = asAuthFailure(err);
    if (msg) return { ok: false as const, error: msg };
    throw err;
  }
}

export async function ackDeadLetterAction(deadLetterId: string) {
  try {
    const result = await ackSyncDeadLetter(deadLetterId);
    if (result.ok) revalidatePath("/sync");
    return result;
  } catch (err) {
    const msg = asAuthFailure(err);
    if (msg) return { ok: false as const, error: msg };
    throw err;
  }
}

export async function retryDeadLetterAction(deadLetterId: string) {
  try {
    const result = await retrySyncDeadLetter(deadLetterId);
    if (result.ok) {
      revalidatePath("/sync");
      revalidatePath("/ceo");
      revalidatePath("/alerts");
    }
    return result;
  } catch (err) {
    const msg = asAuthFailure(err);
    if (msg) return { ok: false as const, error: msg };
    throw err;
  }
}
