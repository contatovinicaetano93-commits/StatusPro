import { z } from "zod";

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
    NODE_ENV: process.env.NODE_ENV,
  });
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment: ${details}`);
  }

  const raw = parsed.data;
  const isProd = raw.NODE_ENV === "production";
  const authSecret = raw.AUTH_SECRET ?? (isProd ? "" : "statuspro-dev-secret-change-me");

  if (isProd) {
    if (!authSecret || authSecret.length < 16) {
      throw new Error("Invalid environment: AUTH_SECRET is required in production (min 16 chars)");
    }
    if (authSecret === "statuspro-dev-secret-change-me") {
      throw new Error("Invalid environment: AUTH_SECRET must not use the development default in production");
    }
  }

  const allowDemoExplicit = raw.ALLOW_DEMO_AUTH === "true" || raw.ALLOW_DEMO_AUTH === "1";
  const denyDemoExplicit = raw.ALLOW_DEMO_AUTH === "false" || raw.ALLOW_DEMO_AUTH === "0";
  const allowDemoAuth = denyDemoExplicit ? false : isProd ? allowDemoExplicit : true;

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
    NODE_ENV: raw.NODE_ENV,
  };
  return cached;
}

export function isFeatureEnabled(flag: string): boolean {
  const flags = getEnv().FEATURE_FLAGS.split(",").map((f) => f.trim()).filter(Boolean);
  return flags.includes(flag);
}
