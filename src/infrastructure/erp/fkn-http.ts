import { getEnv } from "@/lib/env";

export type FknClientConfig = {
  baseUrl: string;
  apiKey: string;
  healthPath: string;
  pullPath: string;
  timeoutMs: number;
};

/** Returns null when FKN credentials are not configured. */
export function getFknClientConfig(): FknClientConfig | null {
  const env = getEnv();
  if (!env.ERP_FKN_BASE_URL || !env.ERP_FKN_API_KEY) return null;
  return {
    baseUrl: env.ERP_FKN_BASE_URL,
    apiKey: env.ERP_FKN_API_KEY,
    healthPath: env.ERP_FKN_HEALTH_PATH,
    pullPath: env.ERP_FKN_PULL_PATH,
    timeoutMs: env.ERP_FKN_TIMEOUT_MS,
  };
}

export class FknHttpError extends Error {
  readonly status: number;
  readonly bodyPreview: string;

  constructor(status: number, bodyPreview: string) {
    super(`FKN HTTP ${status}: ${bodyPreview.slice(0, 200)}`);
    this.name = "FknHttpError";
    this.status = status;
    this.bodyPreview = bodyPreview;
  }
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Authenticated JSON fetch against the FKN base URL.
 * Paths and auth scheme are placeholders until FKN publishes API docs —
 * adjust headers here when the vendor contract is known.
 */
export async function fknFetchJson(
  config: FknClientConfig,
  path: string,
  init?: {
    method?: "GET" | "POST";
    query?: Record<string, string>;
    body?: unknown;
  },
): Promise<unknown> {
  const url = new URL(joinUrl(config.baseUrl, path));
  if (init?.query) {
    for (const [k, v] of Object.entries(init.query)) {
      url.searchParams.set(k, v);
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const res = await fetch(url, {
      method: init?.method ?? "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${config.apiKey}`,
        ...(init?.body != null ? { "Content-Type": "application/json" } : {}),
      },
      body: init?.body != null ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new FknHttpError(res.status, text || res.statusText);
    }
    if (!text) return null;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new Error(`FKN response is not JSON (${path})`);
    }
  } finally {
    clearTimeout(timer);
  }
}
