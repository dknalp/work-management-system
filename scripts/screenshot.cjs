#!/usr/bin/env node
/**
 * screenshot.js — Take a full-page screenshot of a URL and save to .screenshots/
 * Usage: node scripts/screenshot.js <url> [output-name]
 * Output: prints "SCREENSHOT: .screenshots/<name>-<timestamp>.png"
 */

const { chromium } = require('/home/dogukan/.nvm/versions/node/v20.20.0/lib/node_modules/@playwright/mcp/node_modules/playwright-core');
const path = require('path');
const fs = require('fs');

const url = process.argv[2];
if (!url) {
  console.error('Usage: node scripts/screenshot.js <url> [output-name]');
  process.exit(1);
}

const projectRoot = path.join(__dirname, '..');
const screenshotsDir = path.join(projectRoot, '.screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// Derive slug from URL path or use provided name
const customName = process.argv[3];
let slug;
if (customName) {
  slug = customName.replace(/[^a-z0-9-_]/gi, '-');
} else {
  try {
    const parsed = new URL(url);
    const p = parsed.pathname.replace(/^\//, '').replace(/\//g, '-') || 'home';
    slug = p.replace(/[^a-z0-9-_]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'home';
  } catch {
    slug = 'screenshot';
  }
}

const timestamp = Date.now();
const filename = `${slug}-${timestamp}.png`;
const outputPath = path.join(screenshotsDir, filename);
const relativePath = path.relative(projectRoot, outputPath);

(async () => {
  const browser = await chromium.launch({
    executablePath: '/home/dogukan/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
  } catch {
    // fallback: load event only
    await page.goto(url, { waitUntil: 'load', timeout: 15000 });
  }

  // Wait a bit for any animations to settle
  await page.waitForTimeout(500);

  await page.screenshot({ path: outputPath, fullPage: true });
  await browser.close();

  console.log(`SCREENSHOT: ${relativePath}`);
})().catch(err => {
  console.error('Screenshot failed:', err.message);
  process.exit(1);
});