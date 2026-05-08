import { z } from "zod";
import {
  emailField,
  moneyField,
  optionalTextField,
  passwordField,
  positiveMoneyField,
  quantityField,
  signedQuantityField,
  textField,
} from "@/lib/security/sanitize";

const uuidSchema = z.string().uuid();
const roleSchema = z.enum(["owner", "manager", "cashier", "kitchen", "stock"]);
const unitMeasureSchema = z.enum(["g", "kg", "ml", "l", "un"]);
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
  quantity: quantityField(500),
  notes: optionalTextField(500),
  name: optionalTextField(160),
  unitPrice: moneyField().optional(),
});

const paymentSchema = z.object({
  id: uuidSchema,
  method: paymentMethodSchema,
  amount: positiveMoneyField(),
  receivedAt: textField(40),
  externalId: optionalTextField(160),
});

const orderSchema = z.object({
  id: uuidSchema,
  unitId: uuidSchema,
  code: textField(32),
  channel: z.enum(["counter", "table", "delivery"]),
  status: orderStatusSchema,
  openedAt: textField(40),
  tableId: uuidSchema.optional(),
  customerId: uuidSchema.optional(),
  items: z.array(orderItemSchema).min(1).max(100),
  deliveryFee: moneyField(),
  discount: moneyField(),
  payments: z.array(paymentSchema).max(20),
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
  quantity: signedQuantityField(),
  costImpact: moneyField(),
  reason: textField(160),
  createdAt: textField(40),
  orderId: uuidSchema.optional(),
});

const lotSchema = z.object({
  id: uuidSchema,
  ingredientId: uuidSchema,
  supplier: textField(120),
  batchCode: textField(80),
  quantity: moneyField(100_000),
  expiresAt: textField(20),
  receivedAt: textField(20),
});

const productSchema = z.object({
  id: uuidSchema,
  unitId: uuidSchema,
  name: textField(160),
  category: textField(80),
  price: moneyField(),
  active: z.boolean(),
  preparationArea: z.enum(["kitchen", "bar", "pastry"]),
});

const recipeItemSchema = z.object({
  id: uuidSchema,
  productId: uuidSchema,
  ingredientId: uuidSchema,
  quantity: quantityField(),
});

const tableSchema = z.object({
  id: uuidSchema,
  unitId: uuidSchema,
  label: textField(60),
  seats: z.number().int().positive().max(500),
  status: z.enum(["free", "open", "closing"]),
});

const organizationSettingsSchema = z.object({
  id: uuidSchema,
  name: textField(160),
}).strict();

const unitSettingsSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  name: textField(160),
  city: textField(100),
  neighborhood: textField(100),
}).strict();

const ingredientSchema = z.object({
  id: uuidSchema,
  unitId: uuidSchema,
  name: textField(160),
  measure: unitMeasureSchema,
  averageCost: moneyField(100_000),
  minimumStock: moneyField(100_000),
});

const userProfileSchema = z.object({
  id: uuidSchema,
  unitId: uuidSchema,
  name: textField(160),
  role: roleSchema,
});

export const saboreMutationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("create_order"),
    order: orderSchema,
    movements: z.array(movementSchema).max(500),
  }),
  z.object({
    type: z.literal("append_order_items"),
    orderId: uuidSchema,
    items: z.array(orderItemSchema).min(1).max(100),
    movements: z.array(movementSchema).max(500),
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
    expectedAmount: moneyField(),
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
  z.object({
    type: z.literal("update_unit_settings"),
    organization: organizationSettingsSchema,
    unit: unitSettingsSchema,
  }),
  z.object({
    type: z.literal("create_ingredient"),
    ingredient: ingredientSchema,
  }),
  z.object({
    type: z.literal("create_user_profile"),
    email: emailField(),
    password: passwordField(6, 256),
    profile: userProfileSchema,
  }),
]);

export type SaboreMutation = z.infer<typeof saboreMutationSchema>;
