import { describe, expect, it } from "vitest";
import { canAccessPath, homePathForRole, rolesForPath } from "@/domain/access";

describe("access control", () => {
  it("maps role homes", () => {
    expect(homePathForRole("finance")).toBe("/cash");
    expect(homePathForRole("operations")).toBe("/inventory");
    expect(homePathForRole("commercial")).toBe("/sales");
  });

  it("gates sync to ceo/admin", () => {
    expect(canAccessPath("ceo", "/sync")).toBe(true);
    expect(canAccessPath("admin", "/sync")).toBe(true);
    expect(canAccessPath("finance", "/sync")).toBe(false);
    expect(canAccessPath("commercial", "/config")).toBe(false);
  });

  it("resolves horizon prefix", () => {
    expect(rolesForPath("/horizons/monthly")).toEqual(["ceo", "admin"]);
    expect(canAccessPath("operations", "/horizons/daily")).toBe(false);
  });
});
