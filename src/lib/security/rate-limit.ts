import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "../supabase/server";

type RateLimitStore = Map<string, { count: number; resetAt: number }>;

export type RateLimitOptions = {
  scope: string;
  limit: number;
  windowMs: number;
  keyParts?: string[];
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

const memoryStore: RateLimitStore = new Map();
const defaultApiWindowMs = 60_000;
const defaultAuthWindowMs = 15 * 60_000;

function hashKey(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeKeyPart(part: string) {
  return part.trim().toLowerCase().slice(0, 180) || "unknown";
}

function clientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0];
  const ip =
    forwardedFor ??
    request.headers.get("x-real-ip") ??
    request.headers.get("cf-connecting-ip") ??
    "unknown";

  return normalizeKeyPart(ip);
}

function cleanupExpired(store: RateLimitStore, now: number) {
  if (store.size < 1_000) return;

  for (const [key, value] of store.entries()) {
    if (value.resetAt <= now) {
      store.delete(key);
    }
  }
}

export function checkFixedWindowRateLimit({
  key,
  limit,
  windowMs,
  now = Date.now(),
  store = memoryStore,
}: {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
  store?: RateLimitStore;
}): RateLimitResult {
  cleanupExpired(store, now);

  const current = store.get(key);
  const resetAt = current && current.resetAt > now ? current.resetAt : now + windowMs;
  const count = current && current.resetAt > now ? current.count + 1 : 1;

  store.set(key, { count, resetAt });

  const allowed = count <= limit;
  const retryAfterSeconds = allowed ? 0 : Math.max(1, Math.ceil((resetAt - now) / 1000));

  return {
    allowed,
    limit,
    remaining: Math.max(0, limit - count),
    resetAt,
    retryAfterSeconds,
  };
}

function buildKey(request: Request, options: RateLimitOptions) {
  const url = new URL(request.url);
  const parts = [
    options.scope,
    request.method,
    url.pathname,
    clientIp(request),
    ...(options.keyParts ?? []).map(normalizeKeyPart),
  ];

  return hashKey(parts.join("|"));
}

async function checkSupabaseRateLimit(
  client: SupabaseClient,
  key: string,
  options: RateLimitOptions,
) {
  const { data, error } = await client.rpc("take_rate_limit", {
    p_key: key,
    p_limit: options.limit,
    p_window_seconds: Math.ceil(options.windowMs / 1000),
  });

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (!row || typeof row !== "object") {
    throw new Error("rate limit row unavailable");
  }

  const count = Number("current_count" in row ? row.current_count : 0);
  const resetAtValue = "reset_at" in row ? String(row.reset_at) : "";
  const resetAt = new Date(resetAtValue).getTime();
  const safeResetAt = Number.isNaN(resetAt) ? Date.now() + options.windowMs : resetAt;
  const allowed = Boolean("allowed" in row ? row.allowed : count <= options.limit);

  return {
    allowed,
    limit: options.limit,
    remaining: Math.max(0, options.limit - count),
    resetAt: safeResetAt,
    retryAfterSeconds: allowed
      ? 0
      : Math.max(1, Math.ceil((safeResetAt - Date.now()) / 1000)),
  } satisfies RateLimitResult;
}

export async function checkRateLimit(request: Request, options: RateLimitOptions) {
  const key = buildKey(request, options);

  try {
    return await checkSupabaseRateLimit(getSupabaseAdmin(), key, options);
  } catch {
    return checkFixedWindowRateLimit({
      key,
      limit: options.limit,
      windowMs: options.windowMs,
    });
  }
}

export function apiRateLimit(scope: string): RateLimitOptions {
  return {
    scope,
    limit: 120,
    windowMs: defaultApiWindowMs,
  };
}

export function authRateLimit(scope: string, identity: string): RateLimitOptions {
  return {
    scope,
    limit: 5,
    windowMs: defaultAuthWindowMs,
    keyParts: [identity],
  };
}

export function rateLimitHeaders(result: RateLimitResult) {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };

  if (!result.allowed) {
    headers["Retry-After"] = String(result.retryAfterSeconds);
  }

  return headers;
}

export function rateLimitResponse(result: RateLimitResult) {
  return Response.json(
    {
      error: "rate_limited",
      message: `Muitas requisicoes. Tente novamente em ${result.retryAfterSeconds} segundos.`,
      retryAfterSeconds: result.retryAfterSeconds,
    },
    { status: 429, headers: rateLimitHeaders(result) },
  );
}

export async function enforceRateLimit(request: Request, options: RateLimitOptions) {
  const result = await checkRateLimit(request, options);

  return result.allowed ? null : rateLimitResponse(result);
}
