import { z } from "zod";
import { DEV_AUTH_SECRET_FALLBACK } from "@/lib/auth-secret";

const rawSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional().default(""),
  OPENAI_API_KEY: z.string().optional().default(""),
  AI_GATEWAY_API_KEY: z.string().optional().default(""),
  FEATURE_FLAGS: z.string().optional().default("ai_briefing,ai_chat,sync_center,playbooks"),
  NEXT_PUBLIC_APP_NAME: z.string().default("StatusPro"),
  ALLOW_DEMO_AUTH: z.string().optional(),
  ERP_MODE: z.enum(["mock", "fkn"]).optional().default("mock"),
  ERP_FKN_BASE_URL: z.string().optional().default(""),
  ERP_FKN_API_KEY: z.string().optional().default(""),
  ERP_FKN_HEALTH_PATH: z.string().optional().default("/health"),
  ERP_FKN_PULL_PATH: z.string().optional().default("/api/v1/pull"),
  ERP_FKN_TIMEOUT_MS: z.string().optional().default("30000"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type AppEnv = {
  DATABASE_URL: string;
  AUTH_SECRET: string;
  ANTHROPIC_API_KEY: string;
  OPENAI_API_KEY: string;
  AI_GATEWAY_API_KEY: string;
  FEATURE_FLAGS: string;
  NEXT_PUBLIC_APP_NAME: string;
  ALLOW_DEMO_AUTH: boolean;
  ERP_MODE: "mock" | "fkn";
  ERP_FKN_BASE_URL: string;
  ERP_FKN_API_KEY: string;
  ERP_FKN_HEALTH_PATH: string;
  ERP_FKN_PULL_PATH: string;
  ERP_FKN_TIMEOUT_MS: number;
  NODE_ENV: "development" | "test" | "production";
};

let cached: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cached) return cached;
  const parsed = rawSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
    FEATURE_FLAGS: process.env.FEATURE_FLAGS,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    ALLOW_DEMO_AUTH: process.env.ALLOW_DEMO_AUTH,
    ERP_MODE: process.env.ERP_MODE,
    ERP_FKN_BASE_URL: process.env.ERP_FKN_BASE_URL,
    ERP_FKN_API_KEY: process.env.ERP_FKN_API_KEY,
    ERP_FKN_HEALTH_PATH: process.env.ERP_FKN_HEALTH_PATH,
    ERP_FKN_PULL_PATH: process.env.ERP_FKN_PULL_PATH,
    ERP_FKN_TIMEOUT_MS: process.env.ERP_FKN_TIMEOUT_MS,
    NODE_ENV: process.env.NODE_ENV,
  });
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment: ${details}`);
  }

  const raw = parsed.data;
  const isProd = raw.NODE_ENV === "production";
  const authSecret = raw.AUTH_SECRET ?? (isProd ? "" : DEV_AUTH_SECRET_FALLBACK);

  if (isProd) {
    if (!authSecret || authSecret.length < 16) {
      throw new Error("Invalid environment: AUTH_SECRET is required in production (min 16 chars)");
    }
    if (authSecret === DEV_AUTH_SECRET_FALLBACK) {
      throw new Error("Invalid environment: AUTH_SECRET must not use the development default in production");
    }
  }

  const allowDemoExplicit = raw.ALLOW_DEMO_AUTH === "true" || raw.ALLOW_DEMO_AUTH === "1";
  const denyDemoExplicit = raw.ALLOW_DEMO_AUTH === "false" || raw.ALLOW_DEMO_AUTH === "0";
  const allowDemoAuth = denyDemoExplicit ? false : isProd ? allowDemoExplicit : true;

  const timeoutMs = Number(raw.ERP_FKN_TIMEOUT_MS);
  const erpTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 30_000;

  cached = {
    DATABASE_URL: raw.DATABASE_URL,
    AUTH_SECRET: authSecret,
    ANTHROPIC_API_KEY: raw.ANTHROPIC_API_KEY,
    OPENAI_API_KEY: raw.OPENAI_API_KEY,
    AI_GATEWAY_API_KEY: raw.AI_GATEWAY_API_KEY,
    FEATURE_FLAGS: raw.FEATURE_FLAGS,
    NEXT_PUBLIC_APP_NAME: raw.NEXT_PUBLIC_APP_NAME,
    ALLOW_DEMO_AUTH: allowDemoAuth,
    ERP_MODE: raw.ERP_MODE ?? "mock",
    ERP_FKN_BASE_URL: (raw.ERP_FKN_BASE_URL ?? "").trim().replace(/\/$/, ""),
    ERP_FKN_API_KEY: (raw.ERP_FKN_API_KEY ?? "").trim(),
    ERP_FKN_HEALTH_PATH: normalizePath(raw.ERP_FKN_HEALTH_PATH ?? "/health"),
    ERP_FKN_PULL_PATH: normalizePath(raw.ERP_FKN_PULL_PATH ?? "/api/v1/pull"),
    ERP_FKN_TIMEOUT_MS: erpTimeoutMs,
    NODE_ENV: raw.NODE_ENV,
  };
  return cached;
}

function normalizePath(path: string): string {
  const trimmed = path.trim() || "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function isFeatureEnabled(flag: string): boolean {
  const flags = getEnv().FEATURE_FLAGS.split(",").map((f) => f.trim()).filter(Boolean);
  return flags.includes(flag);
}

/** Test helper — clears env singleton between cases. */
export function resetEnvCache(): void {
  cached = null;
}
