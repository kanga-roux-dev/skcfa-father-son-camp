import puppeteer from 'puppeteer';
import { PDFDocument } from 'pdf-lib';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, 'index.html');
const outputPath = path.join(__dirname, 'camp-booklet.pdf');

const browser = await puppeteer.launch({ headless: true });

// Load page once to measure dimensions
const measurePage = await browser.newPage();
await measurePage.setViewport({ width: 820, height: 800, deviceScaleFactor: 1 });
await measurePage.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0', timeout: 30000 });
await measurePage.evaluate(() => document.fonts.ready);

const pageDimensions = await measurePage.evaluate(() => {
  const pages = document.querySelectorAll('.page');
  return Array.from(pages).map(p => ({
    width: p.offsetWidth,
    height: p.scrollHeight
  }));
});
await measurePage.close();

console.log(`Found ${pageDimensions.length} pages`);
pageDimensions.forEach((d, i) => console.log(`  Page ${i + 1}: ${d.width}x${Math.round(d.height)}px`));

const mergedPdf = await PDFDocument.create();

for (let i = 0; i < pageDimensions.length; i++) {
  const dim = pageDimensions[i];
  console.log(`Rendering page ${i + 1}/${pageDimensions.length}...`);

  const tab = await browser.newPage();
  await tab.setViewport({ width: dim.width, height: dim.height, deviceScaleFactor: 1 });
  await tab.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0', timeout: 30000 });
  await tab.evaluate(() => document.fonts.ready);

  // Hide all pages except the target one
  await tab.evaluate((idx) => {
    const allPages = document.querySelectorAll('.page');
    allPages.forEach((p, j) => {
      if (j !== idx) p.style.display = 'none';
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
    width: `${dim.width}px`,
    height: `${dim.height}px`,
  });
  await tab.close();

  const srcPdf = await PDFDocument.load(pdfBytes);
  const [srcPage] = await mergedPdf.copyPages(srcPdf, [0]);
  mergedPdf.addPage(srcPage);
}

const mergedBytes = await mergedPdf.save();
fs.writeFileSync(outputPath, mergedBytes);
console.log(`\nDone! PDF saved to: ${outputPath}`);
await browser.close();
