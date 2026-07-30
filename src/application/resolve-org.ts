import { getOrganizationById } from "@/infrastructure/db/repositories";
import { requireTenant } from "@/application/require-tenant";
import type { OrgContext } from "@/domain/types";

export async function resolveOrg(organizationId?: string): Promise<OrgContext | null> {
  if (organizationId) return getOrganizationById(organizationId);
  const tenant = await requireTenant();
  return tenant.org;
}
