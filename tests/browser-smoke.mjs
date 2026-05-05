import { chromium } from "playwright";

const baseUrl = process.env.SABORE_BASE_URL ?? "http://localhost:3000";

async function verifyDesktop(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];

  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto(baseUrl, { waitUntil: "networkidle" });
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

  await page.goto(`${baseUrl}/app`, { waitUntil: "networkidle" });

  await page.getByRole("button", { name: /^Delivery$/ }).first().click();
  await page.waitForTimeout(200);
  const deliveryStartsClosed = (await page.locator("body").innerText()).includes(
    "Nenhum delivery aberto.",
  );

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
  await page.getByRole("button", { name: /^Cozinha$/ }).click();
  await page.waitForTimeout(300);
  const composerClearedOnNavigation = !(
    await page.locator("body").innerText()
  ).includes("Novo pedido Mesa");

  await page.getByRole("button", { name: /^Mesas$/ }).first().click();
  await page.getByRole("button", { name: /^Abrir mesa$/ }).first().click();
  await page.getByRole("button", { name: /^Adicionar pizza$/ }).click();
  await page.getByRole("button", { name: /^Abrir pedido$/ }).click();
  await page.waitForTimeout(300);

  await page.getByRole("button", { name: /^Cozinha$/ }).click();
  await page.waitForTimeout(300);
  const kitchenText = await page.locator("body").innerText();
  const kitchenHasRealOrder =
    kitchenText.includes("Fila") &&
    /#\d+/.test(kitchenText) &&
    /(?:0|1) min/.test(kitchenText);

  await page.getByRole("button", { name: /^Atendimento$/ }).first().click();
  await page.waitForTimeout(300);
  const serviceText = await page.locator("body").innerText();
  const serviceHasRealTable =
    serviceText.includes("Mesa 1") && /#\d+/.test(serviceText);

  await page.getByRole("button", { name: /^Cadastro$/ }).click();
  await page.waitForTimeout(300);
  const catalogText = await page.locator("body").innerText();
  const catalogFormsVisible =
    catalogText.includes("Itens do cardapio") &&
    catalogText.includes("Ficha tecnica") &&
    catalogText.includes("Mesas e lugares");

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

  await page.getByRole("button", { name: /^Lotes e validade$/ }).click();
  await page.waitForTimeout(200);
  const lotsPopupVisible = await page
    .getByText(/Controle FEFO/i)
    .first()
    .isVisible();

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
    deliveryStartsClosed,
    serviceStartsClosed,
    kitchenHasRealOrder,
    serviceHasRealTable,
    pizzaBuilderVisible,
    catalogFormsVisible,
    stockIsFocused,
    movementPopupVisible,
    lotsPopupVisible,
    errors,
  };
}

const browser = await chromium.launch({ headless: true });
const desktop = await verifyDesktop(browser);
const mobile = await verifyMobile(browser);
await browser.close();

if (
  desktop.textLength === 0 ||
  desktop.callToAction === 0 ||
  mobile.textLength === 0 ||
  desktop.overlay > 0 ||
  mobile.overlay > 0 ||
  desktop.errors.length > 0 ||
  mobile.errors.length > 0 ||
  mobile.horizontalOverflow ||
  !mobile.pizzaBuilderVisible ||
  !mobile.deliveryStartsClosed ||
  !mobile.serviceStartsClosed ||
  !mobile.kitchenHasRealOrder ||
  !mobile.serviceHasRealTable ||
  !mobile.catalogFormsVisible ||
  !mobile.stockIsFocused ||
  !mobile.movementPopupVisible ||
  !mobile.lotsPopupVisible ||
  !mobile.composerClearedOnNavigation
) {
  console.error(JSON.stringify({ desktop, mobile }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ desktop, mobile }, null, 2));
