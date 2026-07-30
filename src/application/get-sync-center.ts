import {
  getSyncRuns,
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
};

export async function getSyncCenter(): Promise<SyncCenterView> {
  const { org } = await requireTenant();
  const [runs, deadLetters] = await Promise.all([
    getSyncRuns(org.id),
    listSyncDeadLetters(org.id),
  ]);
  return { org, runs, deadLetters };
}
