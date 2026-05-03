import { daysUntil } from "./utils";
import type {
  CashSession,
  Ingredient,
  InventoryLot,
  InventoryMovement,
  Order,
  OrderItem,
  OrderStatus,
  Product,
  RecipeItem,
} from "./types";

export interface OrderTotals {
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  paid: number;
  remaining: number;
}

export interface StockPosition {
  ingredient: Ingredient;
  quantity: number;
  minimumStock: number;
  status: "ok" | "low" | "critical";
  closestExpiryDays: number | null;
  costValue: number;
}

export interface RecipeCost {
  productId: string;
  productName: string;
  price: number;
  cost: number;
  cmv: number;
  margin: number;
}

export interface CashClosing {
  sessionId: string;
  salesTotal: number;
  byMethod: Record<string, number>;
  openingAmount: number;
  expectedDrawer: number;
}

export function calculateOrderTotals(
  order: Order,
  products: Product[],
): OrderTotals {
  const subtotal = order.items.reduce((sum, item) => {
    const product = products.find((candidate) => candidate.id === item.productId);

    return sum + (product?.price ?? 0) * item.quantity;
  }, 0);
  const total = Math.max(0, subtotal + order.deliveryFee - order.discount);
  const paid = order.payments.reduce((sum, payment) => sum + payment.amount, 0);

  return {
    subtotal,
    deliveryFee: order.deliveryFee,
    discount: order.discount,
    total,
    paid,
    remaining: Math.max(0, total - paid),
  };
}

export function calculateRecipeCost(
  product: Product,
  ingredients: Ingredient[],
  recipe: RecipeItem[],
): RecipeCost {
  const cost = recipe
    .filter((item) => item.productId === product.id)
    .reduce((sum, item) => {
      const ingredient = ingredients.find(
        (candidate) => candidate.id === item.ingredientId,
      );

      return sum + (ingredient?.averageCost ?? 0) * item.quantity;
    }, 0);
  const cmv = product.price > 0 ? cost / product.price : 0;

  return {
    productId: product.id,
    productName: product.name,
    price: product.price,
    cost,
    cmv,
    margin: product.price - cost,
  };
}

export function calculateStockPositions(
  ingredients: Ingredient[],
  lots: InventoryLot[],
  baseDate = new Date(),
): StockPosition[] {
  return ingredients.map((ingredient) => {
    const ingredientLots = lots.filter((lot) => lot.ingredientId === ingredient.id);
    const quantity = ingredientLots.reduce((sum, lot) => sum + lot.quantity, 0);
    const closestExpiryDays =
      ingredientLots.length > 0
        ? Math.min(...ingredientLots.map((lot) => daysUntil(lot.expiresAt, baseDate)))
        : null;
    const stockRatio =
      ingredient.minimumStock > 0 ? quantity / ingredient.minimumStock : 99;
    const status =
      stockRatio <= 0.5 ? "critical" : stockRatio < 1 ? "low" : "ok";

    return {
      ingredient,
      quantity,
      minimumStock: ingredient.minimumStock,
      status,
      closestExpiryDays,
      costValue: quantity * ingredient.averageCost,
    };
  });
}

export function calculateKitchenCounts(orders: Order[]) {
  return orders.reduce(
    (acc, order) => {
      if (order.status === "new") acc.new += 1;
      if (order.status === "preparing") acc.preparing += 1;
      if (order.status === "ready") acc.ready += 1;

      return acc;
    },
    { new: 0, preparing: 0, ready: 0 },
  );
}

export function nextOrderStatus(status: OrderStatus): OrderStatus {
  const flow: Record<OrderStatus, OrderStatus> = {
    new: "preparing",
    preparing: "ready",
    ready: "delivered",
    delivered: "paid",
    paid: "paid",
    cancelled: "cancelled",
  };

  return flow[status];
}

export function reserveStockForOrder(
  order: Order,
  recipe: RecipeItem[],
  ingredients: Ingredient[],
  timestamp: string,
): InventoryMovement[] {
  const movementMap = new Map<string, InventoryMovement>();

  for (const item of order.items) {
    const recipeItems = recipe.filter((recipeItem) => recipeItem.productId === item.productId);

    for (const recipeItem of recipeItems) {
      const ingredient = ingredients.find(
        (candidate) => candidate.id === recipeItem.ingredientId,
      );

      if (!ingredient) continue;

      const quantity = -(recipeItem.quantity * item.quantity);
      const existing = movementMap.get(recipeItem.ingredientId);
      const costImpact = Math.abs(quantity) * ingredient.averageCost;

      if (existing) {
        existing.quantity += quantity;
        existing.costImpact += costImpact;
      } else {
        movementMap.set(recipeItem.ingredientId, {
          id: `mov-${order.id}-${recipeItem.ingredientId}`,
          unitId: order.unitId,
          ingredientId: recipeItem.ingredientId,
          type: "sale",
          quantity,
          costImpact,
          reason: `Baixa automatica pedido ${order.code}`,
          createdAt: timestamp,
          orderId: order.id,
        });
      }
    }
  }

  return Array.from(movementMap.values());
}

export function closeCashSession(
  session: CashSession,
  orders: Order[],
  products: Product[],
): CashClosing {
  const byMethod: Record<string, number> = {};
  let salesTotal = 0;

  for (const order of orders) {
    const totals = calculateOrderTotals(order, products);
    salesTotal += totals.paid;

    for (const payment of order.payments) {
      byMethod[payment.method] = (byMethod[payment.method] ?? 0) + payment.amount;
    }
  }

  return {
    sessionId: session.id,
    salesTotal,
    byMethod,
    openingAmount: session.openingAmount,
    expectedDrawer: session.openingAmount + (byMethod.cash ?? 0),
  };
}

export function getItemLabel(item: OrderItem, products: Product[]) {
  const product = products.find((candidate) => candidate.id === item.productId);

  return product ? `${item.quantity}x ${product.name}` : `${item.quantity}x Produto`;
}
