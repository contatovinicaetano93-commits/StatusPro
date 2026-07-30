import { describe, expect, it } from "vitest";
import {
  cashConversionCycle,
  dso,
  evaluateBand,
  fillRate,
  getKpiDefinition,
  grossMargin,
  otif,
} from "@/domain/kpis/engine";

describe("kpi formulas", () => {
  it("computes gross margin", () => {
    expect(grossMargin(100, 72)).toBeCloseTo(0.28);
    expect(grossMargin(0, 10)).toBe(0);
  });

  it("computes fill rate and otif", () => {
    expect(fillRate(95, 100)).toBeCloseTo(0.95);
    expect(otif(90, 100)).toBeCloseTo(0.9);
    expect(fillRate(0, 0)).toBe(1);
  });

  it("computes DSO and CCC", () => {
    expect(dso(3_000_000, 9_000_000)).toBeCloseTo(10);
    expect(cashConversionCycle(40, 50, 25)).toBe(65);
  });

  it("evaluates bands for fill rate", () => {
    const def = getKpiDefinition("fill_rate_day");
    expect(def).toBeTruthy();
    if (!def) return;
    expect(evaluateBand(def, 0.96)).toBe("green");
    expect(evaluateBand(def, 0.92)).toBe("yellow");
    expect(evaluateBand(def, 0.8)).toBe("red");
  });

  it("evaluates inverted bands for overdue AR", () => {
    const def = getKpiDefinition("overdue_ar");
    expect(def).toBeTruthy();
    if (!def) return;
    expect(evaluateBand(def, 1_000_000)).toBe("green");
    expect(evaluateBand(def, 3_000_000)).toBe("yellow");
    expect(evaluateBand(def, 5_000_000)).toBe("red");
  });
});
