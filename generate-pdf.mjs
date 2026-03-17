import puppeteer from 'puppeteer';
import { PDFDocument } from 'pdf-lib';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, 'index.html');
const fileUrl = `file:///${htmlPath.replace(/\\/g, '/')}`;
const pdfPath = path.join(__dirname, 'skcfa-father-son-camp-2026.pdf');

const browser = await puppeteer.launch({
  headless: true,
  protocolTimeout: 120000,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
});

// Measure each .page div
const measureTab = await browser.newPage();
await measureTab.setViewport({ width: 820, height: 800, deviceScaleFactor: 1 });
await measureTab.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 30000 });
await measureTab.evaluate(() => document.fonts.ready);
await new Promise(r => setTimeout(r, 1500)); // wait for Google Fonts

const pageDimensions = await measureTab.evaluate(() => {
  const pages = document.querySelectorAll('.page');
  return Array.from(pages).map(p => ({
    width: p.offsetWidth,
    height: p.scrollHeight,
  }));
});
await measureTab.close();

console.log(`Found ${pageDimensions.length} pages:`);
pageDimensions.forEach((d, i) => console.log(`  Page ${i + 1}: ${d.width} x ${Math.round(d.height)} px`));

// Render each page individually and merge with pdf-lib
const mergedPdf = await PDFDocument.create();

for (let i = 0; i < pageDimensions.length; i++) {
  const { width, height } = pageDimensions[i];
  console.log(`Rendering page ${i + 1}/${pageDimensions.length}...`);

  const tab = await browser.newPage();
  await tab.setViewport({ width, height, deviceScaleFactor: 1 });
  await tab.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 30000 });
  await tab.evaluate(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 1500));

  await tab.evaluate((idx) => {
    const allPages = document.querySelectorAll('.page');
    allPages.forEach((p, j) => {
      p.style.display = j === idx ? 'block' : 'none';
    });
    const style = document.createElement('style');
    style.textContent = `
      @page { margin: 0; }
      body { background: white !important; margin: 0 !important; padding: 0 !important; }
      .page { margin: 0 !important; box-shadow: none !important; max-width: 100% !important; }
    `;
    document.head.appendChild(style);
  }, i);

  const pdfBytes = await tab.pdf({
    printBackground: true,
    width: `${width}px`,
    height: `${height}px`,
  });
  await tab.close();

  const srcPdf = await PDFDocument.load(pdfBytes);
  const [srcPage] = await mergedPdf.copyPages(srcPdf, [0]);
  mergedPdf.addPage(srcPage);
}

const mergedBytes = await mergedPdf.save();
fs.writeFileSync(pdfPath, mergedBytes);
await browser.close();
console.log(`\nPDF generated: ${pdfPath}`);
