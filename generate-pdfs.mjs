/**
 * generate-pdfs.mjs — renders the four download PDFs from their HTML twins.
 *
 * The HTML in src/assets/downloads/ is the source. Chrome prints it as a
 * tagged PDF: headings, lists, tables and the crest's alt text carry across as
 * PDF structure, which is what a screen reader needs. The earlier pdf-lib
 * generator drew text at coordinates and produced no structure at all.
 *
 * Run:  node generate-pdfs.mjs            writes into src/assets/downloads/
 *       node generate-pdfs.mjs <dir>      writes somewhere else, for checking
 *
 * Then look at the result: pdftoppm -png -r 100 file.pdf out — the PDF is
 * whatever the twin's print stylesheet renders, so check the page count.
 */

import puppeteer from 'puppeteer';
import { PDFDocument, PDFName } from 'pdf-lib';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, 'src', 'assets', 'downloads');
const OUT = process.argv[2] ? resolve(process.argv[2]) : SRC;

// Expected page counts. The Downloads page calls the contact sheet a one-page
// card, and the plan and checklist are meant for a fridge door. If a twin's
// content grows past this, the generator fails rather than quietly shipping an
// extra page — tighten the twin's print stylesheet or accept the new count here.
const DOCS = {
  'household-emergency-plan': 1,
  'grab-bag-checklist': 1,
  'emergency-contact-sheet': 1,
  'vulnerable-persons-guide': 2,
};

/** A PDF a screen reader can use has a structure tree. Fail loudly if it does not. */
async function verify(file, expectedPages) {
  const doc = await PDFDocument.load(readFileSync(file), { updateMetadata: false });
  const problems = [];
  if (!doc.catalog.get(PDFName.of('StructTreeRoot'))) problems.push('no structure tree (untagged)');
  if (!doc.catalog.get(PDFName.of('Lang'))) problems.push('no document language');
  if (!doc.getTitle()) problems.push('no title');
  if (doc.getPageCount() !== expectedPages) {
    problems.push(`${doc.getPageCount()} pages, expected ${expectedPages}`);
  }
  return problems;
}

mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch();
let failed = false;
try {
  for (const [name, expectedPages] of Object.entries(DOCS)) {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(join(SRC, `${name}.html`)).href, { waitUntil: 'load' });
    await page.emulateMediaType('print');
    await page.pdf({
      path: join(OUT, `${name}.pdf`),
      format: 'A4',
      preferCSSPageSize: true,   // the twins declare A4 and their margins in @page
      printBackground: true,     // the dark section headers and red banners
      tagged: true,              // structure tree for screen readers
      outline: true,             // bookmarks from the headings
    });
    await page.close();
    const problems = await verify(join(OUT, `${name}.pdf`), expectedPages);
    if (problems.length) {
      failed = true;
      console.error(`✗  ${name}.pdf — ${problems.join('; ')}`);
    } else {
      console.log(`✓  ${name}.pdf — tagged, ${expectedPages} page${expectedPages === 1 ? '' : 's'}`);
    }
  }
} finally {
  await browser.close();
}
if (failed) {
  console.error('\nA PDF did not pass. Nothing is wrong with the files that did; fix the twin and re-run.');
  process.exit(1);
}
console.log(`\nDone. PDFs written to ${OUT}`);
