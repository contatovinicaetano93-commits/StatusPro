"use server";

import { answerStatusProQuestion } from "@/ai/tools";
import type { AlertItem } from "@/domain/types";

export async function askStatusProAction(args: {
  question: string;
  kpis: Array<{ kpiId: string; value: number; target?: number | null; band: string }>;
  alerts: AlertItem[];
}) {
  return answerStatusProQuestion(args);
}
