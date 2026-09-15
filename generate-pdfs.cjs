/**
 * generate-pdfs.cjs
 * Generates fillable A4 PDFs for the Emergency Preparedness Gibraltar downloads page.
 * Run with: node generate-pdfs.cjs
 */

const { PDFDocument, StandardFonts, rgb, PDFName, PDFHexString } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

// A4 dimensions in points (1pt = 1/72 inch)
const W = 595;
const H = 842;
const M = 40; // margin

// Colors
const RED     = rgb(0.753, 0.224, 0.169);
const BLACK   = rgb(0.102, 0.102, 0.102);
const WHITE   = rgb(1, 1, 1);
const DARK    = rgb(0.102, 0.102, 0.102);
const GREY    = rgb(0.957, 0.957, 0.957);
const BORDER  = rgb(0.780, 0.780, 0.780);
const MUTED   = rgb(0.467, 0.467, 0.467);
const RED_BG  = rgb(1.000, 0.945, 0.945);

// -------------------------------------------------------
// Drawing helpers (topY = distance from TOP of page)
// -------------------------------------------------------

function py(topY) { return H - topY; }

function drawText(page, font, text, x, topY, size, color = BLACK) {
  page.drawText(text, { x, y: H - topY - size * 0.72, size, font, color });
}

function drawTextCentered(page, font, text, topY, size, color = BLACK, xOffset = 0) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: (W - w) / 2 + xOffset, y: H - topY - size * 0.72, size, font, color });
}

function fillRect(page, x, topY, width, height, color) {
  page.drawRectangle({ x, y: H - topY - height, width, height, color });
}

function strokeRect(page, x, topY, width, height, borderColor, borderWidth = 0.5) {
  page.drawRectangle({ x, y: H - topY - height, width, height, borderColor, borderWidth });
}

function hLine(page, topY, color = BORDER, thickness = 0.5) {
  page.drawLine({ start: { x: M, y: py(topY) }, end: { x: W - M, y: py(topY) }, thickness, color });
}

function sectionHeader(page, fonts, title, topY, x = M, width = W - 2 * M) {
  const h = 18;
  fillRect(page, x, topY, width, h, DARK);
  drawText(page, fonts.bold, title.toUpperCase(), x + 8, topY + 4.5, 8, WHITE);
  return topY + h;
}

function fieldLabel(page, fonts, label, x, topY) {
  drawText(page, fonts.bold, label.toUpperCase(), x, topY, 7, MUTED);
}

// Screen-reader tooltips (/TU) for named fields. Fields not listed here must
// pass an explicit tooltip to addTextField/addCheckBox.
const TOOLTIPS = {
  address: 'Full address',
  adults: 'Number of adults',
  children: 'Number of children',
  pets: 'Pets (type / name)',
  support_needs: 'Support needs / medical equipment in household',
  evac_primary: 'Primary evacuation route',
  evac_alt: 'Alternative route if primary is blocked',
  meet1: 'Meeting point (outside home)',
  meet2: 'Backup meeting point (further away)',
  grab_bag: 'Where is our grab bag kept?',
  key_holder: 'Who has a key to our home?',
  our_gp: 'Our GP',
  review_date: 'Review date',
  last_checked: 'Last checked',
  ice1_name: 'ICE contact 1 — name',
  ice1_rel: 'ICE contact 1 — relationship',
  ice1_mobile: 'ICE contact 1 — mobile number',
  ice1_home: 'ICE contact 1 — home or work number',
  ice1_number: 'ICE contact 1 — number',
  ice2_name: 'ICE contact 2 — name',
  ice2_rel: 'ICE contact 2 — relationship',
  ice2_mobile: 'ICE contact 2 — mobile number',
  ice2_home: 'ICE contact 2 — home or work number',
  ice2_number: 'ICE contact 2 — number',
  gp_name: 'My GP / health centre',
  gp_number: 'GP / health centre number',
};

function setTooltip(field, text) {
  if (text) field.acroField.dict.set(PDFName.of('TU'), PDFHexString.fromText(text));
}

function addTextField(form, page, name, x, topY, width, height, multiline = false, tooltip = null) {
  const field = form.createTextField(name);
  field.addToPage(page, {
    x, y: H - topY - height, width, height,
    borderWidth: 0.75, borderColor: BORDER, backgroundColor: GREY,
  });
  if (multiline) field.enableMultiline();
  field.setFontSize(9);
  setTooltip(field, tooltip || TOOLTIPS[name]);
  return field;
}

function addCheckBox(form, page, name, x, topY, size = 10, tooltip = null) {
  const cb = form.createCheckBox(name);
  cb.addToPage(page, {
    x, y: H - topY - size, width: size, height: size,
    borderWidth: 0.75, borderColor: BORDER, backgroundColor: WHITE,
  });
  setTooltip(cb, tooltip || TOOLTIPS[name]);
  return cb;
}

async function loadFonts(doc) {
  return {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };
}

// -------------------------------------------------------
// DOCUMENT 1: Household Emergency Plan
// -------------------------------------------------------
async function generateHouseholdPlan(crestBytes) {
  const doc = await PDFDocument.create();
  const form = doc.getForm();
  const f = await loadFonts(doc);
  const page = doc.addPage([W, H]);
  const CW = W - 2 * M;
  let y = M;

  // Header
  const img = await doc.embedPng(crestBytes);
  const crestH = 52;
  const crestW = img.width * (crestH / img.height);
  page.drawImage(img, { x: M, y: H - y - crestH, width: crestW, height: crestH });
  drawText(page, f.bold,    'Household Emergency Plan',             M + crestW + 12, y + 6,  16, BLACK);
  drawText(page, f.regular, 'Emergency Preparedness Gibraltar  ·  HM Government of Gibraltar', M + crestW + 12, y + 26, 8, MUTED);
  y += crestH + 6;

  fillRect(page, M, y, CW, 2.5, RED);
  y += 10;

  // Intro
  fillRect(page, M,     y, 3,    28, RED);
  fillRect(page, M + 3, y, CW-3, 28, GREY);
  drawText(page, f.regular, 'Fill in this plan and keep a printed copy at home — on the fridge or in a kitchen drawer.',    M + 10, y + 8,  8, BLACK);
  drawText(page, f.regular, 'Share with a trusted neighbour. Review every year or after any change in your household.',     M + 10, y + 19, 8, BLACK);
  y += 36;

  // Section 1
  y = sectionHeader(page, f, '1. Our Household', y) + 8;
  fieldLabel(page, f, 'Full address', M, y);
  y += 9;
  addTextField(form, page, 'address', M, y, CW, 30, true);
  y += 38;

  const c3 = (CW - 16) / 3;
  fieldLabel(page, f, 'Number of adults',   M,             y);
  fieldLabel(page, f, 'Number of children', M + c3 + 8,   y);
  fieldLabel(page, f, 'Pets (type / name)', M + 2*(c3+8), y);
  y += 9;
  addTextField(form, page, 'adults',   M,             y, c3, 18);
  addTextField(form, page, 'children', M + c3 + 8,   y, c3, 18);
  addTextField(form, page, 'pets',     M + 2*(c3+8), y, c3, 18);
  y += 26;

  fieldLabel(page, f, 'Support needs / medical equipment in household', M, y);
  y += 9;
  addTextField(form, page, 'support_needs', M, y, CW, 28, true);
  y += 36;

  // Section 2
  y = sectionHeader(page, f, '2. In Case of Emergency (ICE) Contacts', y) + 6;
  drawText(page, f.regular, 'List people outside your household who can be contacted in an emergency. Save under "ICE" in your phone.', M, y + 7, 8, MUTED);
  y += 18;

  const c2 = (CW - 10) / 2;
  for (let i = 1; i <= 2; i++) {
    const cx = i === 1 ? M : M + c2 + 10;
    const p = `ice${i}_`;
    fillRect(page, cx, y, c2, 94, GREY);
    strokeRect(page, cx, y, c2, 94, BORDER);
    fillRect(page, cx, y, c2, 13, DARK);
    drawText(page, f.bold, `ICE CONTACT ${i}`, cx + 6, y + 3.5, 7.5, rgb(0.9,0.3,0.2));

    const fy = y + 15;
    fieldLabel(page, f, 'Name',         cx + 4, fy);      addTextField(form, page, p+'name',     cx+4, fy+8,  c2-8, 16);
    fieldLabel(page, f, 'Relationship', cx + 4, fy + 26); addTextField(form, page, p+'rel',      cx+4, fy+34, c2-8, 16);
    fieldLabel(page, f, 'Mobile',       cx + 4, fy + 52); addTextField(form, page, p+'mobile',   cx+4, fy+60, c2/2-6, 15);
    fieldLabel(page, f, 'Home / Work',  cx + c2/2+2, fy+52); addTextField(form, page, p+'home', cx+c2/2+2, fy+60, c2/2-6, 15);
  }
  y += 104;

  // Section 3
  y = sectionHeader(page, f, '3. If We Need to Leave Home', y) + 8;
  fieldLabel(page, f, 'Primary evacuation route', M, y);
  y += 9;
  addTextField(form, page, 'evac_primary', M, y, CW, 26, true);
  y += 34;

  fieldLabel(page, f, 'Alternative route if primary is blocked', M, y);
  y += 9;
  addTextField(form, page, 'evac_alt', M, y, CW, 26, true);
  y += 34;

  fieldLabel(page, f, 'Meeting point (outside home)',    M,         y);
  fieldLabel(page, f, 'Backup meeting point (further)',  M+c2+10,   y);
  y += 9;
  addTextField(form, page, 'meet1', M,       y, c2, 22, true);
  addTextField(form, page, 'meet2', M+c2+10, y, c2, 22, true);
  y += 30;

  fieldLabel(page, f, 'Where is our grab bag kept?',       M,       y);
  fieldLabel(page, f, 'Who has a key to our home?',        M+c2+10, y);
  y += 9;
  addTextField(form, page, 'grab_bag', M,       y, c2, 18);
  addTextField(form, page, 'key_holder', M+c2+10, y, c2, 18);
  y += 26;

  // Section 4
  y = sectionHeader(page, f, '4. Important Numbers', y) + 8;

  // Pre-filled boxes — 70pt tall
  const BOX_H = 70;
  function numBox(bx, topY, heading, big, lines, gpField) {
    fillRect(page, bx, topY, c3, BOX_H, GREY);
    strokeRect(page, bx, topY, c3, BOX_H, BORDER);
    fillRect(page, bx, topY, c3, 13, DARK);
    drawText(page, f.bold, heading, bx + 5, topY + 3.5, 7.5, rgb(0.9, 0.3, 0.2));
    if (big) drawText(page, f.bold, big, bx + 5, topY + 16, 15, RED);
    if (gpField) {
      // Health box: number then GP field
      drawText(page, f.regular, 'GHA urgent health advice', bx + 5, topY + 33, 7.5, BLACK);
      fieldLabel(page, f, 'Our GP:', bx + 5, topY + 43);
      addTextField(form, page, 'our_gp', bx + 5, topY + 52, c3 - 10, 14);
    } else {
      let ly = topY + 33;
      for (const l of lines) { drawText(page, f.regular, l, bx + 5, ly, 7.5, BLACK); ly += 12; }
    }
  }
  numBox(M,           y, 'EMERGENCY', '999', ['Police / Fire / Ambulance', 'RGP non-emergency: 200 72500'], false);
  numBox(M + c3 + 8,  y, 'HEALTH',    '111', [], true);
  numBox(M+2*(c3+8),  y, 'UTILITIES', '',   ['Electricity: 200 75957', 'Water faults: 200 73659'], false);
  y += BOX_H + 8;

  // Reminder
  fillRect(page, M, y, CW, 22, RED_BG);
  strokeRect(page, M, y, CW, 22, RED, 1);
  drawText(page, f.bold,    'In a major emergency, tune to GBC Radio: 91.3 FM  ·  1458 AM', M + 8, y + 5, 8, RED);
  drawText(page, f.regular, 'GBC broadcasts official emergency information when mobile networks are congested or down.', M + 8, y + 15, 7.5, BLACK);
  y += 30;

  // Footer
  hLine(page, y);
  y += 8;
  drawText(page, f.regular, 'Emergency Preparedness Gibraltar  ·  HM Government of Gibraltar', M, y + 7, 7.5, MUTED);
  fieldLabel(page, f, 'Review date:', W - M - 95, y);
  addTextField(form, page, 'review_date', W - M - 55, y + 8, 55, 14);

  return doc;
}

// -------------------------------------------------------
// DOCUMENT 2: Grab Bag Checklist
// -------------------------------------------------------
async function generateGrabBagChecklist(crestBytes) {
  const doc = await PDFDocument.create();
  const form = doc.getForm();
  const f = await loadFonts(doc);
  const page = doc.addPage([W, H]);
  const CW = W - 2 * M;
  let y = M;

  // Header
  const img = await doc.embedPng(crestBytes);
  const crestH = 50;
  const crestW = img.width * (crestH / img.height);
  page.drawImage(img, { x: M, y: H - y - crestH, width: crestW, height: crestH });
  drawText(page, f.bold,    'Grab Bag Checklist', M + crestW + 12, y + 5,  15, BLACK);
  drawText(page, f.regular, 'Emergency Preparedness Gibraltar  ·  HM Government of Gibraltar', M + crestW + 12, y + 24, 8, MUTED);
  y += crestH + 6;

  fillRect(page, M, y, CW, 2.5, RED);
  y += 10;

  fillRect(page, M,     y, 3,    24, RED);
  fillRect(page, M + 3, y, CW-3, 24, GREY);
  drawText(page, f.regular, 'Pack enough supplies for 72 hours (3 days). Keep near the front door in an accessible place.', M + 10, y + 8,  8, BLACK);
  drawText(page, f.regular, 'Check and refresh contents every six months.', M + 10, y + 19, 8, BLACK);
  y += 32;

  const colW = (CW - 16) / 2;
  const col1x = M;
  const col2x = M + colW + 16;
  let cbIdx = 0;

  function checkSection(title, items, cx, startY) {
    let sy = sectionHeader(page, f, title, startY, cx, colW) + 5;
    for (const item of items) {
      addCheckBox(form, page, `cb_${cbIdx++}`, cx + 2, sy + 1, 10, `${title} — ${item}`);
      drawText(page, f.regular, item, cx + 16, sy + 1, 8, BLACK);
      sy += 14;
    }
    return sy + 5;
  }

  let y1 = y;
  y1 = checkSection('Documents & Money',  ['Passport (or certified copy)', 'Gibraltar ID card', 'Cash (small notes and coins)', 'GHA medical card', 'Insurance documents', 'List of ICE contacts & numbers', 'House / car keys (spare set)'], col1x, y1);
  y1 = checkSection('Water & Food',       ['Water — 2 litres per person per day', 'Non-perishable food (tins, bars, dried)', 'Manual tin opener', 'Eating utensils / cup', 'Baby food / formula (if needed)', 'Pet food (if needed)'], col1x, y1);
  y1 = checkSection('First Aid',          ['Basic first aid kit', 'Prescription medications (3-day supply)', 'List of medications, dosages and GP', 'Glasses / contact lenses', 'Hearing aids and spare batteries', 'Hand sanitiser and face masks'], col1x, y1);

  let y2 = y;
  y2 = checkSection('Communication & Light', ['Battery or wind-up radio', 'Torch and spare batteries', 'Portable phone charger (power bank)', 'Mobile phone charging cable', 'Whistle (to signal for help)', 'Notepad and pen'], col2x, y2);
  y2 = checkSection('Clothing & Warmth',     ['Change of clothes per person', 'Sturdy, comfortable footwear', 'Warm layer or fleece', 'Waterproof jacket or poncho', 'Emergency foil blanket', 'Blanket or sleeping bag (if space allows)', 'Sunscreen and a hat (summer heat)'], col2x, y2);
  y2 = checkSection('Hygiene & Sanitation',  ['Toothbrush and toothpaste', 'Soap and small towel', 'Toilet paper', 'Sanitary products (if needed)', 'Nappies and wipes (if needed)', 'Bin bags (multiple uses)'], col2x, y2);

  y = Math.max(y1, y2) + 4;

  fillRect(page, M, y, CW, 26, RED_BG);
  strokeRect(page, M, y, CW, 26, RED, 1);
  drawText(page, f.bold,    'Gibraltar tip: a battery or wind-up radio receives GBC Radio (91.3 FM / 1458 AM)',                    M + 8, y + 6,  8, RED);
  drawText(page, f.regular, 'This works when mobile networks and power are down — it is the primary source of emergency updates.', M + 8, y + 17, 7.5, BLACK);
  y += 34;

  hLine(page, y);
  y += 8;
  drawText(page, f.regular, 'Emergency Preparedness Gibraltar  ·  HM Government of Gibraltar', M, y + 7, 7.5, MUTED);
  fieldLabel(page, f, 'Last checked:', W - M - 95, y);
  addTextField(form, page, 'last_checked', W - M - 55, y + 8, 55, 14);

  return doc;
}

// -------------------------------------------------------
// DOCUMENT 3: Emergency Contact Sheet
// -------------------------------------------------------
async function generateContactSheet(crestBytes) {
  const doc = await PDFDocument.create();
  const form = doc.getForm();
  const f = await loadFonts(doc);
  const page = doc.addPage([W, H]);
  const CW = W - 2 * M;
  let y = M;

  // Header
  const img = await doc.embedPng(crestBytes);
  const crestH = 52;
  const crestW = img.width * (crestH / img.height);
  page.drawImage(img, { x: M, y: H - y - crestH, width: crestW, height: crestH });
  drawText(page, f.bold,    'Emergency Contact Sheet', M + crestW + 12, y + 7,  16, BLACK);
  drawText(page, f.regular, 'Emergency Preparedness Gibraltar  ·  HM Government of Gibraltar', M + crestW + 12, y + 26, 8, MUTED);
  y += crestH + 6;

  fillRect(page, M, y, CW, 2.5, RED);
  y += 10;

  // 999 Hero
  fillRect(page, M, y, CW, 64, RED);
  drawTextCentered(page, f.bold, 'LIFE-THREATENING EMERGENCY', y + 7, 9, WHITE);
  const bigW = f.bold.widthOfTextAtSize('999', 44);
  page.drawText('999', { x: (W - bigW) / 2, y: H - y - 46, size: 44, font: f.bold, color: WHITE });
  drawTextCentered(page, f.regular, 'Police  ·  Fire  ·  Ambulance  ·  Available 24 hours', y + 51, 8.5, WHITE);
  y += 72;

  function contactTable(title, rows, startY) {
    let ty = sectionHeader(page, f, title, startY);
    for (let i = 0; i < rows.length; i++) {
      const bg = i % 2 === 0 ? WHITE : GREY;
      fillRect(page, M, ty, CW, 20, bg);
      strokeRect(page, M, ty, CW, 20, BORDER);
      drawText(page, f.regular, rows[i][0], M + 6, ty + 6, 9, BLACK);
      const nW = f.bold.widthOfTextAtSize(rows[i][1], 11);
      drawText(page, f.bold, rows[i][1], W - M - nW - 6, ty + 5.5, 11, RED);
      ty += 20;
    }
    return ty + 8;
  }

  y = contactTable('Emergency & Police', [
    ['Emergency services (Police, Fire, Ambulance)', '999'],
    ['Royal Gibraltar Police — non-emergency',       '200 72500'],
    ['Gibraltar Fire and Rescue Service',            '200 79507'],
  ], y);

  y = contactTable('Health & Support', [
    ['GHA — urgent health advice (non-emergency)',       '111'],
    ['Samaritans Gibraltar — emotional support (24hrs)', '116 123'],
    ['SNDO — Supported Needs & Disability Office',       '200 42196'],
  ], y);

  y = contactTable('Utilities', [
    ['Gibraltar Electricity Authority — power cuts, 24 hours', '200 75957'],
    ['GEA direct fault line — out of office hours',             '58466000'],
    ['AquaGib — water faults, 24 hours',                        '200 73659'],
  ], y);

  fillRect(page, M, y, CW, 24, RED_BG);
  strokeRect(page, M, y, CW, 24, RED, 1);
  drawText(page, f.bold,    'In a major emergency, tune to GBC Radio: 91.3 FM  ·  1458 AM',                          M + 8, y + 6,  8.5, RED);
  drawText(page, f.regular, 'GBC broadcasts official emergency information. Keep a battery-powered or wind-up radio at home.', M + 8, y + 17, 7.5, BLACK);
  y += 32;

  // My contacts
  y = sectionHeader(page, f, 'My Personal Contacts', y) + 8;
  const c2 = (CW - 10) / 2;

  fieldLabel(page, f, 'ICE Contact 1 — Name',   M,       y);
  fieldLabel(page, f, 'ICE Contact 1 — Number', M+c2+10, y);
  y += 9;
  addTextField(form, page, 'ice1_name',   M,       y, c2, 18);
  addTextField(form, page, 'ice1_number', M+c2+10, y, c2, 18);
  y += 26;

  fieldLabel(page, f, 'ICE Contact 2 — Name',   M,       y);
  fieldLabel(page, f, 'ICE Contact 2 — Number', M+c2+10, y);
  y += 9;
  addTextField(form, page, 'ice2_name',   M,       y, c2, 18);
  addTextField(form, page, 'ice2_number', M+c2+10, y, c2, 18);
  y += 26;

  fieldLabel(page, f, 'My GP / Health Centre',   M,       y);
  fieldLabel(page, f, 'GP / Health Centre No.',  M+c2+10, y);
  y += 9;
  addTextField(form, page, 'gp_name',   M,       y, c2, 18);
  addTextField(form, page, 'gp_number', M+c2+10, y, c2, 18);
  y += 26;

  hLine(page, y);
  y += 8;
  drawText(page, f.regular, 'Emergency Preparedness Gibraltar  ·  HM Government of Gibraltar',    M,           y + 7, 7.5, MUTED);
  drawText(page, f.regular, 'Print and keep on your fridge or in your grab bag', W - M - 195, y + 7, 7.5, MUTED);

  return doc;
}

// -------------------------------------------------------
// DOCUMENT 4: Vulnerable Persons Guide
// -------------------------------------------------------
async function generateVulnerableGuide(crestBytes) {
  const doc = await PDFDocument.create();
  const f = await loadFonts(doc);
  const page = doc.addPage([W, H]);
  const CW = W - 2 * M;
  let y = M;

  // Header
  const img = await doc.embedPng(crestBytes);
  const crestH = 50;
  const crestW = img.width * (crestH / img.height);
  page.drawImage(img, { x: M, y: H - y - crestH, width: crestW, height: crestH });
  drawText(page, f.bold,    'Vulnerable Persons Guide', M + crestW + 12, y + 5,  15, BLACK);
  drawText(page, f.regular, 'Emergency Preparedness Gibraltar  ·  HM Government of Gibraltar', M + crestW + 12, y + 24, 8, MUTED);
  y += crestH + 6;

  fillRect(page, M, y, CW, 2.5, RED);
  y += 10;

  fillRect(page, M,     y, 3,    26, RED);
  fillRect(page, M + 3, y, CW-3, 26, GREY);
  drawText(page, f.regular, 'For vulnerable individuals, families, carers and neighbours. Planning ahead reduces risk.', M + 10, y + 8,  8, BLACK);
  drawText(page, f.bold,    'In a life-threatening emergency, call 999 immediately.', M + 10, y + 19, 8, RED);
  y += 34;

  const colW = (CW - 16) / 2;
  const col1x = M;
  const col2x = M + colW + 16;

  // Word-wrap a bullet to the column width. Every word is drawn: an earlier
  // version stopped after two lines and silently dropped the rest.
  function wrapLines(text, size, maxW) {
    const lines = [];
    let line = '';
    for (const word of text.split(' ')) {
      const test = line ? `${line} ${word}` : word;
      if (f.regular.widthOfTextAtSize(test, size) > maxW && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function infoSection(title, items, cx, startY) {
    let sy = sectionHeader(page, f, title, startY, cx, colW) + 5;
    for (const item of items) {
      drawText(page, f.bold, '\u203A', cx + 3, sy + 1, 8, RED);
      const lines = wrapLines(item, 8, colW - 20);
      lines.forEach((line, i) => drawText(page, f.regular, line, cx + 14, sy + 1 + i * 11, 8, BLACK));
      sy += 2 + 11 * lines.length;
    }
    return sy + 4;
  }

  let y1 = y;
  y1 = infoSection('Persons with Disabilities', [
    'Include disability-specific needs in your emergency plan.',
    'Identify accessible evacuation routes; ask your building manager about a PEEP.',
    'Register your needs with the services listed at the foot of this page.',
    'Keep mobility aids and medical devices accessible at all times.',
    'Let trusted neighbours know about your needs.',
  ], col1x, y1);

  y1 = infoSection('Elderly Residents', [
    'Have at least two contacts outside your household who can check on you.',
    'If you live alone, consider sharing a key with a trusted neighbour.',
    'Keep a list of medications accessible for emergency responders.',
    'Prepare a grab bag: medications, warm clothing, important documents.',
    'Neighbours: check on elderly residents during heatwaves and storms.',
  ], col1x, y1);

  y1 = infoSection('Children', [
    'Teach children their full name, address and a parent\'s phone number.',
    'Practise the household fire escape plan with children regularly.',
    'Agree on a meeting point children can go to if they cannot reach home.',
    'Include children\'s needs in your grab bag.',
  ], col1x, y1);

  let y2 = y;
  y2 = infoSection('Carers', [
    'Plan what happens if you are unavailable during an emergency.',
    'Identify a backup carer who can step in at short notice.',
    'Keep a written record of care needs, medications and contacts.',
    'Involve the person you care for in making the emergency plan.',
  ], col2x, y2);

  y2 = infoSection('Power Cuts & Medical Equipment', [
    'If you rely on powered medical equipment, a power cut can be a medical emergency.',
    'Register with the Electricity Authority (GEA) for priority reconnection.',
    'Report a cut: 200 75957, 24 hours. Direct line 58466000 out of hours.',
    'Speak to your GP about backup options during power cuts.',
    'Keep devices charged; consider a battery backup (UPS).',
  ], col2x, y2);

  y2 = infoSection('Non-English Speakers', [
    'GBC Radio (91.3 FM / 1458 AM) broadcasts official emergency information.',
    'HM Government may issue updates in Spanish during major incidents.',
    'Ask neighbours or community organisations for translation help.',
  ], col2x, y2);

  y = Math.max(y1, y2) + 4;

  // Priority services
  y = sectionHeader(page, f, 'Priority Services — Register Now', y) + 0;
  const services = [
    ['SNDO — help arranging your safety in an emergency',          '200 42196'],
    ['Electricity Authority — priority reconnection (medical equipment)', '200 75957'],
    ['AquaGib — register specific water supply needs',                   '200 41288'],
    ['GHA — discuss your emergency needs with your GP',            '111'],
  ];
  for (let i = 0; i < services.length; i++) {
    fillRect(page, M, y, CW, 18, i % 2 === 0 ? WHITE : GREY);
    strokeRect(page, M, y, CW, 18, BORDER);
    drawText(page, f.regular, services[i][0], M + 6, y + 5, 8.5, BLACK);
    const nW = f.bold.widthOfTextAtSize(services[i][1], 10);
    drawText(page, f.bold, services[i][1], W - M - nW - 6, y + 5, 10, RED);
    y += 18;
  }
  y += 8;

  hLine(page, y);
  y += 8;
  drawText(page, f.regular, 'Emergency Preparedness Gibraltar  ·  HM Government of Gibraltar', M, y + 7, 7.5, MUTED);
  drawText(page, f.regular, 'Full guidance: prepare.gov.gi/persons-with-disabilities', W - M - 210, y + 7, 7.5, MUTED);

  return doc;
}

// -------------------------------------------------------
// MAIN
// -------------------------------------------------------
async function main() {
  const crestBytes = fs.readFileSync(path.join(__dirname, 'src/assets/images/HMGoG_Crest_black.png'));
  const outDir = path.join(__dirname, 'src/assets/downloads');

  const tasks = [
    { fn: generateHouseholdPlan,     name: 'household-emergency-plan',  title: 'Household Emergency Plan' },
    { fn: generateGrabBagChecklist,  name: 'grab-bag-checklist',        title: 'Grab Bag Checklist' },
    { fn: generateContactSheet,      name: 'emergency-contact-sheet',   title: 'Emergency Contact Sheet' },
    { fn: generateVulnerableGuide,   name: 'vulnerable-persons-guide',  title: 'Vulnerable Persons Guide' },
  ];

  for (const { fn, name, title } of tasks) {
    try {
      const doc = await fn(crestBytes);
      doc.setTitle(`${title} — Emergency Preparedness Gibraltar`, { showInWindowTitleBar: true });
      doc.setLanguage('en-GB');
      const bytes = await doc.save();
      fs.writeFileSync(path.join(outDir, `${name}.pdf`), bytes);
      console.log(`✓  ${name}.pdf`);
    } catch (err) {
      console.error(`✗  ${name}: ${err.message}`);
    }
  }

  console.log('\nDone. PDFs saved to src/assets/downloads/');
}

main().catch(console.error);
