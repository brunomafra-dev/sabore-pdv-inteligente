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
  await page.getByRole("button", { name: /^Mesas$/ }).first().click();
  await page.getByRole("button", { name: /^Abrir mesa$/ }).first().click();
  await page.waitForTimeout(300);
  const pizzaBuilderVisible = await page
    .getByText(/Monte sua pizza/i)
    .first()
    .isVisible();
  await page.getByRole("button", { name: /^Cozinha$/ }).click();
  await page.waitForTimeout(300);

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
    composerClearedOnNavigation: !bodyText.includes("Novo pedido Mesa"),
    pizzaBuilderVisible,
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
  !mobile.composerClearedOnNavigation
) {
  console.error(JSON.stringify({ desktop, mobile }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ desktop, mobile }, null, 2));
