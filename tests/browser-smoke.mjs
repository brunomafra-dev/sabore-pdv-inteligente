import { chromium } from "playwright";
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const baseUrl = process.env.SABORE_BASE_URL ?? "http://localhost:3000";
const smokeStartedAt = new Date(Date.now() - 5000).toISOString();
const smokeEmail = `sabore-smoke-${Date.now()}@example.com`;
const smokePassword = `Sabore-${Date.now()}!`;
let smokeUserId = null;

function readEnvFile() {
  if (!fs.existsSync(".env.local")) return {};

  return Object.fromEntries(
    fs
      .readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .filter((line) => line && !line.trimStart().startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");

        return [
          line.slice(0, index).trim(),
          line.slice(index + 1).trim().replace(/^['"]|['"]$/g, ""),
        ];
      }),
  );
}

async function cleanupSmokeData() {
  const env = { ...readEnvFile(), ...process.env };
  const rawUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!rawUrl || !serviceKey) return;

  const supabase = createClient(rawUrl.replace(/\/rest\/v1\/?$/, ""), serviceKey, {
    auth: { persistSession: false },
  });
  const { data: candidateOrders } = await supabase
    .from("orders")
    .select("id, code")
    .gte("opened_at", smokeStartedAt)
    .eq("channel", "table");
  const candidateIds = (candidateOrders ?? []).map((order) => order.id);

  if (candidateIds.length === 0) return;

  const { data: testItems } = await supabase
    .from("order_items")
    .select("order_id")
    .in("order_id", candidateIds)
    .eq("custom_name", "Grande 35 cm Calabresa");
  const orderIds = [...new Set((testItems ?? []).map((item) => item.order_id))];

  if (orderIds.length === 0) return;

  const { data: movements } = await supabase
    .from("inventory_movements")
    .select("id, ingredient_id, quantity")
    .in("order_id", orderIds);

  for (const movement of movements ?? []) {
    const quantity = Number(movement.quantity);

    if (quantity >= 0) continue;

    const { data: lots } = await supabase
      .from("inventory_lots")
      .select("id, quantity")
      .eq("ingredient_id", movement.ingredient_id)
      .order("expires_at", { ascending: true })
      .limit(1);
    const lot = lots?.[0];

    if (!lot) continue;

    await supabase
      .from("inventory_lots")
      .update({ quantity: Number((Number(lot.quantity) + Math.abs(quantity)).toFixed(3)) })
      .eq("id", lot.id);
  }

  const movementIds = (movements ?? []).map((movement) => movement.id);

  if (movementIds.length > 0) {
    await supabase.from("inventory_movements").delete().in("id", movementIds);
  }
  await supabase.from("payments").delete().in("order_id", orderIds);
  await supabase.from("order_items").delete().in("order_id", orderIds);
  await supabase.from("orders").delete().in("id", orderIds);
  await supabase.from("dining_tables").update({ status: "free" }).neq("status", "free");
}

async function setupSmokeUser() {
  const env = { ...readEnvFile(), ...process.env };
  const rawUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!rawUrl || !serviceKey) return;

  const supabase = createClient(rawUrl.replace(/\/rest\/v1\/?$/, ""), serviceKey, {
    auth: { persistSession: false },
  });
  const { data: unitResult, error: unitError } = await supabase
    .from("restaurant_units")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (unitError || !unitResult) {
    throw new Error(unitError?.message ?? "Unidade demo nao encontrada");
  }

  const { data: userResult, error: userError } =
    await supabase.auth.admin.createUser({
      email: smokeEmail,
      password: smokePassword,
      email_confirm: true,
    });

  if (userError || !userResult.user) {
    throw new Error(userError?.message ?? "Nao foi possivel criar usuario smoke");
  }

  smokeUserId = userResult.user.id;

  const { error: profileError } = await supabase.from("user_profiles").insert({
    auth_user_id: smokeUserId,
    unit_id: unitResult.id,
    name: "Smoke Test",
    role: "owner",
  });

  if (profileError) {
    throw new Error(profileError.message);
  }
}

async function cleanupSmokeUser() {
  if (!smokeUserId) return;

  const env = { ...readEnvFile(), ...process.env };
  const rawUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!rawUrl || !serviceKey) return;

  const supabase = createClient(rawUrl.replace(/\/rest\/v1\/?$/, ""), serviceKey, {
    auth: { persistSession: false },
  });

  await supabase.from("user_profiles").delete().eq("auth_user_id", smokeUserId);
  await supabase.auth.admin.deleteUser(smokeUserId);
  smokeUserId = null;
}

async function verifyDesktop(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];

  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto(`${baseUrl}/site`, { waitUntil: "networkidle" });
  const callToAction = await page.getByRole("link", { name: /ver demonstracao/i }).count();

  const textLength = (await page.locator("body").innerText()).trim().length;
  const overlay = await page
    .locator("[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay")
    .count();
  const buttons = await page.locator("button, a").count();

  await page.screenshot({ path: ".next/sabore-landing.png", fullPage: true });
  await page.close();

  return { textLength, overlay, buttons, callToAction, errors };
}

async function verifyMobile(browser) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 900 },
    isMobile: true,
  });
  const errors = [];

  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByLabel(/^Email$/).fill(smokeEmail);
  await page.getByLabel(/^Senha$/).fill(smokePassword);
  await page.getByRole("button", { name: /^Entrar$/ }).click();
  await page.getByRole("button", { name: /^Atendimento$/ }).first().waitFor();

  const initialAppText = await page.locator("body").innerText();
  const planBadgeUsesName =
    initialAppText.includes("Plano -") && !initialAppText.includes("Essencial R$");
  const supabaseSourceVisible = (await page.locator("body").innerText()).includes(
    "Supabase",
  );
  const operationFeaturesVisible =
    (await page.getByRole("button", { name: /^Delivery$/ }).count()) > 0;
  let deliveryStartsClosed = true;

  if (operationFeaturesVisible) {
    await page.getByRole("button", { name: /^Delivery$/ }).first().click();
    await page.waitForTimeout(200);
    deliveryStartsClosed = (await page.locator("body").innerText()).includes(
      "Nenhum delivery aberto.",
    );
  }

  await page.getByRole("button", { name: /^Atendimento$/ }).first().click();
  await page.waitForTimeout(200);
  const serviceStartsClosed = (await page.locator("body").innerText()).includes(
    "Nenhuma mesa em atendimento.",
  );

  await page.getByRole("button", { name: /^Mesas$/ }).first().click();
  await page.getByRole("button", { name: /^Abrir mesa$/ }).first().click();
  await page.waitForTimeout(300);
  const pizzaBuilderVisible = await page
    .getByText(/Monte sua pizza/i)
    .first()
    .isVisible();
  await page
    .getByRole("button", { name: operationFeaturesVisible ? /^Cozinha$/ : /^Estoque$/ })
    .click();
  await page.waitForTimeout(300);
  const composerClearedOnNavigation = !(
    await page.locator("body").innerText()
  ).includes("Novo pedido Mesa");

  await page.getByRole("button", { name: /^Mesas$/ }).first().click();
  await page.getByRole("button", { name: /^Abrir mesa$/ }).first().click();
  await page.getByRole("button", { name: /^Adicionar pizza$/ }).click();
  await page.getByRole("button", { name: /^Abrir pedido$/ }).click();
  await page.waitForTimeout(300);

  let kitchenHasRealOrder = true;

  if (operationFeaturesVisible) {
    await page.getByRole("button", { name: /^Cozinha$/ }).click();
    await page.waitForTimeout(300);
    const kitchenText = await page.locator("body").innerText();
    kitchenHasRealOrder =
      kitchenText.includes("Fila") &&
      /#\d+/.test(kitchenText) &&
      /(?:0|1) min/.test(kitchenText);
  }

  await page.getByRole("button", { name: /^Atendimento$/ }).first().click();
  await page.waitForTimeout(300);
  const serviceText = await page.locator("body").innerText();
  const serviceHasRealTable =
    /#\d+/.test(serviceText) && serviceText.includes("Finalizar mesa");
  await page.getByRole("button", { name: /^Finalizar mesa$/ }).first().click();
  await page.waitForTimeout(1200);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: /^Atendimento$/ }).first().click();
  await page.waitForTimeout(300);
  const serviceClosedAfterReload = (await page.locator("body").innerText()).includes(
    "Nenhuma mesa em atendimento.",
  );

  await page.getByRole("button", { name: /^Cadastro$/ }).click();
  await page.waitForTimeout(300);
  const catalogText = await page.locator("body").innerText();
  const catalogFormsVisible =
    catalogText.includes("Itens do cardapio") &&
    catalogText.includes("Mesas e lugares") &&
    (operationFeaturesVisible
      ? catalogText.includes("Ficha tecnica")
      : !catalogText.includes("Ficha tecnica"));

  await page.getByRole("button", { name: /^Estoque$/ }).click();
  await page.waitForTimeout(300);
  const stockText = await page.locator("body").innerText();
  const stockIsFocused =
    stockText.includes("Receber insumo") &&
    stockText.includes("Dar baixa") &&
    !stockText.includes("Itens do cardapio");

  await page.getByRole("button", { name: /^Receber insumo$/ }).click();
  await page.waitForTimeout(200);
  const movementPopupVisible = await page
    .getByText(/Movimentar estoque/i)
    .first()
    .isVisible();
  await page.getByRole("button", { name: /^Fechar$/ }).click();

  let lotsPopupVisible = true;

  if (operationFeaturesVisible) {
    await page.getByRole("button", { name: /^Lotes e validade$/ }).click();
    await page.waitForTimeout(200);
    lotsPopupVisible = await page
      .getByText(/Controle FEFO/i)
      .first()
      .isVisible();
    await page.getByRole("button", { name: /^Fechar$/ }).click();
  }

  await page.getByRole("button", { name: /^Admin$/ }).click();
  await page.waitForTimeout(300);
  const adminText = await page.locator("body").innerText();
  const adminVisible =
    adminText.includes("Configuracao da unidade") &&
    adminText.includes("Usuarios e acessos") &&
    adminText.includes("Planos e modulos");
  const commercialSettingsReadOnly =
    adminText.includes("Plano atual") && !adminText.includes("Mensalidade base");

  const bodyText = (await page.locator("body").innerText()).trim();
  const textLength = bodyText.length;
  const overlay = await page
    .locator("[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay")
    .count();
  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  );

  await page.screenshot({ path: ".next/sabore-mobile.png", fullPage: true });
  await page.close();

  return {
    textLength,
    overlay,
    horizontalOverflow,
    composerClearedOnNavigation,
    supabaseSourceVisible,
    deliveryStartsClosed,
    serviceStartsClosed,
    kitchenHasRealOrder,
    serviceHasRealTable,
    serviceClosedAfterReload,
    pizzaBuilderVisible,
    catalogFormsVisible,
    stockIsFocused,
    movementPopupVisible,
    lotsPopupVisible,
    adminVisible,
    commercialSettingsReadOnly,
    planBadgeUsesName,
    errors,
  };
}

await setupSmokeUser();

const browser = await chromium.launch({ headless: true });
let desktop;
let mobile;

try {
  desktop = await verifyDesktop(browser);
  mobile = await verifyMobile(browser);
} finally {
  await browser.close();
  await cleanupSmokeData();
  await cleanupSmokeUser();
}

if (
  desktop.textLength === 0 ||
  desktop.callToAction === 0 ||
  mobile.textLength === 0 ||
  desktop.overlay > 0 ||
  mobile.overlay > 0 ||
  desktop.errors.length > 0 ||
  mobile.errors.length > 0 ||
  mobile.horizontalOverflow ||
  !mobile.supabaseSourceVisible ||
  !mobile.pizzaBuilderVisible ||
  !mobile.deliveryStartsClosed ||
  !mobile.serviceStartsClosed ||
  !mobile.kitchenHasRealOrder ||
  !mobile.serviceHasRealTable ||
  !mobile.serviceClosedAfterReload ||
  !mobile.catalogFormsVisible ||
  !mobile.stockIsFocused ||
  !mobile.movementPopupVisible ||
  !mobile.lotsPopupVisible ||
  !mobile.adminVisible ||
  !mobile.commercialSettingsReadOnly ||
  !mobile.planBadgeUsesName ||
  !mobile.composerClearedOnNavigation
) {
  console.error(JSON.stringify({ desktop, mobile }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ desktop, mobile }, null, 2));
