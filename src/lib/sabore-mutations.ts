import { z } from "zod";

const uuidSchema = z.string().uuid();
const paymentMethodSchema = z.enum([
  "cash",
  "pix",
  "credit",
  "debit",
  "voucher",
  "online",
]);

const orderStatusSchema = z.enum([
  "new",
  "preparing",
  "ready",
  "delivered",
  "paid",
  "cancelled",
]);

const orderItemSchema = z.object({
  id: uuidSchema,
  productId: uuidSchema,
  quantity: z.number().positive(),
  notes: z.string().optional(),
  name: z.string().optional(),
  unitPrice: z.number().nonnegative().optional(),
});

const paymentSchema = z.object({
  id: uuidSchema,
  method: paymentMethodSchema,
  amount: z.number().positive(),
  receivedAt: z.string().min(1),
  externalId: z.string().optional(),
});

const orderSchema = z.object({
  id: uuidSchema,
  unitId: uuidSchema,
  code: z.string().min(1),
  channel: z.enum(["counter", "table", "delivery"]),
  status: orderStatusSchema,
  openedAt: z.string().min(1),
  tableId: uuidSchema.optional(),
  customerId: uuidSchema.optional(),
  items: z.array(orderItemSchema).min(1),
  deliveryFee: z.number().nonnegative(),
  discount: z.number().nonnegative(),
  payments: z.array(paymentSchema),
  fiscalStatus: z.enum(["disabled", "pending", "authorized", "rejected"]),
  whatsappStatus: z.enum(["not_sent", "queued", "sent", "failed"]),
});

const movementSchema = z.object({
  id: uuidSchema,
  unitId: uuidSchema,
  ingredientId: uuidSchema,
  type: z.enum([
    "receipt",
    "sale",
    "production",
    "count_adjustment",
    "waste",
    "manual_exit",
  ]),
  quantity: z.number(),
  costImpact: z.number().nonnegative(),
  reason: z.string().min(1),
  createdAt: z.string().min(1),
  orderId: uuidSchema.optional(),
});

const lotSchema = z.object({
  id: uuidSchema,
  ingredientId: uuidSchema,
  supplier: z.string().min(1),
  batchCode: z.string().min(1),
  quantity: z.number().nonnegative(),
  expiresAt: z.string().min(1),
  receivedAt: z.string().min(1),
});

const productSchema = z.object({
  id: uuidSchema,
  unitId: uuidSchema,
  name: z.string().min(1),
  category: z.string().min(1),
  price: z.number().nonnegative(),
  active: z.boolean(),
  preparationArea: z.enum(["kitchen", "bar", "pastry"]),
});

const recipeItemSchema = z.object({
  id: uuidSchema,
  productId: uuidSchema,
  ingredientId: uuidSchema,
  quantity: z.number().positive(),
});

const tableSchema = z.object({
  id: uuidSchema,
  unitId: uuidSchema,
  label: z.string().min(1),
  seats: z.number().int().positive(),
  status: z.enum(["free", "open", "closing"]),
});

export const saboreMutationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("create_order"),
    order: orderSchema,
    movements: z.array(movementSchema),
  }),
  z.object({
    type: z.literal("append_order_items"),
    orderId: uuidSchema,
    items: z.array(orderItemSchema).min(1),
    movements: z.array(movementSchema),
  }),
  z.object({
    type: z.literal("update_order_status"),
    orderId: uuidSchema,
    status: orderStatusSchema,
  }),
  z.object({
    type: z.literal("pay_order"),
    orderId: uuidSchema,
    payment: paymentSchema,
    tableId: uuidSchema.optional(),
  }),
  z.object({
    type: z.literal("update_whatsapp_status"),
    orderId: uuidSchema,
    whatsappStatus: z.enum(["not_sent", "queued", "sent", "failed"]),
  }),
  z.object({
    type: z.literal("close_cash"),
    cashSessionId: uuidSchema,
    expectedAmount: z.number().nonnegative(),
  }),
  z.object({
    type: z.literal("create_product"),
    product: productSchema,
  }),
  z.object({
    type: z.literal("create_recipe_item"),
    recipeItem: recipeItemSchema,
  }),
  z.object({
    type: z.literal("create_table"),
    table: tableSchema,
  }),
  z.object({
    type: z.literal("stock_adjustment"),
    movement: movementSchema,
    lot: lotSchema.optional(),
  }),
]);

export type SaboreMutation = z.infer<typeof saboreMutationSchema>;
