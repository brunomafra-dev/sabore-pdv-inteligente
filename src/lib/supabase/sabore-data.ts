import type { SupabaseClient } from "@supabase/supabase-js";
import { demoData } from "@/lib/demo-data";
import type {
  CashSession,
  Customer,
  DiningTable,
  Ingredient,
  InventoryLot,
  InventoryMovement,
  Order,
  OrderItem,
  Payment,
  Product,
  RecipeItem,
  RestaurantUnit,
  SaboreData,
  UserProfile,
  WhatsAppTemplate,
} from "@/lib/types";
import { getSupabaseDataClient } from "./server";

type DbRow = Record<string, unknown>;

export interface SaboreDataResult {
  data: SaboreData;
  source: "supabase" | "demo";
  message: string;
}

function stringValue(row: DbRow, key: string, fallback = "") {
  const value = row[key];

  return typeof value === "string" ? value : fallback;
}

function optionalString(row: DbRow, key: string) {
  const value = row[key];

  return typeof value === "string" ? value : undefined;
}

function numberValue(row: DbRow, key: string, fallback = 0) {
  const value = row[key];

  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);

  return fallback;
}

function booleanValue(row: DbRow, key: string, fallback = false) {
  const value = row[key];

  return typeof value === "boolean" ? value : fallback;
}

async function selectRows(
  client: SupabaseClient,
  table: string,
  select = "*",
) {
  const { data, error } = await client.from(table).select(select);

  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }

  return (data ?? []) as unknown as DbRow[];
}

function groupBy(rows: DbRow[], key: string) {
  return rows.reduce<Record<string, DbRow[]>>((groups, row) => {
    const value = stringValue(row, key);
    groups[value] = groups[value] ? [...groups[value], row] : [row];

    return groups;
  }, {});
}

function mapUnit(row: DbRow): RestaurantUnit {
  return {
    id: stringValue(row, "id"),
    organizationId: stringValue(row, "organization_id"),
    name: stringValue(row, "name"),
    city: stringValue(row, "city"),
    neighborhood: stringValue(row, "neighborhood"),
    fiscalEnabled: booleanValue(row, "fiscal_enabled"),
  };
}

function mapOrder(
  row: DbRow,
  itemsByOrder: Record<string, DbRow[]>,
  paymentsByOrder: Record<string, DbRow[]>,
): Order {
  const orderId = stringValue(row, "id");

  return {
    id: orderId,
    unitId: stringValue(row, "unit_id"),
    code: stringValue(row, "code"),
    channel: stringValue(row, "channel", "counter") as Order["channel"],
    status: stringValue(row, "status", "new") as Order["status"],
    openedAt: stringValue(row, "opened_at"),
    tableId: optionalString(row, "table_id"),
    customerId: optionalString(row, "customer_id"),
    deliveryFee: numberValue(row, "delivery_fee"),
    discount: numberValue(row, "discount"),
    fiscalStatus: stringValue(
      row,
      "fiscal_status",
      "disabled",
    ) as Order["fiscalStatus"],
    whatsappStatus: stringValue(
      row,
      "whatsapp_status",
      "not_sent",
    ) as Order["whatsappStatus"],
    items: (itemsByOrder[orderId] ?? []).map<OrderItem>((item) => ({
      id: stringValue(item, "id"),
      productId: stringValue(item, "product_id"),
      quantity: numberValue(item, "quantity", 1),
      notes: optionalString(item, "notes"),
      name: optionalString(item, "custom_name"),
      unitPrice:
        item.unit_price === null || item.unit_price === undefined
          ? undefined
          : numberValue(item, "unit_price"),
    })),
    payments: (paymentsByOrder[orderId] ?? []).map<Payment>((payment) => ({
      id: stringValue(payment, "id"),
      method: stringValue(payment, "method", "cash") as Payment["method"],
      amount: numberValue(payment, "amount"),
      externalId: optionalString(payment, "external_id"),
      receivedAt: stringValue(payment, "received_at"),
    })),
  };
}

export async function getSaboreData(): Promise<SaboreDataResult> {
  const client = getSupabaseDataClient();

  if (!client) {
    return {
      data: demoData,
      source: "demo",
      message: "Env vars do Supabase ausentes; usando dados demo.",
    };
  }

  try {
    const organizations = await selectRows(client, "organizations");
    const organizationRow = organizations[0];

    if (!organizationRow) {
      return {
        data: demoData,
        source: "demo",
        message: "Supabase conectado, mas sem seed; usando dados demo.",
      };
    }

    const [
      unitRows,
      userRows,
      tableRows,
      customerRows,
      ingredientRows,
      lotRows,
      productRows,
      recipeRows,
      orderRows,
      orderItemRows,
      paymentRows,
      cashRows,
      movementRows,
      templateRows,
    ] = await Promise.all([
      selectRows(client, "restaurant_units"),
      selectRows(client, "user_profiles"),
      selectRows(client, "dining_tables"),
      selectRows(client, "customers"),
      selectRows(client, "ingredients"),
      selectRows(client, "inventory_lots"),
      selectRows(client, "products"),
      selectRows(client, "recipe_items"),
      selectRows(client, "orders"),
      selectRows(client, "order_items"),
      selectRows(client, "payments"),
      selectRows(client, "cash_sessions"),
      selectRows(client, "inventory_movements"),
      selectRows(client, "whatsapp_templates"),
    ]);
    const unit = unitRows[0];

    if (!unit) {
      return {
        data: demoData,
        source: "demo",
        message: "Supabase conectado, mas sem unidade; usando dados demo.",
      };
    }

    const itemsByOrder = groupBy(orderItemRows, "order_id");
    const paymentsByOrder = groupBy(paymentRows, "order_id");
    const data: SaboreData = {
      organization: {
        id: stringValue(organizationRow, "id"),
        name: stringValue(organizationRow, "name"),
        planPrice: numberValue(organizationRow, "plan_price", 69.9),
      },
      unit: mapUnit(unit),
      users: userRows.map<UserProfile>((row) => ({
        id: stringValue(row, "id"),
        unitId: stringValue(row, "unit_id"),
        name: stringValue(row, "name"),
        role: stringValue(row, "role", "stock") as UserProfile["role"],
      })),
      tables: tableRows.map<DiningTable>((row) => ({
        id: stringValue(row, "id"),
        unitId: stringValue(row, "unit_id"),
        label: stringValue(row, "label"),
        seats: numberValue(row, "seats", 4),
        status: stringValue(row, "status", "free") as DiningTable["status"],
      })),
      customers: customerRows.map<Customer>((row) => ({
        id: stringValue(row, "id"),
        unitId: stringValue(row, "unit_id"),
        name: stringValue(row, "name"),
        phone: stringValue(row, "phone"),
        neighborhood: optionalString(row, "neighborhood"),
      })),
      ingredients: ingredientRows.map<Ingredient>((row) => ({
        id: stringValue(row, "id"),
        unitId: stringValue(row, "unit_id"),
        name: stringValue(row, "name"),
        measure: stringValue(row, "measure", "un") as Ingredient["measure"],
        averageCost: numberValue(row, "average_cost"),
        minimumStock: numberValue(row, "minimum_stock"),
      })),
      lots: lotRows.map<InventoryLot>((row) => ({
        id: stringValue(row, "id"),
        ingredientId: stringValue(row, "ingredient_id"),
        supplier: stringValue(row, "supplier"),
        batchCode: stringValue(row, "batch_code"),
        quantity: numberValue(row, "quantity"),
        expiresAt: stringValue(row, "expires_at"),
        receivedAt: stringValue(row, "received_at"),
      })),
      products: productRows.map<Product>((row) => ({
        id: stringValue(row, "id"),
        unitId: stringValue(row, "unit_id"),
        name: stringValue(row, "name"),
        category: stringValue(row, "category"),
        price: numberValue(row, "price"),
        active: booleanValue(row, "active", true),
        preparationArea: stringValue(
          row,
          "preparation_area",
          "kitchen",
        ) as Product["preparationArea"],
      })),
      recipe: recipeRows.map<RecipeItem>((row) => ({
        id: stringValue(row, "id"),
        productId: stringValue(row, "product_id"),
        ingredientId: stringValue(row, "ingredient_id"),
        quantity: numberValue(row, "quantity"),
      })),
      orders: orderRows.map((row) => mapOrder(row, itemsByOrder, paymentsByOrder)),
      cashSession: cashRows[0]
        ? {
            id: stringValue(cashRows[0], "id"),
            unitId: stringValue(cashRows[0], "unit_id"),
            openedBy: stringValue(cashRows[0], "opened_by"),
            openedAt: stringValue(cashRows[0], "opened_at"),
            openingAmount: numberValue(cashRows[0], "opening_amount"),
            expectedAmount: numberValue(cashRows[0], "expected_amount"),
            status: stringValue(
              cashRows[0],
              "status",
              "open",
            ) as CashSession["status"],
          }
        : demoData.cashSession,
      movements: movementRows.map<InventoryMovement>((row) => ({
        id: stringValue(row, "id"),
        unitId: stringValue(row, "unit_id"),
        ingredientId: stringValue(row, "ingredient_id"),
        orderId: optionalString(row, "order_id"),
        type: stringValue(
          row,
          "type",
          "receipt",
        ) as InventoryMovement["type"],
        quantity: numberValue(row, "quantity"),
        costImpact: numberValue(row, "cost_impact"),
        reason: stringValue(row, "reason"),
        createdAt: stringValue(row, "created_at"),
      })),
      whatsappTemplates: templateRows.map<WhatsAppTemplate>((row) => ({
        id: stringValue(row, "id"),
        unitId: stringValue(row, "unit_id"),
        name: stringValue(row, "name"),
        category: stringValue(
          row,
          "category",
          "utility",
        ) as WhatsAppTemplate["category"],
        status: stringValue(
          row,
          "status",
          "draft",
        ) as WhatsAppTemplate["status"],
        monthlyPrice: numberValue(row, "monthly_price"),
      })),
    };

    return {
      data,
      source: "supabase",
      message: "Dados carregados do Supabase.",
    };
  } catch (error) {
    return {
      data: demoData,
      source: "demo",
      message:
        error instanceof Error
          ? `Supabase indisponivel (${error.message}); usando demo.`
          : "Supabase indisponivel; usando demo.",
    };
  }
}
