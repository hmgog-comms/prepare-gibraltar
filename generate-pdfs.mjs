/**
 * generate-pdfs.mjs — renders the four download PDFs from their HTML twins.
 *
 * The HTML in src/assets/downloads/ is the source. Chrome prints it as a
 * tagged PDF: headings, lists, tables and the crest's alt text carry across as
 * PDF structure, which is what a screen reader needs. The earlier pdf-lib
 * generator drew text at coordinates and produced no structure at all.
 *
 * The PDFs are also fillable. Chrome cannot emit form fields, so after printing,
 * the script measures where each blank line (.line, .line-tall, .fill) and
 * checkbox (.checkbox) landed and lays a transparent form field over it with
 * pdf-lib. The printed look is unchanged; in a viewer the blanks can be typed
 * into and saved. Each field carries a tooltip built from its label so a screen
 * reader announces it. Fields are only supported on single-page documents.
 *
 * Run:  node generate-pdfs.mjs            writes into src/assets/downloads/
 *       node generate-pdfs.mjs <dir>      writes somewhere else, for checking
 *       node generate-pdfs.mjs <dir> --demo   same, with every field filled in
 *                                             with its own label — to check that
 *                                             the fields sit on the blanks
 *
 * Then look at the result: pdftoppm -png -r 100 file.pdf out — the PDF is
 * whatever the twin's print stylesheet renders, so check the page count.
 */

import puppeteer from 'puppeteer';
import { PDFDocument, PDFName, PDFHexString } from 'pdf-lib';
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { writeChecksums, SIDECAR } from './download-checksums.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, 'src', 'assets', 'downloads');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const DEMO = process.argv.includes('--demo');
const OUT = args[0] ? resolve(args[0]) : SRC;
if (DEMO && OUT === SRC) {
  console.error('--demo fills every field with sample text; give it another directory.');
  process.exit(1);
}
const PT_PER_PX = 0.75;      // CSS px are 96/in, PDF points 72/in
const PT_PER_MM = 72 / 25.4;

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

/**
 * Runs in the page. Finds every blank, in print layout, and describes it:
 * position and size in CSS px from the top-left of the page content box (the
 * body has no padding in print, so that is the document origin), its kind, and
 * a tooltip assembled from the nearest label and the block it sits in.
 */
function findFields() {
  const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
  const out = [];
  const seen = new Map();
  const add = (el, kind, tooltip) => {
    const r = el.getBoundingClientRect();
    const base = tooltip.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'field';
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    out.push({
      kind, tooltip, name: n === 1 ? base : `${base}-${n}`,
      x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height,
    });
  };
  for (const el of document.querySelectorAll('.line, .line-tall')) {
    if (text(el)) continue;                        // a printed number, not a blank
    const field = el.closest('.field');
    const block = el.closest('.contact-block');
    const label = text(field && field.querySelector('label'));
    const blockName = text(block && block.querySelector('.contact-name'));
    const tooltip = blockName && !label.startsWith(blockName) ? `${blockName} — ${label}` : label;
    add(el, el.classList.contains('line-tall') ? 'multiline' : 'text', tooltip);
  }
  for (const el of document.querySelectorAll('.checkbox')) {
    const item = text(el.closest('li'));
    const section = el.closest('.section');
    const heading = text(section && section.querySelector('h2'));
    add(el, 'check', heading ? `${heading} — ${item}` : item);
  }
  for (const el of document.querySelectorAll('.fill')) {
    add(el, 'text', el.dataset.label || 'Fill in');
  }
  const pageRule = [...document.styleSheets]
    .flatMap((sheet) => [...sheet.cssRules])
    .find((rule) => rule instanceof CSSPageRule);
  return { fields: out, marginMm: parseFloat(pageRule?.style.margin || '0') };
}

/** Lays a transparent form field over each measured blank. */
async function addFormFields(file, { fields, marginMm }, demo) {
  if (!fields.length) return 0;
  const doc = await PDFDocument.load(readFileSync(file), { updateMetadata: false });
  if (doc.getPageCount() !== 1) {
    throw new Error(`${fields.length} fields found but the document has ${doc.getPageCount()} pages; fields are only supported on single-page documents`);
  }
  const page = doc.getPage(0);
  const form = doc.getForm();
  const marginPt = marginMm * PT_PER_MM;
  for (const f of fields) {
    const width = f.w * PT_PER_PX;
    const height = f.h * PT_PER_PX;
    const x = marginPt + f.x * PT_PER_PX;
    const y = page.getHeight() - (marginPt + f.y * PT_PER_PX) - height;
    const box = { x, y, width, height, borderWidth: 0 };   // transparent: the printed line shows through
    let field;
    if (f.kind === 'check') {
      field = form.createCheckBox(f.name);
      field.addToPage(page, box);
      if (demo) field.check();
    } else {
      field = form.createTextField(f.name);
      field.addToPage(page, box);
      field.setFontSize(f.kind === 'multiline' ? 8.5 : 9);
      if (f.kind === 'multiline') field.enableMultiline();
      if (demo) field.setText(f.tooltip);
    }
    field.acroField.dict.set(PDFName.of('TU'), PDFHexString.fromText(f.tooltip));
  }
  writeFileSync(file, await doc.save());
  return fields.length;
}

/** A PDF a screen reader can use has a structure tree. Fail loudly if it does not. */
async function verify(file, expectedPages, expectedFields) {
  const doc = await PDFDocument.load(readFileSync(file), { updateMetadata: false });
  const problems = [];
  const fieldCount = doc.getForm().getFields().length;
  if (fieldCount !== expectedFields) problems.push(`${fieldCount} form fields, expected ${expectedFields}`);
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
    // Render to a temporary file and only replace the committed PDF once it has
    // passed every check. Until 16 Sept 2026 Chrome wrote straight over the
    // destination before verify() ran, so a twin that had grown onto a second
    // page left a bad PDF on disk, one careless `git add` from being committed.
    const final = join(OUT, `${name}.pdf`);
    const tmp = join(OUT, `.${name}.pdf.tmp`);
    try {
      const page = await browser.newPage();
      await page.goto(pathToFileURL(join(SRC, `${name}.html`)).href, { waitUntil: 'load' });
      await page.emulateMediaType('print');
      // Lay the page out at the width it will print at, so measured positions
      // match the PDF: A4 is 210mm wide, less the @page margin on each side.
      const probe = await page.evaluate(findFields);
      const contentPx = Math.round(((210 - 2 * probe.marginMm) / 25.4) * 96);
      await page.setViewport({ width: contentPx, height: 1000 });
      const measured = await page.evaluate(findFields);
      await page.pdf({
        path: tmp,
        format: 'A4',
        preferCSSPageSize: true,   // the twins declare A4 and their margins in @page
        printBackground: true,     // the dark section headers and red banners
        tagged: true,              // structure tree for screen readers
        outline: true,             // bookmarks from the headings
      });
      await page.close();
      const fieldCount = await addFormFields(tmp, measured, DEMO);
      const problems = await verify(tmp, expectedPages, fieldCount);
      if (problems.length) throw new Error(problems.join('; '));
      renameSync(tmp, final);
      const pages = `${expectedPages} page${expectedPages === 1 ? '' : 's'}`;
      const fields = fieldCount ? `, ${fieldCount} fillable fields` : '';
      console.log(`✓  ${name}.pdf — tagged, ${pages}${fields}`);
    } catch (err) {
      failed = true;
      rmSync(tmp, { force: true });
      console.error(`✗  ${name}.pdf — ${err.message}`);
    }
  }
} finally {
  await browser.close();
}
if (failed) {
  console.error(
    '\nA PDF did not pass. The committed file for it is untouched, and nothing is\n' +
    'wrong with the files that did pass; fix the twin and re-run.'
  );
  process.exit(1);
}
if (OUT === SRC) {
  // Record what was generated from what, so check-contacts.mjs can fail the
  // build if a twin is edited and the PDFs are not regenerated with it.
  writeChecksums(SRC, Object.keys(DOCS));
  console.log(`✓  ${SIDECAR} — commit it with the PDFs`);
}
console.log(`\nDone. PDFs written to ${OUT}`);
