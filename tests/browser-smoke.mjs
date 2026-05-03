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

  const textLength = (await page.locator("body").innerText()).trim().length;
  const overlay = await page
    .locator("[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay")
    .count();
  const buttons = await page.locator("button").count();

  await page.screenshot({ path: ".next/sabore-home.png", fullPage: true });
  await page.close();

  return { textLength, overlay, buttons, errors };
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
  await page.getByRole("button", { name: /Mesa/ }).click();
  await page.getByRole("button", { name: /^PDV$/ }).click();
  await page.waitForTimeout(300);

  const textLength = (await page.locator("body").innerText()).trim().length;
  const overlay = await page
    .locator("[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay")
    .count();
  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  );

  await page.screenshot({ path: ".next/sabore-mobile.png", fullPage: true });
  await page.close();

  return { textLength, overlay, horizontalOverflow, errors };
}

const browser = await chromium.launch({ headless: true });
const desktop = await verifyDesktop(browser);
const mobile = await verifyMobile(browser);
await browser.close();

if (
  desktop.textLength === 0 ||
  mobile.textLength === 0 ||
  desktop.overlay > 0 ||
  mobile.overlay > 0 ||
  desktop.errors.length > 0 ||
  mobile.errors.length > 0 ||
  mobile.horizontalOverflow
) {
  console.error(JSON.stringify({ desktop, mobile }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ desktop, mobile }, null, 2));
