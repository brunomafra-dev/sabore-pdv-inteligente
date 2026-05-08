import assert from "node:assert/strict";
import test from "node:test";
import {
  parseJsonPayload,
  PayloadError,
} from "../src/lib/security/request";
import { sanitizeText } from "../src/lib/security/sanitize";
import { saboreMutationSchema } from "../src/lib/sabore-mutations";

test("rejects oversized JSON payloads before parsing", async () => {
  const request = new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ value: "x".repeat(64) }),
  });

  await assert.rejects(
    () => parseJsonPayload(request, { maxBytes: 16 }),
    (error) => error instanceof PayloadError && error.status === 413,
  );
});

test("rejects malformed JSON payloads", async () => {
  const request = new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{bad-json",
  });

  await assert.rejects(
    () => parseJsonPayload(request, { maxBytes: 1024 }),
    (error) => error instanceof PayloadError && error.status === 400,
  );
});

test("rejects non JSON content types", async () => {
  const request = new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: "{}",
  });

  await assert.rejects(
    () => parseJsonPayload(request, { maxBytes: 1024 }),
    (error) => error instanceof PayloadError && error.status === 415,
  );
});

test("sanitizes text by trimming whitespace and control characters", () => {
  assert.equal(sanitizeText("  Mesa\u0000   10  "), "Mesa 10");
});

test("sanitizes mutation strings during schema parsing", () => {
  const parsed = saboreMutationSchema.parse({
    type: "create_product",
    product: {
      id: "00000000-0000-4000-8000-000000000001",
      unitId: "00000000-0000-4000-8000-000000000101",
      name: "  Pizza\u0000   Especial  ",
      category: "  Pizzas  ",
      price: 59.9,
      active: true,
      preparationArea: "kitchen",
    },
  });

  assert.equal(parsed.product.name, "Pizza Especial");
  assert.equal(parsed.product.category, "Pizzas");
});

test("rejects commercial plan changes from unit settings payloads", () => {
  const parsed = saboreMutationSchema.safeParse({
    type: "update_unit_settings",
    organization: {
      id: "00000000-0000-4000-8000-000000000001",
      name: "Pizza e Cia",
      planCode: "operation",
      planPrice: 89.9,
    },
    unit: {
      id: "00000000-0000-4000-8000-000000000101",
      organizationId: "00000000-0000-4000-8000-000000000001",
      name: "Pizza e Cia Ponta Verde",
      city: "Maceio",
      neighborhood: "Ponta Verde",
      fiscalEnabled: true,
    },
  });

  assert.equal(parsed.success, false);
});
