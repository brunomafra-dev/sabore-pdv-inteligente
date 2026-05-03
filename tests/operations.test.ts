import assert from "node:assert/strict";
import test from "node:test";
import { demoData } from "../src/lib/demo-data";
import {
  calculateOrderTotals,
  calculateRecipeCost,
  calculateStockPositions,
  closeCashSession,
  reserveStockForOrder,
} from "../src/lib/operations";

test("calculates order totals with delivery, discount and remaining amount", () => {
  const order = demoData.orders.find((candidate) => candidate.code === "102");
  assert.ok(order);

  const totals = calculateOrderTotals(order, demoData.products);

  assert.equal(totals.subtotal, 80);
  assert.equal(totals.deliveryFee, 8);
  assert.equal(totals.discount, 5);
  assert.equal(totals.total, 83);
  assert.equal(totals.remaining, 83);
});

test("calculates recipe CMV from ficha tecnica", () => {
  const product = demoData.products.find((candidate) => candidate.id === "prd-risoto");
  assert.ok(product);

  const cost = calculateRecipeCost(product, demoData.ingredients, demoData.recipe);

  assert.equal(Number(cost.cost.toFixed(2)), 12.69);
  assert.equal(Number(cost.cmv.toFixed(4)), 0.2266);
});

test("generates stock movements for an order using recipe quantities", () => {
  const order = demoData.orders.find((candidate) => candidate.code === "101");
  assert.ok(order);

  const movements = reserveStockForOrder(
    order,
    demoData.recipe,
    demoData.ingredients,
    "2026-05-03T12:00:00-03:00",
  );
  const salmon = movements.find((movement) => movement.ingredientId === "ing-salmao");

  assert.ok(salmon);
  assert.equal(salmon.quantity, -0.32);
  assert.equal(Number(salmon.costImpact.toFixed(2)), 23.04);
});

test("flags low stock and near expiry lots", () => {
  const positions = calculateStockPositions(
    demoData.ingredients,
    demoData.lots,
    new Date("2026-05-03T12:00:00-03:00"),
  );
  const shrimp = positions.find((position) => position.ingredient.id === "ing-camarao");

  assert.ok(shrimp);
  assert.equal(shrimp.status, "low");
  assert.equal(shrimp.closestExpiryDays, 1);
});

test("closes cash session by payment method", () => {
  const paidOrders = demoData.orders.filter((order) => order.status === "paid");
  const closing = closeCashSession(
    demoData.cashSession,
    paidOrders,
    demoData.products,
  );

  assert.equal(closing.salesTotal, 56);
  assert.equal(closing.byMethod.pix, 56);
  assert.equal(closing.expectedDrawer, 150);
});
