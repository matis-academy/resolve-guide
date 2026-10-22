// Автотест в браузере: python3 -m http.server 8766 в папке проекта, затем node tools/test.mjs <папка-для-скриншотов>
import { chromium, devices } from 'playwright';
const out = process.argv[2] || '.';
const browser = await chromium.launch();
const errs = [];
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
page.on('console', (x) => { if (x.type() === 'error') errs.push(x.text()); });
for (const id of ['edit', 'color', 'deliver']) {
  await page.goto(`http://127.0.0.1:8766/#${id}`); await page.waitForTimeout(800);
  const n = await page.$$eval('.zone', (z) => z.length);
  // навести на первую не-панель
  const z = page.locator('.zone:not(.panel)').nth(20);
  await z.hover(); await page.waitForTimeout(150);
  const title = await page.$eval('#card h3', (e) => e.textContent).catch(() => '(нет карточки)');
  console.log(id, 'zones', n, 'hover →', title);
  await page.screenshot({ path: `${out}/${id}-hover.png` });
}
await page.goto('http://127.0.0.1:8766/#deliver'); await page.waitForTimeout(500);
await page.fill('#q', 'codec'); await page.waitForTimeout(200);
console.log('search codec:', await page.$eval('#qCount', (e) => e.textContent));
await page.check('#showAll'); await page.fill('#q', ''); await page.waitForTimeout(200);
await page.screenshot({ path: `${out}/deliver-all.png` });
const m = await browser.newPage({ ...devices['iPhone 13'] });
m.on('pageerror', (e) => errs.push('m pageerror: ' + e.message));
await m.goto('http://127.0.0.1:8766/#edit'); await m.waitForTimeout(800);
await m.locator('.zone:not(.panel)').nth(30).tap(); await m.waitForTimeout(300);
await m.screenshot({ path: `${out}/mobile.png` });
console.log('mobile overflow', await m.evaluate(() => [document.documentElement.scrollWidth, innerWidth]));
console.log(errs.join('\n') || 'no errors');
await browser.close();
