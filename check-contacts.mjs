#!/usr/bin/env node
/**
 * Guards against stale emergency contact numbers.
 *
 * The CMS presents "Emergency Contacts" (src/_data/site.json) as if it controls
 * the site's phone numbers. It does not: most pages hard-code them. An editor can
 * change a number in the CMS, watch two pages update, and reasonably conclude the
 * job is done while stale copies remain elsewhere.
 *
 * On a site whose purpose is telling people who to call, a wrong number is the
 * worst defect available. This check makes that state impossible to ship: if a
 * number in site.json no longer appears in the content that used to carry it, the
 * build fails and names the files to fix.
 *
 * Run: node check-contacts.mjs
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('.', import.meta.url).pathname;
const SRC = join(ROOT, 'src');
const site = JSON.parse(readFileSync(join(SRC, '_data', 'site.json'), 'utf8'));

// Numbers that are national short codes and will never change; tracking them
// produces noise, not safety.
const IGNORE = new Set(['999', '111', '112']);

/**
 * Departmental numbers that legitimately live in page content rather than the CMS.
 *
 * This list is what gives the check its teeth. Anything not in site.json and not
 * here is treated as unrecognised — so when a number in site.json is changed, the
 * superseded copies stop matching anything and the build fails, naming them.
 *
 * Adding a number here is a deliberate act: it says "this is correct, and the CMS
 * is not expected to manage it".
 */
const PAGE_LOCAL = new Map([
  ['20042196', 'Supported Needs & Disability Office (SNDO)'],
  ['20047770', 'Gibraltar Environment Agency'],
  ['20079700', "St Bernard's Hospital"],
  ['20059271', 'Gibraltar Veterinary Services'],
  ['20074636', 'Gibraltar Regulatory Authority (business data breaches)'],
  ['20042292', 'Gibraltar Meteorological Office'],
  ['20046254', 'Gibraltar Port Authority'],
  ['20072639', 'Gibraltar Ornithological & Natural History Society (GONHS)'],
]);

// The contact fields the CMS exposes, and a human label for the report.
const FIELDS = {
  contactRGP: 'Royal Gibraltar Police',
  contactGFS: 'Gibraltar Fire and Rescue Service',
  contactGibelec: 'Gibelec',
  contactAquagib: 'AquaGib',
  contactGHA: 'Gibraltar Health Authority',
};

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(njk|md|html)$/.test(name) ? [full] : [];
  });
}

const files = walk(SRC).map((f) => ({ path: f, text: readFileSync(f, 'utf8') }));

/** Gibraltar landlines: 200 xxxxx, with or without the space. */
const PHONE = /\b200\s?\d{5}\b/g;

const normalise = (n) => n.replace(/\s+/g, '');

// Every 200-number the CMS knows about.
const known = new Set(
  Object.keys(FIELDS)
    .map((k) => site[k])
    .filter((v) => v && !IGNORE.has(v))
    .map(normalise)
);

const problems = [];

for (const { path, text } of files) {
  const found = new Set([...(text.match(PHONE) || [])].map(normalise));
  for (const num of found) {
    if (!known.has(num) && !PAGE_LOCAL.has(num)) {
      problems.push({
        file: relative(ROOT, path),
        number: num.replace(/^(200)(\d+)$/, '$1 $2'),
      });
    }
  }
}

if (problems.length === 0) {
  console.log(
    `✓ Contact numbers consistent: ${known.size} managed by the CMS, ` +
      `${PAGE_LOCAL.size} page-local and allowlisted.`
  );
  process.exit(0);
}

console.error('✗ Phone numbers found in content that are not in src/_data/site.json.\n');
console.error('  Most likely a number was changed in the CMS and these copies were missed.');
console.error('  If the number below is correct and simply not CMS-managed, add it to the');
console.error('  PAGE_LOCAL list in this file with the service it belongs to.\n');

const byNumber = new Map();
for (const p of problems) {
  if (!byNumber.has(p.number)) byNumber.set(p.number, []);
  byNumber.get(p.number).push(p.file);
}
for (const [number, fileList] of byNumber) {
  console.error(`  ${number}`);
  for (const f of [...new Set(fileList)].sort()) console.error(`      ${f}`);
}
console.error('');
process.exit(1);
