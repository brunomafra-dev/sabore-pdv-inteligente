import type { SupabaseClient } from "@supabase/supabase-js";
import { saboreMutationSchema, type SaboreMutation } from "@/lib/sabore-mutations";
import {
  AccessError,
  canPerform,
  getAuthenticatedProfile,
  type AuthenticatedProfile,
} from "@/lib/supabase/access";
import {
  parseJsonPayload,
  PayloadError,
  payloadErrorResponse,
} from "@/lib/security/request";
import { apiRateLimit, enforceRateLimit } from "@/lib/security/rate-limit";
import { hasPlanFeature, type PlanFeature } from "@/lib/commercial-plans";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type DbLot = {
  id: string;
  quantity: number | string;
};

function orderRow(order: SaboreMutation & { type: "create_order" }) {
  return {
    id: order.order.id,
    unit_id: order.order.unitId,
    code: order.order.code,
    channel: order.order.channel,
    status: order.order.status,
    table_id: order.order.tableId ?? null,
    customer_id: order.order.customerId ?? null,
    delivery_fee: order.order.deliveryFee,
    discount: order.order.discount,
    fiscal_status: order.order.fiscalStatus,
    whatsapp_status: order.order.whatsappStatus,
    opened_at: order.order.openedAt,
  };
}

function orderItemRows(orderId: string, items: Extract<SaboreMutation, { type: "append_order_items" }>["items"]) {
  return items.map((item) => ({
    id: item.id,
    order_id: orderId,
    product_id: item.productId,
    quantity: item.quantity,
    custom_name: item.name ?? null,
    unit_price: item.unitPrice ?? null,
    notes: item.notes ?? null,
  }));
}

function movementRows(movements: Extract<SaboreMutation, { type: "create_order" }>["movements"]) {
  return movements.map((movement) => ({
    id: movement.id,
    unit_id: movement.unitId,
    ingredient_id: movement.ingredientId,
    order_id: movement.orderId ?? null,
    type: movement.type,
    quantity: movement.quantity,
    cost_impact: movement.costImpact,
    reason: movement.reason,
    created_at: movement.createdAt,
  }));
}

function paymentRow(payment: Extract<SaboreMutation, { type: "pay_order" }>["payment"], orderId: string) {
  return {
    id: payment.id,
    order_id: orderId,
    method: payment.method,
    amount: payment.amount,
    external_id: payment.externalId ?? null,
    received_at: payment.receivedAt,
  };
}

function lotRow(lot: NonNullable<Extract<SaboreMutation, { type: "stock_adjustment" }>["lot"]>) {
  return {
    id: lot.id,
    ingredient_id: lot.ingredientId,
    supplier: lot.supplier,
    batch_code: lot.batchCode,
    quantity: lot.quantity,
    expires_at: lot.expiresAt,
    received_at: lot.receivedAt,
  };
}

function organizationSettingsRow(
  organization: Extract<SaboreMutation, { type: "update_unit_settings" }>["organization"],
) {
  return {
    name: organization.name,
  };
}

function unitSettingsRow(unit: Extract<SaboreMutation, { type: "update_unit_settings" }>["unit"]) {
  return {
    name: unit.name,
    city: unit.city,
    neighborhood: unit.neighborhood,
  };
}

function ingredientRow(ingredient: Extract<SaboreMutation, { type: "create_ingredient" }>["ingredient"]) {
  return {
    id: ingredient.id,
    unit_id: ingredient.unitId,
    name: ingredient.name,
    measure: ingredient.measure,
    average_cost: ingredient.averageCost,
    minimum_stock: ingredient.minimumStock,
  };
}

function userProfileRow(
  profile: Extract<SaboreMutation, { type: "create_user_profile" }>["profile"],
  authUserId: string,
) {
  return {
    id: profile.id,
    auth_user_id: authUserId,
    unit_id: profile.unitId,
    name: profile.name,
    role: profile.role,
  };
}

async function must<T>(label: string, query: PromiseLike<{ data: T; error: unknown }>) {
  const { data, error } = await query;

  if (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error && "message" in error
          ? String(error.message)
          : "erro desconhecido";

    throw new Error(`${label}: ${message}`);
  }

  return data;
}

function ensureUnit(unitId: string, profile: AuthenticatedProfile) {
  if (unitId !== profile.unitId) {
    throw new AccessError("Operacao fora da unidade do usuario", 403);
  }
}

async function assertRows(
  client: SupabaseClient,
  label: string,
  table: string,
  column: string,
  ids: string[],
  profile: AuthenticatedProfile,
) {
  const uniqueIds = [...new Set(ids)];

  if (uniqueIds.length === 0) return;

  const rows = (await must(
    label,
    client.from(table).select("id").in(column, uniqueIds).eq("unit_id", profile.unitId),
  )) as Array<{ id: string }>;

  if (rows.length !== uniqueIds.length) {
    throw new AccessError("Registro nao pertence a unidade do usuario", 403);
  }
}

async function assertOrderAccess(
  client: SupabaseClient,
  orderId: string,
  profile: AuthenticatedProfile,
) {
  const rows = (await must(
    "orders access",
    client
      .from("orders")
      .select("id, channel")
      .eq("id", orderId)
      .eq("unit_id", profile.unitId),
  )) as Array<{ id: string; channel: string }>;

  if (rows.length !== 1) {
    throw new AccessError("Pedido nao pertence a unidade do usuario", 403);
  }

  return rows[0];
}

async function getCommercialState(client: SupabaseClient, unitId: string) {
  const units = (await must(
    "unit commercial state",
    client
      .from("restaurant_units")
      .select("id, organization_id, fiscal_enabled")
      .eq("id", unitId),
  )) as Array<{
    id: string;
    organization_id: string;
    fiscal_enabled: boolean | null;
  }>;

  if (units.length !== 1) {
    throw new AccessError("Unidade comercial indisponivel", 403);
  }

  const organizations = (await must(
    "organization commercial state",
    client
      .from("organizations")
      .select("id, plan_code")
      .eq("id", units[0].organization_id),
  )) as Array<{ id: string; plan_code: string | null }>;

  if (organizations.length !== 1) {
    throw new AccessError("Plano comercial indisponivel", 403);
  }

  const planCode = organizations[0].plan_code === "operation" ? "operation" : "essential";

  return {
    fiscalEnabled: Boolean(units[0].fiscal_enabled),
    planCode,
  };
}

function requirePlanFeature(
  planCode: string,
  feature: PlanFeature,
  message: string,
) {
  if (!hasPlanFeature(planCode, feature)) {
    throw new AccessError(message, 403);
  }
}

async function assertRecipeAccess(
  client: SupabaseClient,
  mutation: Extract<SaboreMutation, { type: "create_recipe_item" }>,
  profile: AuthenticatedProfile,
) {
  await assertRows(
    client,
    "recipe product access",
    "products",
    "id",
    [mutation.recipeItem.productId],
    profile,
  );
  await assertRows(
    client,
    "recipe ingredient access",
    "ingredients",
    "id",
    [mutation.recipeItem.ingredientId],
    profile,
  );
}

async function authorizeMutation(
  client: SupabaseClient,
  mutation: SaboreMutation,
  profile: AuthenticatedProfile,
) {
  if (!canPerform(profile.role, mutation.type)) {
    throw new AccessError("Perfil sem permissao para esta operacao", 403);
  }

  const commercialState = await getCommercialState(client, profile.unitId);

  switch (mutation.type) {
    case "create_order": {
      ensureUnit(mutation.order.unitId, profile);
      if (mutation.order.channel === "delivery") {
        requirePlanFeature(
          commercialState.planCode,
          "internalDelivery",
          "Delivery proprio nao esta liberado neste plano",
        );
      }
      if (mutation.movements.length > 0) {
        requirePlanFeature(
          commercialState.planCode,
          "autoStock",
          "Baixa automatica de estoque nao esta liberada neste plano",
        );
      }
      if (mutation.order.fiscalStatus !== "disabled" && !commercialState.fiscalEnabled) {
        throw new AccessError("Fiscal NFC-e nao esta habilitado para esta unidade", 403);
      }
      mutation.movements.forEach((movement) => ensureUnit(movement.unitId, profile));
      await assertRows(
        client,
        "order product access",
        "products",
        "id",
        mutation.order.items.map((item) => item.productId),
        profile,
      );
      if (mutation.order.tableId) {
        await assertRows(
          client,
          "order table access",
          "dining_tables",
          "id",
          [mutation.order.tableId],
          profile,
        );
      }
      break;
    }
    case "append_order_items": {
      const order = await assertOrderAccess(client, mutation.orderId, profile);
      if (order.channel === "delivery") {
        requirePlanFeature(
          commercialState.planCode,
          "internalDelivery",
          "Delivery proprio nao esta liberado neste plano",
        );
      }
      if (mutation.movements.length > 0) {
        requirePlanFeature(
          commercialState.planCode,
          "autoStock",
          "Baixa automatica de estoque nao esta liberada neste plano",
        );
      }
      mutation.movements.forEach((movement) => ensureUnit(movement.unitId, profile));
      await assertRows(
        client,
        "append product access",
        "products",
        "id",
        mutation.items.map((item) => item.productId),
        profile,
      );
      break;
    }
    case "update_order_status": {
      if (mutation.status === "preparing" || mutation.status === "ready") {
        requirePlanFeature(
          commercialState.planCode,
          "kds",
          "KDS/cozinha nao esta liberado neste plano",
        );
      }
      await assertOrderAccess(client, mutation.orderId, profile);
      break;
    }
    case "update_whatsapp_status": {
      await assertOrderAccess(client, mutation.orderId, profile);
      break;
    }
    case "pay_order": {
      await assertOrderAccess(client, mutation.orderId, profile);
      if (mutation.tableId) {
        await assertRows(
          client,
          "payment table access",
          "dining_tables",
          "id",
          [mutation.tableId],
          profile,
        );
      }
      break;
    }
    case "close_cash": {
      const rows = (await must(
        "cash session access",
        client
          .from("cash_sessions")
          .select("id")
          .eq("id", mutation.cashSessionId)
          .eq("unit_id", profile.unitId),
      )) as Array<{ id: string }>;

      if (rows.length !== 1) {
        throw new AccessError("Caixa nao pertence a unidade do usuario", 403);
      }
      break;
    }
    case "create_product": {
      ensureUnit(mutation.product.unitId, profile);
      break;
    }
    case "create_recipe_item": {
      requirePlanFeature(
        commercialState.planCode,
        "recipes",
        "Ficha tecnica nao esta liberada neste plano",
      );
      await assertRecipeAccess(client, mutation, profile);
      break;
    }
    case "create_table": {
      ensureUnit(mutation.table.unitId, profile);
      break;
    }
    case "stock_adjustment": {
      ensureUnit(mutation.movement.unitId, profile);
      await assertRows(
        client,
        "stock ingredient access",
        "ingredients",
        "id",
        [mutation.movement.ingredientId],
        profile,
      );
      if (mutation.lot) {
        if (mutation.lot.ingredientId !== mutation.movement.ingredientId) {
          throw new AccessError("Lote e movimento precisam usar o mesmo insumo", 400);
        }
        await assertRows(
          client,
          "stock lot ingredient access",
          "ingredients",
          "id",
          [mutation.lot.ingredientId],
          profile,
        );
      }
      break;
    }
    case "update_unit_settings": {
      ensureUnit(mutation.unit.id, profile);
      const rows = (await must(
        "unit settings access",
        client
          .from("restaurant_units")
          .select("id, organization_id")
          .eq("id", profile.unitId)
          .eq("organization_id", mutation.organization.id),
      )) as Array<{ id: string; organization_id: string }>;

      if (rows.length !== 1 || mutation.unit.organizationId !== mutation.organization.id) {
        throw new AccessError("Configuracao nao pertence a unidade do usuario", 403);
      }
      break;
    }
    case "create_ingredient": {
      ensureUnit(mutation.ingredient.unitId, profile);
      break;
    }
    case "create_user_profile": {
      if (mutation.profile.role === "kitchen") {
        requirePlanFeature(
          commercialState.planCode,
          "kds",
          "Usuario de cozinha depende do modulo KDS",
        );
      }
      ensureUnit(mutation.profile.unitId, profile);
      break;
    }
  }
}

async function insertMovements(
  client: SupabaseClient,
  movements: Extract<SaboreMutation, { type: "create_order" }>["movements"],
) {
  if (movements.length === 0) return;

  await must("inventory_movements", client.from("inventory_movements").insert(movementRows(movements)));
  await deductLotsForMovements(client, movements);
}

async function deductLotsForMovements(
  client: SupabaseClient,
  movements: Extract<SaboreMutation, { type: "create_order" }>["movements"],
) {
  for (const movement of movements) {
    if (movement.quantity >= 0) continue;

    let remaining = Math.abs(movement.quantity);
    const lots = await must(
      "inventory_lots select",
      client
        .from("inventory_lots")
        .select("id, quantity")
        .eq("ingredient_id", movement.ingredientId)
        .gt("quantity", 0)
        .order("expires_at", { ascending: true }),
    ) as DbLot[];

    for (const lot of lots) {
      if (remaining <= 0) break;

      const currentQuantity = Number(lot.quantity);
      const consumed = Math.min(currentQuantity, remaining);
      const nextQuantity = Number((currentQuantity - consumed).toFixed(3));
      remaining = Number((remaining - consumed).toFixed(3));

      await must(
        "inventory_lots update",
        client.from("inventory_lots").update({ quantity: nextQuantity }).eq("id", lot.id),
      );
    }
  }
}

async function handleMutation(client: SupabaseClient, mutation: SaboreMutation) {
  switch (mutation.type) {
    case "create_order": {
      await must("orders", client.from("orders").insert(orderRow(mutation)));
      await must(
        "order_items",
        client.from("order_items").insert(orderItemRows(mutation.order.id, mutation.order.items)),
      );
      await insertMovements(client, mutation.movements);

      if (mutation.order.tableId) {
        await must(
          "dining_tables",
          client
            .from("dining_tables")
            .update({ status: "open" })
            .eq("id", mutation.order.tableId),
        );
      }
      break;
    }
    case "append_order_items": {
      await must(
        "order_items",
        client.from("order_items").insert(orderItemRows(mutation.orderId, mutation.items)),
      );
      await insertMovements(client, mutation.movements);
      break;
    }
    case "update_order_status": {
      await must(
        "orders",
        client
          .from("orders")
          .update({ status: mutation.status })
          .eq("id", mutation.orderId),
      );
      break;
    }
    case "pay_order": {
      await must(
        "payments",
        client.from("payments").upsert(paymentRow(mutation.payment, mutation.orderId)),
      );
      await must(
        "orders",
        client
          .from("orders")
          .update({ status: "paid", closed_at: mutation.payment.receivedAt })
          .eq("id", mutation.orderId),
      );

      if (mutation.tableId) {
        await must(
          "dining_tables",
          client.from("dining_tables").update({ status: "free" }).eq("id", mutation.tableId),
        );
      }
      break;
    }
    case "update_whatsapp_status": {
      await must(
        "orders",
        client
          .from("orders")
          .update({ whatsapp_status: mutation.whatsappStatus })
          .eq("id", mutation.orderId),
      );
      break;
    }
    case "close_cash": {
      await must(
        "cash_sessions",
        client
          .from("cash_sessions")
          .update({
            status: "closed",
            expected_amount: mutation.expectedAmount,
            closed_at: new Date().toISOString(),
          })
          .eq("id", mutation.cashSessionId),
      );
      break;
    }
    case "create_product": {
      await must(
        "products",
        client.from("products").insert({
          id: mutation.product.id,
          unit_id: mutation.product.unitId,
          name: mutation.product.name,
          category: mutation.product.category,
          price: mutation.product.price,
          active: mutation.product.active,
          preparation_area: mutation.product.preparationArea,
        }),
      );
      break;
    }
    case "create_recipe_item": {
      await must(
        "recipe_items",
        client.from("recipe_items").insert({
          id: mutation.recipeItem.id,
          product_id: mutation.recipeItem.productId,
          ingredient_id: mutation.recipeItem.ingredientId,
          quantity: mutation.recipeItem.quantity,
        }),
      );
      break;
    }
    case "create_table": {
      await must(
        "dining_tables",
        client.from("dining_tables").insert({
          id: mutation.table.id,
          unit_id: mutation.table.unitId,
          label: mutation.table.label,
          seats: mutation.table.seats,
          status: mutation.table.status,
        }),
      );
      break;
    }
    case "stock_adjustment": {
      if (mutation.lot) {
        await must("inventory_lots", client.from("inventory_lots").insert(lotRow(mutation.lot)));
      }

      await insertMovements(client, [mutation.movement]);
      break;
    }
    case "update_unit_settings": {
      await must(
        "organizations",
        client
          .from("organizations")
          .update(organizationSettingsRow(mutation.organization))
          .eq("id", mutation.organization.id),
      );
      await must(
        "restaurant_units",
        client
          .from("restaurant_units")
          .update(unitSettingsRow(mutation.unit))
          .eq("id", mutation.unit.id),
      );
      break;
    }
    case "create_ingredient": {
      await must(
        "ingredients",
        client.from("ingredients").insert(ingredientRow(mutation.ingredient)),
      );
      break;
    }
    case "create_user_profile": {
      const { data: authData, error: authError } = await client.auth.admin.createUser({
        email: mutation.email,
        password: mutation.password,
        email_confirm: true,
        user_metadata: {
          name: mutation.profile.name,
          role: mutation.profile.role,
        },
      });

      if (authError) {
        throw new Error(`auth user: ${authError.message}`);
      }

      const authUserId = authData.user?.id;

      if (!authUserId) {
        throw new Error("auth user: usuario nao retornado");
      }

      try {
        await must(
          "user_profiles",
          client.from("user_profiles").insert(userProfileRow(mutation.profile, authUserId)),
        );
      } catch (error) {
        await client.auth.admin.deleteUser(authUserId).catch(() => undefined);
        throw error;
      }
      break;
    }
  }
}

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, apiRateLimit("sabore:mutations"));

  if (limited) return limited;

  let payload: unknown;

  try {
    payload = await parseJsonPayload(request, { maxBytes: 128 * 1024 });
  } catch (error) {
    if (error instanceof PayloadError) {
      return payloadErrorResponse(error);
    }

    throw error;
  }

  const parsed = saboreMutationSchema.safeParse(payload);

  if (!parsed.success) {
    return Response.json(
      { error: "Payload invalido", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const client = getSupabaseAdmin();
    const profile = await getAuthenticatedProfile(request, client);

    await authorizeMutation(client, parsed.data, profile);
    await handleMutation(client, parsed.data);

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Sabore mutation failed", error);
    const status = error instanceof AccessError ? error.status : 500;

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel persistir a operacao",
      },
      { status },
    );
  }
}
