import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().min(16).default("statuspro-dev-secret-change-me"),
  ANTHROPIC_API_KEY: z.string().optional().default(""),
  OPENAI_API_KEY: z.string().optional().default(""),
  AI_GATEWAY_API_KEY: z.string().optional().default(""),
  FEATURE_FLAGS: z.string().optional().default("ai_briefing,ai_chat,sync_center,playbooks"),
  NEXT_PUBLIC_APP_NAME: z.string().default("StatusPro"),
  NEXT_PUBLIC_DEFAULT_ORG_SLUG: z.string().default("distribuidora-demo"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cached) return cached;
  const parsed = envSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
    FEATURE_FLAGS: process.env.FEATURE_FLAGS,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_DEFAULT_ORG_SLUG: process.env.NEXT_PUBLIC_DEFAULT_ORG_SLUG,
    NODE_ENV: process.env.NODE_ENV,
  });
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment: ${details}`);
  }
  cached = parsed.data;
  return cached;
}

export function isFeatureEnabled(flag: string): boolean {
  const flags = getEnv().FEATURE_FLAGS.split(",").map((f) => f.trim()).filter(Boolean);
  return flags.includes(flag);
}
