import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, 'index.html');
const pdfPath = path.join(__dirname, 'skcfa-father-son-camp-2026.pdf');

const browser = await puppeteer.launch({
  headless: true,
  protocolTimeout: 120000,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();

await page.goto(`file:///${htmlPath.replace(/\\/g, '/')}`, {
  waitUntil: 'networkidle0',
  timeout: 30000,
});

// Wait for Google Fonts to load
await new Promise(r => setTimeout(r, 2000));

await page.pdf({
  path: pdfPath,
  format: 'A4',
  printBackground: true,
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
});

await browser.close();
console.log(`PDF generated: ${pdfPath}`);
