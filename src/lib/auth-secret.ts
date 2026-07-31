/**
 * Edge-safe auth helpers (no Next.js / DB imports).
 * Used by middleware and aligned with getEnv() AUTH_SECRET rules.
 */

export const AUTH_COOKIE = "statuspro_session";

/** Dev-only fallback — never accept in production. */
export const DEV_AUTH_SECRET_FALLBACK = "statuspro-dev-secret-change-me";

/**
 * Resolve JWT secret for verify/sign.
 * Production: require AUTH_SECRET (≥16, not the dev default). Fail-closed → null.
 * Non-production: allow DEV_AUTH_SECRET_FALLBACK when unset.
 */
export function resolveAuthSecret(input?: {
  authSecret?: string | undefined;
  nodeEnv?: string | undefined;
}): string | null {
  const nodeEnv = input?.nodeEnv ?? process.env.NODE_ENV;
  const isProd = nodeEnv === "production";
  const raw = (input?.authSecret ?? process.env.AUTH_SECRET)?.trim();
  const secret = raw || (isProd ? "" : DEV_AUTH_SECRET_FALLBACK);
  if (!secret || secret.length < 16) return null;
  if (isProd && secret === DEV_AUTH_SECRET_FALLBACK) return null;
  return secret;
}
