"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  AUTH_COOKIE,
  DEMO_USERS,
  createSessionToken,
  type SessionUser,
} from "@/infrastructure/auth/session";
import { getOrganizationBySlug } from "@/infrastructure/db/repositories";
import { getEnv } from "@/lib/env";
import { generateCeoBriefing } from "@/ai/tools";
import { getCeoHome } from "@/application/get-ceo-home";
import { getSql } from "@/infrastructure/db/client";
import { getErpGateway } from "@/infrastructure/erp";
import { logger } from "@/lib/logger";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const demo = DEMO_USERS.find((u) => u.email === email && u.password === password);
  if (!demo) {
    redirect("/login?error=1");
  }
  const org = await getOrganizationBySlug(demo.organizationSlug);
  const user: SessionUser = {
    id: `demo-${demo.role}`,
    email: demo.email,
    name: demo.name,
    role: demo.role,
    organizationId: org?.id ?? "00000000-0000-0000-0000-000000000000",
    organizationSlug: demo.organizationSlug,
  };
  const token = await createSessionToken(user);
  const jar = await cookies();
  jar.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  redirect("/ceo");
}

export async function logoutAction() {
  const jar = await cookies();
  jar.delete(AUTH_COOKIE);
  redirect("/login");
}

export async function regenerateBriefingAction() {
  const home = await getCeoHome("daily");
  if (!home.org) return { ok: false as const, error: "Org não encontrada. Rode npm run db:seed." };
  const generated = await generateCeoBriefing({
    asOfDate: new Date().toISOString().slice(0, 10),
    kpis: home.kpis.map((k) => ({
      kpiId: k.kpiId,
      value: k.value,
      target: k.target,
      band: k.band,
    })),
    alerts: home.alerts,
  });
  try {
    const sql = getSql();
    await sql`
      INSERT INTO ai_briefings (organization_id, horizon, as_of_date, content_md, evidence, model)
      VALUES (
        ${home.org.id},
        'daily',
        ${generated.evidence[0]?.period ?? new Date().toISOString().slice(0, 10)},
        ${generated.contentMd},
        ${JSON.stringify(generated.evidence)}::jsonb,
        ${generated.model}
      )
    `;
  } catch (err) {
    logger.warn("persist briefing failed", { err: String(err) });
  }
  return { ok: true as const, contentMd: generated.contentMd, model: generated.model };
}

export async function runMockSyncAction() {
  const slug = getEnv().NEXT_PUBLIC_DEFAULT_ORG_SLUG;
  const org = await getOrganizationBySlug(slug);
  if (!org) return { ok: false as const, error: "Org ausente" };
  const erp = getErpGateway();
  const started = Date.now();
  try {
    const health = await erp.healthcheck();
    if (!health.ok) {
      return { ok: false as const, error: health.detail ?? "ERP unhealthy" };
    }
    const pull = await erp.pullIncremental(new Date(Date.now() - 86400000));
    const sql = getSql();
    await sql`
      INSERT INTO sync_runs (organization_id, source, mode, status, finished_at, records_in, records_ok, records_error, latency_ms)
      VALUES (
        ${org.id},
        ${erp.sourceName},
        'incremental',
        'success',
        NOW(),
        ${pull.invoices.length},
        ${pull.invoices.length},
        0,
        ${Date.now() - started}
      )
    `;
    return { ok: true as const, records: pull.invoices.length };
  } catch (err) {
    logger.error("sync failed", { err: String(err) });
    return { ok: false as const, error: String(err) };
  }
}
