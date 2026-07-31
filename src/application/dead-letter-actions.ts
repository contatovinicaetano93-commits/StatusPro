import { requireRoles } from "@/infrastructure/auth/guards";
import { canRunSync } from "@/domain/access";
import {
  getSyncDeadLetter,
  markSyncDeadLetterReprocessed,
} from "@/infrastructure/db/repositories";
import { retryDeadLetterUpsert } from "@/infrastructure/db/erp-ingest";

export type DeadLetterActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function ackSyncDeadLetter(deadLetterId: string): Promise<DeadLetterActionResult> {
  const session = await requireRoles(["admin", "ceo"]);
  if (!canRunSync(session.role)) {
    return { ok: false, error: "Sem permissão para ack de dead letter." };
  }
  const id = deadLetterId.trim();
  if (!id) return { ok: false, error: "Dead letter inválida." };

  const ok = await markSyncDeadLetterReprocessed(session.organizationId, id);
  if (!ok) return { ok: false, error: "Dead letter não encontrada ou já processada." };
  return { ok: true };
}

export async function retrySyncDeadLetter(deadLetterId: string): Promise<DeadLetterActionResult> {
  const session = await requireRoles(["admin", "ceo"]);
  if (!canRunSync(session.role)) {
    return { ok: false, error: "Sem permissão para retry de dead letter." };
  }
  const id = deadLetterId.trim();
  if (!id) return { ok: false, error: "Dead letter inválida." };

  const row = await getSyncDeadLetter(session.organizationId, id);
  if (!row) return { ok: false, error: "Dead letter não encontrada ou já processada." };

  const result = await retryDeadLetterUpsert({
    organizationId: session.organizationId,
    entityType: row.entityType,
    payload: row.payload,
  });
  if (!result.ok) return { ok: false, error: result.error };

  const marked = await markSyncDeadLetterReprocessed(session.organizationId, id);
  if (!marked) return { ok: false, error: "Upsert ok, mas falhou ao marcar reprocessed_at." };
  return { ok: true };
}
