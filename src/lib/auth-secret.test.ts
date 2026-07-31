import { describe, expect, it } from "vitest";
import { DEV_AUTH_SECRET_FALLBACK, resolveAuthSecret } from "@/lib/auth-secret";
import { evaluateErpCircuit, type SyncRunRow } from "@/infrastructure/db/repositories";

function run(partial: Partial<SyncRunRow> & { status: string; startedAt: string }): SyncRunRow {
  return {
    id: "r1",
    source: "mock",
    mode: "incremental",
    finishedAt: null,
    recordsIn: 0,
    recordsOk: 0,
    recordsError: 1,
    errorSummary: "x",
    latencyMs: 1,
    ...partial,
  };
}

describe("resolveAuthSecret", () => {
  it("fails closed in production without AUTH_SECRET", () => {
    expect(resolveAuthSecret({ authSecret: undefined, nodeEnv: "production" })).toBeNull();
    expect(resolveAuthSecret({ authSecret: "", nodeEnv: "production" })).toBeNull();
  });

  it("rejects the development default in production", () => {
    expect(
      resolveAuthSecret({ authSecret: DEV_AUTH_SECRET_FALLBACK, nodeEnv: "production" }),
    ).toBeNull();
  });

  it("allows the development fallback outside production", () => {
    expect(resolveAuthSecret({ authSecret: undefined, nodeEnv: "development" })).toBe(
      DEV_AUTH_SECRET_FALLBACK,
    );
  });

  it("accepts a strong production secret", () => {
    expect(
      resolveAuthSecret({ authSecret: "prod-secret-at-least-16", nodeEnv: "production" }),
    ).toBe("prod-secret-at-least-16");
  });
});

describe("evaluateErpCircuit", () => {
  const now = Date.parse("2026-07-30T12:00:00.000Z");
  const cooldown = 5 * 60_000;

  it("is closed when fewer than threshold runs exist", () => {
    expect(
      evaluateErpCircuit(
        [run({ status: "failed", startedAt: new Date(now - 1000).toISOString() })],
        3,
        cooldown,
        now,
      ),
    ).toBe(false);
  });

  it("opens on consecutive failures inside cooldown", () => {
    const started = new Date(now - 60_000).toISOString();
    expect(
      evaluateErpCircuit(
        [
          run({ id: "a", status: "failed", startedAt: started }),
          run({ id: "b", status: "failed", startedAt: started }),
          run({ id: "c", status: "failed", startedAt: started }),
        ],
        3,
        cooldown,
        now,
      ),
    ).toBe(true);
  });

  it("closes after cooldown expires", () => {
    const started = new Date(now - cooldown - 1).toISOString();
    expect(
      evaluateErpCircuit(
        [
          run({ id: "a", status: "failed", startedAt: started }),
          run({ id: "b", status: "failed", startedAt: started }),
          run({ id: "c", status: "failed", startedAt: started }),
        ],
        3,
        cooldown,
        now,
      ),
    ).toBe(false);
  });

  it("stays closed if any recent run succeeded", () => {
    const started = new Date(now - 1000).toISOString();
    expect(
      evaluateErpCircuit(
        [
          run({ id: "a", status: "success", startedAt: started }),
          run({ id: "b", status: "failed", startedAt: started }),
          run({ id: "c", status: "failed", startedAt: started }),
        ],
        3,
        cooldown,
        now,
      ),
    ).toBe(false);
  });
});
