import { describe, expect, it } from "vitest";
import { alertScore, rankAlerts } from "@/domain/alerts/rank";
import type { AlertItem } from "@/domain/types";

function alert(partial: Partial<AlertItem> & Pick<AlertItem, "id" | "severity" | "title">): AlertItem {
  return {
    detail: partial.detail ?? "detail",
    suggestedActions: partial.suggestedActions ?? [],
    createdAt: partial.createdAt ?? "2026-07-30T12:00:00.000Z",
    impactBrl: partial.impactBrl,
    kpiId: partial.kpiId,
    ...partial,
  };
}

describe("rankAlerts", () => {
  it("ranks critical above high, then by impact", () => {
    const ranked = rankAlerts([
      alert({ id: "1", severity: "medium", title: "m", impactBrl: 9_000_000 }),
      alert({ id: "2", severity: "critical", title: "c", impactBrl: 10_000 }),
      alert({ id: "3", severity: "high", title: "h-low", impactBrl: 1_000 }),
      alert({ id: "4", severity: "high", title: "h-high", impactBrl: 500_000 }),
    ]);

    expect(ranked.map((a) => a.id)).toEqual(["2", "4", "3", "1"]);
    expect(alertScore(ranked[0]!)).toBeGreaterThan(alertScore(ranked[1]!));
  });
});
