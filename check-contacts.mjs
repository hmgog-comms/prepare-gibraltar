#!/usr/bin/env node
/**
 * Every phone number published on this site must have a recorded source.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS STRICTER THAN IT LOOKS
 *
 * The earlier version of this check asked one question: "is this number known?"
 * It caught a number that had DRIFTED between copies, and nothing else. In
 * September 2026 that turned out to be most of the way to useless:
 *
 *   - 200 59271, published as "Gibraltar Veterinary Services", was the fax
 *     number of the Office of the Deputy Chief Minister.
 *   - 200 42292, published as the Meteorological Office, appeared in no source
 *     anywhere. The only search result for it was this repository.
 *   - 200 41288, AquaGib's customer services line, was published as the water
 *     EMERGENCY contact in four printed documents. That number is real and is
 *     in the register — it was simply the wrong one for the purpose.
 *
 * Every one of those passed. They were internally consistent and wrong, and the
 * allowlist actively laundered them, because an entry recorded what a number was
 * CALLED and never who said it was right.
 *
 * So the check now asks two questions: is it known, and who says it is right?
 * A number with no record fails the build. A number whose record has no source
 * is reported on every build as unverified, and a monthly workflow opens an
 * issue naming it.
 *
 * THE RULE: if you cannot find a published source for a number, do not guess and
 * do not swap in a plausible alternative. Mark it unverified and ask Daniel to
 * ring it. A wrong number is the worst defect this site can ship.
 *
 * WHAT CHANGED ON 16 SEPT 2026
 *
 * A code review found the check matched one exact spelling of each number and
 * never looked inside a tel: href. An E.164 href, a hyphen, a 4-4 grouping, a
 * 00350 prefix or a YAML line fold made a number invisible rather than failing
 * the build, and a tel: link that dialled a different number from its label was
 * never compared. Extraction and classification now live in contact-scan.mjs
 * (tested by contact-scan.test.mjs): any digit run is a candidate, normalised
 * to one key and only then classified; every tel: and wa.me link is compared
 * with its label in HTML and markdown form; anything with a leading + or inside
 * a href that does not classify fails as unrecognised. The same review found
 * that nothing tied the committed download PDFs to the twins this check reads,
 * so download-checksums.mjs now verifies both against the sidecar the generator
 * writes.
 * ---------------------------------------------------------------------------
 *
 * Run: node check-contacts.mjs          (also runs first inside npm run build)
 *      node check-contacts.mjs --json   structured output for the monthly workflow
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extract, mergeRecords } from './contact-scan.mjs';
import { verifyChecksums } from './download-checksums.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, 'src');
const DOWNLOADS = join(SRC, 'assets', 'downloads');
const contacts = JSON.parse(readFileSync(join(SRC, '_data', 'contacts.json'), 'utf8'));

/**
 * Numbers that legitimately live in page content rather than in the register.
 *
 * Each entry records WHO SAYS THE NUMBER IS RIGHT. An entry with `unverified`
 * instead of `source` is live on the site with no confirmed source and needs a
 * human to ring it — the build still passes, because a pending check must never
 * stop an emergency site from being updated, but it is reported every time.
 */
const PAGE_LOCAL = new Map([
  ['20079700', {
    service: "St Bernard's Hospital — all departments and help desk",
    verified: '2026-09-15',
    source: 'gibraltar.gov.gi/contacts/gha-gibraltar-health-authority-27, listed as "All Departments and Help Desk"',
  }],
  ['20046254', {
    service: 'Gibraltar Port Authority — VTS Operations',
    verified: '2026-09-15',
    source: 'gibraltarport.com/contact-us, listed as "VTS Operations" and available 24 hours',
  }],
  ['20070620', {
    service: 'Environmental Agency Gibraltar — office hours',
    verified: '2026-09-15',
    source: 'environmental-agency.gi/contact-us, the gibraltar.gov.gi contacts listing, and HMGoG press release 561/2019 — three sources agreeing',
  }],
  ['58297000', {
    service: 'Environmental Agency Gibraltar — duty officer, out of hours',
    verified: '2026-09-15',
    source: 'environmental-agency.gi/contact-us, as "After Hours Emergency (Duty On-Call EHO)"; also HMGoG press release 561/2019',
  }],
  ['20043352', {
    service: 'Animal Welfare Clinic (09:00-17:00)',
    verified: '2026-09-15',
    source: 'HMGoG press release 561/2019 "Environmental Contact Numbers", and the GibYellow listing',
  }],

  // The GEA fault lines sit inside an "extra" string on the electricity row
  // rather than in its "number" field, so they need a record of their own.
  ['58465000', {
    service: 'Gibraltar Electricity Authority — direct fault line, office hours',
    verified: '2026-09-14',
    source: 'the GEA website (gea.gi), read by Daniel on 14 Sept 2026: "Fault Reports 24/7 — Office Hours 58465000"',
  }],
  ['58466000', {
    service: 'Gibraltar Electricity Authority — direct fault line, out of hours',
    verified: '2026-09-14',
    source: 'the GEA website (gea.gi), read by Daniel on 14 Sept 2026: "Fault Reports 24/7 — Out of Office Hours 58466000"',
  }],

  // Confirmed by Daniel, 15 Sept 2026. Other published sources give 56003196;
  // they are wrong. Do NOT "correct" this to ...96 on the strength of finding one.
  //
  // The number is still written twice in each place — once as visible text, once
  // inside the wa.me/350... link — so the two can drift apart the way the tel:
  // links used to. Worth deriving the link from the number the same way.
  ['56003195', {
    service: 'Supported Needs & Disability Office (SNDO) — WhatsApp',
    verified: '2026-09-15',
    source: 'confirmed by Daniel, 15 Sept 2026',
  }],
  ['20074636', {
    service: 'Gibraltar Regulatory Authority (business data breaches)',
    verified: '2026-09-15',
    source: 'confirmed by Daniel, 15 Sept 2026. gra.gi could not be opened from here to check it first-hand',
  }],
  // fsc.gi blocks automated fetching, so this cannot be re-checked from here. It
  // is the number on the GFSC fraud page that cyber-incidents.md already links.
  ['22259050', {
    service: 'Gibraltar Financial Services Commission — Enforcement and Perimeter Surveillance team (report a financial scam)',
    verified: '2026-09-16',
    source: 'fsc.gi/consumer-guides/fraud, read by Daniel on 16 Sept 2026: "report it to the GFSC Enforcement and Perimeter Surveillance team on +350 222 59050"',
  }],

  // Removed from the site on 15 Sept 2026 rather than verified, and deliberately
  // not listed above — an allowlist entry for a number nobody publishes is just
  // an invitation to put it back:
  //
  //   0800 789 321, the UK Anti-Terrorist Hotline, was on terrorism.md. In
  //   Gibraltar the number is 999, and a UK freephone that may not even connect
  //   from here is worse than no extra number at all.
  //
  //   200 72639, GONHS, was on wildfires.md. Not an emergency contact, and their
  //   own contact page publishes no telephone number anyway.
]);

/** Every row in the contact register, flattened. */
const REGISTER = contacts.groups.flatMap((group) => group.rows);

/**
 * number -> provenance record. The stricter record wins where a number is in
 * both places, so a register row cannot launder a page-local doubt.
 */
const RECORDS = mergeRecords(PAGE_LOCAL, REGISTER);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(njk|md|html|json)$/.test(name) ? [full] : [];
  });
}

/**
 * The register's own "source" and "verified" fields are notes about numbers,
 * not publications of them, so they are dropped before the register is
 * scanned — a note such as "other sources give 56003196" must not count as
 * publishing 56003196.
 */
const contentOf = (path) => {
  const text = readFileSync(path, 'utf8');
  if (path !== join(SRC, '_data', 'contacts.json')) return text;
  const copy = JSON.parse(text);
  for (const group of copy.groups) for (const row of group.rows) { delete row.source; delete row.verified; }
  return JSON.stringify(copy);
};

// The four download PDFs are binary and cannot be scanned, but they are
// generated from the .html twins beside them, which are under src/ and are
// scanned like any other page. So a number in a PDF is checked at its source —
// and the checksum sidecar below proves the PDF still matches that source.
const files = walk(SRC).map((f) => ({ path: relative(ROOT, f), text: contentOf(f) }));

/** number -> Set of files it appears in. */
const published = new Map();
const mismatches = [];
const unrecognised = [];
for (const { path, text } of files) {
  const found = extract(text);
  for (const key of found.published) {
    if (!published.has(key)) published.set(key, new Set());
    published.get(key).add(path);
  }
  for (const m of found.mismatches) mismatches.push({ file: path, ...m });
  for (const u of found.unrecognised) unrecognised.push({ file: path, ...u });
}

const twins = readdirSync(DOWNLOADS).filter((f) => f.endsWith('.html')).map((f) => basename(f, '.html')).sort();
const checksumProblems = verifyChecksums(DOWNLOADS, twins);

let failed = false;

if (mismatches.length) {
  failed = true;
  console.error('\n✗ A link dials or messages a different number from the one printed beside it:\n');
  for (const { file, kind, href, label } of mismatches) {
    console.error(`   ${file}`);
    console.error(`      shows ${label} but ${kind === 'tel' ? 'dials' : 'messages'} ${href}`);
  }
  console.error(
    '\n  Someone changed one and not the other. A message or call to a wrong\n' +
    '  number gives the sender no wrong-number signal. Fix both, or derive the\n' +
    '  link from the number the way layouts/contacts.njk does.\n'
  );
}

if (unrecognised.length) {
  failed = true;
  console.error('\n✗ These look like telephone numbers but are not in any format this site publishes:\n');
  for (const { file, kind, raw, label } of unrecognised) {
    console.error(`   ${file}`);
    console.error(`      ${raw}${label ? `  (shown as "${label}")` : ''}  [${kind}]`);
  }
  console.error(
    '\n  Usually a missing or extra digit. Gibraltar numbers are eight digits; UK\n' +
    '  freephone is 0800/0808; anything else needs a full + country code. If it\n' +
    '  is not a phone number at all, rewrite it so it does not start with +.\n'
  );
}

if (checksumProblems.length) {
  failed = true;
  console.error('\n✗ The download PDFs do not match the HTML twins they were generated from:\n');
  for (const problem of checksumProblems) console.error(`   ${problem}`);
  console.error(
    '\n  The Downloads page offers the PDF, and this check reads the twin. If the\n' +
    '  twin changed, the PDF is stale: run node generate-pdfs.mjs and commit the\n' +
    '  PDFs together with src/assets/downloads/checksums.sha256.\n'
  );
}

const orphans = [];
const unverified = [];
for (const [number, where] of [...published].sort()) {
  const record = RECORDS.get(number);
  if (!record) {
    orphans.push({ number, where: [...where].sort() });
  } else if (!record.source) {
    unverified.push({ number, record, where: [...where].sort() });
  }
}

const pretty = (n) =>
  /^2\d{7}$/.test(n) ? n.replace(/^(\d{3})(\d{5})$/, '$1 $2')
  : /^0(?:800|808)\d{6,7}$/.test(n) ? n.replace(/^(0\d{3})(\d{3})(\d{3,4})$/, '$1 $2 $3')
  : n;

if (orphans.length) {
  failed = true;
  console.error('\n✗ No source is recorded for these numbers, and they are published:\n');
  for (const { number, where } of orphans) {
    console.error(`   ${pretty(number)}`);
    for (const f of where) console.error(`      ${f}`);
  }
  console.error(
    '\n  Every published number needs a record saying who confirmed it.\n' +
    '  Add it to src/_data/contacts.json (with "verified" and "source"), or to\n' +
    '  PAGE_LOCAL in check-contacts.mjs.\n\n' +
    '  If you cannot find a published source, DO NOT GUESS and do not substitute a\n' +
    '  plausible-looking alternative. Record it as unverified with the reason, and\n' +
    '  ask Daniel to ring it.\n'
  );
  failed = true;
}

if (failed) process.exit(1);

// --json is for the monthly workflow, so it reports on structured data rather
// than by scraping the prose above.
if (process.argv.includes('--json')) {
  console.log(JSON.stringify({
    published: published.size,
    verified: published.size - unverified.length,
    unverified: unverified.map(({ number, record, where }) => ({
      number: pretty(number),
      service: record.service,
      reason: record.unverified,
      raised: record.raised || null,
      files: where,
    })),
  }, null, 2));
  process.exit(0);
}

const verifiedCount = published.size - unverified.length;
console.log(
  `✓ Contact numbers: ${published.size} published, ${verifiedCount} with a recorded source, ` +
    `${unverified.length} unverified.`
);

if (unverified.length) {
  console.log('\n⚠  UNVERIFIED — live on the site with no confirmed source:\n');
  for (const { number, record, where } of unverified) {
    console.log(`   ${pretty(number)}  ${record.service}`);
    console.log(`      ${record.unverified}`);
    console.log(`      raised ${record.raised || 'unknown'} · ${where.join(', ')}`);
    console.log('');
  }
  console.log(
    '   These need a human on a telephone. Do not replace one with a guess —\n' +
    '   swapping an unverified number for another unverified number is not a fix.\n' +
    '   See NOTES-INTERNAL.md. A monthly workflow raises an issue listing these.\n'
  );
}
