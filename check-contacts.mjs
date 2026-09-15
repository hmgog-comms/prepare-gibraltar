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
 * ---------------------------------------------------------------------------
 *
 * Run: node check-contacts.mjs
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('.', import.meta.url).pathname;
const SRC = join(ROOT, 'src');
const contacts = JSON.parse(readFileSync(join(SRC, '_data', 'contacts.json'), 'utf8'));

/**
 * Every number format the site publishes. The earlier check saw only Gibraltar
 * landlines, which was 12 of the 21 numbers actually on the site — the Gibraltar
 * mobiles, the UK freephone hotline and the FCDO line were all invisible to it.
 */
const PATTERNS = [
  { label: 'Gibraltar landline', re: /\b200\s?\d{5}\b/g },
  { label: 'Gibraltar mobile', re: /\b5\d{7}\b/g },
  { label: 'UK freephone', re: /\b0800\s?\d{3}\s?\d{3}\b/g },
  { label: 'International', re: /\+44\s?\d{2,4}\s?\d{3,4}\s?\d{3,4}\b/g },
];

/** National short codes. They will not change and there is nothing to source. */
const SHORTCODES = new Set(['999', '111', '112', '116123']);

const normalise = (n) => n.replace(/[\s ]+/g, '');

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

  // ---- Live on the site, no confirmed source. Someone must ring these. ----
  ['56003195', {
    service: 'Supported Needs & Disability Office (SNDO) — WhatsApp',
    unverified: "TWO HMGoG SOURCES DISAGREE. The SNDO's own site (disability.gov.gi/contact) publishes 56003195, which is what this site carries. HMGoG press release 810/2025 and the Chronicle both publish 56003196. One digit apart, and a WhatsApp message to the wrong number gives no wrong-number signal — a stranger simply receives a disability support request. Ask SNDO directly which line is live. Note also that the number is written twice in each place — once as visible text, once inside the wa.me/350... link — so the two can drift apart the way the tel: links used to.",
    raised: '2026-09-15',
  }],
  ['20072639', {
    service: 'Gibraltar Ornithological & Natural History Society (GONHS)',
    unverified: "GONHS's own contact page (gonhs.org/contact-us) publishes no telephone number at all — only an email address and a postal address. No other source found.",
    raised: '2026-09-15',
  }],
  ['20074636', {
    service: 'Gibraltar Regulatory Authority (business data breaches)',
    unverified: 'A search result quotes gra.gi giving this number, but gra.gi could not be opened to confirm it first-hand. Needs checking against the GRA site or by ringing.',
    raised: '2026-09-15',
  }],
  ['0800789321', {
    service: 'Anti-Terrorist Hotline (UK freephone)',
    unverified: 'A UK freephone number that has never been dialled from a Gibraltar line. UK 0800 ranges do not reliably connect from outside the UK. Either confirm it dials from Gibraltar or replace it.',
    raised: '2026-09-14',
  }],
]);

/** Every row in the contact register, flattened. */
const REGISTER = contacts.groups.flatMap((group) => group.rows);

/** number -> provenance record, from the register and the page-local list. */
const RECORDS = new Map(PAGE_LOCAL);
for (const row of REGISTER) {
  if (!row.number) continue;
  const key = normalise(row.number);
  if (SHORTCODES.has(key)) continue;
  RECORDS.set(key, {
    service: row.service,
    verified: row.verified,
    source: row.source,
    unverified: row.source
      ? undefined
      : 'No source recorded against this row in the contact register. Whoever added or changed it should say where they checked it.',
    from: 'contacts.json',
  });
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(njk|md|html|json)$/.test(name) ? [full] : [];
  });
}

const files = walk(SRC).map((f) => ({ path: f, text: readFileSync(f, 'utf8') }));

/** number -> Set of files it appears in. */
const published = new Map();
for (const { path, text } of files) {
  for (const { re } of PATTERNS) {
    for (const match of text.match(re) || []) {
      const key = normalise(match);
      if (SHORTCODES.has(key)) continue;
      if (!published.has(key)) published.set(key, new Set());
      published.get(key).add(relative(ROOT, path));
    }
  }
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
  n.startsWith('200') ? n.replace(/^(200)(\d+)$/, '$1 $2')
  : n.startsWith('0800') ? n.replace(/^(0800)(\d{3})(\d{3})$/, '$1 $2 $3')
  : n;

if (orphans.length) {
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
  process.exit(1);
}

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
