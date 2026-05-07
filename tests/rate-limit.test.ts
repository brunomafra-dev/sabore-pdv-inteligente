import assert from "node:assert/strict";
import test from "node:test";
import { checkFixedWindowRateLimit } from "../src/lib/security/rate-limit";

test("blocks auth attempts after five tries inside fifteen minutes", () => {
  const store = new Map<string, { count: number; resetAt: number }>();
  const key = "auth:test";
  const limit = 5;
  const windowMs = 15 * 60_000;
  const now = Date.parse("2026-05-07T10:00:00-03:00");

  for (let attempt = 1; attempt <= limit; attempt += 1) {
    const result = checkFixedWindowRateLimit({
      key,
      limit,
      windowMs,
      now,
      store,
    });

    assert.equal(result.allowed, true);
    assert.equal(result.remaining, limit - attempt);
  }

  const blocked = checkFixedWindowRateLimit({
    key,
    limit,
    windowMs,
    now,
    store,
  });

  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.equal(blocked.retryAfterSeconds, 900);
});

test("resets fixed window after expiration", () => {
  const store = new Map<string, { count: number; resetAt: number }>();
  const key = "api:test";
  const limit = 2;
  const windowMs = 60_000;
  const now = Date.parse("2026-05-07T10:00:00-03:00");

  checkFixedWindowRateLimit({ key, limit, windowMs, now, store });
  checkFixedWindowRateLimit({ key, limit, windowMs, now, store });
  const blocked = checkFixedWindowRateLimit({ key, limit, windowMs, now, store });
  const reset = checkFixedWindowRateLimit({
    key,
    limit,
    windowMs,
    now: now + windowMs + 1,
    store,
  });

  assert.equal(blocked.allowed, false);
  assert.equal(reset.allowed, true);
  assert.equal(reset.remaining, 1);
});
