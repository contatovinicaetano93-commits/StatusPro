import { redirect } from "next/navigation";
import { readSession, type SessionUser } from "@/infrastructure/auth/session";
import { getOrganizationById } from "@/infrastructure/db/repositories";
import type { OrgContext } from "@/domain/types";

export type TenantContext = {
  session: SessionUser;
  org: OrgContext;
};

/** Pages: session + org from JWT tenant. Never use DEFAULT_ORG_SLUG for reads. */
export async function requireTenant(): Promise<TenantContext> {
  const session = await readSession();
  if (!session) redirect("/login");
  const org = await getOrganizationById(session.organizationId);
  if (!org) {
    redirect("/login?error=org");
  }
  return { session, org };
}
