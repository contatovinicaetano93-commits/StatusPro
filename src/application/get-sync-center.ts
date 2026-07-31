import {
  getSyncRuns,
  isErpCircuitOpen,
  listSyncDeadLetters,
  type SyncDeadLetterRow,
  type SyncRunRow,
} from "@/infrastructure/db/repositories";
import type { OrgContext } from "@/domain/types";
import { requireTenant } from "@/application/require-tenant";

export type SyncCenterView = {
  org: OrgContext | null;
  runs: SyncRunRow[];
  deadLetters: SyncDeadLetterRow[];
  circuitOpen: boolean;
};

export async function getSyncCenter(): Promise<SyncCenterView> {
  const { org } = await requireTenant();
  const [runs, deadLetters, circuitOpen] = await Promise.all([
    getSyncRuns(org.id),
    listSyncDeadLetters(org.id),
    isErpCircuitOpen(org.id),
  ]);
  return { org, runs, deadLetters, circuitOpen };
}
