/**
 * contact-scan.mjs — finds every telephone number a piece of content publishes.
 *
 * Used by check-contacts.mjs. Kept separate so it can be tested
 * (contact-scan.test.mjs) without walking the tree.
 *
 * The approach is: extract loosely, classify strictly. Until 16 Sept 2026 the
 * check matched one exact spelling of each number format, so an E.164 tel:
 * href, a hyphen, a 4-4 grouping, a 00350 prefix or a YAML line fold all made
 * a number invisible to it rather than failing the build. Now any digit run is
 * a candidate; it is normalised to one canonical key and only then classified.
 * Anything that classifies must have a provenance record. Anything written with
 * a leading + that does not classify, or that sits inside a tel:/wa.me href,
 * fails as unrecognised — a digit-count typo should fail, not vanish.
 *
 * Every tel: and wa.me link is also compared with the label beside it, in HTML
 * and markdown form, because a link that dials a different number from the one
 * it shows is the one defect a reader cannot catch.
 */

/** National short codes. They will not change and there is nothing to source. */
export const SHORTCODES = new Set(['999', '111', '112', '116123']);

/**
 * One canonical key per number. Gibraltar numbers are bare 8 digits (the +350
 * is dropped however it was written); UK freephone keeps its leading 0; other
 * international numbers keep a leading + so +44… and +34… never collide.
 */
export function normalise(raw) {
  let s = String(raw)
    .replace(/\(0\)/g, '')                 // UK trunk prefix written (0)
    .replace(/[\s ()\-]+/g, '');      // spaces, NBSP, brackets, hyphens
  if (s.startsWith('00')) s = `+${s.slice(2)}`;
  if (s.startsWith('+350')) s = s.slice(4);
  else if (/^350\d{8}$/.test(s)) s = s.slice(3);   // wa.me/350… and bare 350…
  return s;
}

/** Which kind of number a canonical key is, or null if it is not one we publish. */
export function classify(key) {
  if (/^2(?:00|16|22|25)\d{5}$/.test(key)) return 'Gibraltar landline';
  if (/^5\d{7}$/.test(key)) return 'Gibraltar mobile';
  if (/^0(?:800|808)\d{6,7}$/.test(key)) return 'UK freephone';
  if (/^\+\d{7,15}$/.test(key)) return 'International';
  return null;
}

// A digit run: optional + or 00, then digits joined by spaces, NBSP or brackets,
// with a hyphen allowed only directly between two digits (so a spaced dash
// between two list items does not glue them together). Not preceded or
// followed by a word character, and not adjoining a dot that has a digit on
// its other side — that keeps hex colours, base64, SVG path data, decimals and
// timestamps out while still matching a number that ends a sentence.
const CANDIDATE = /(?<!\w|\d\.)(?:\+|00)?\d(?:[\d  ()]|(?<=\d)-(?=\d))*\d(?!\w|\.\d)|(?<!\w|\d\.)(?:\+|00)?\d(?!\w|\.\d)/g;

const HTML_LINK = /<a\s[^>]*?href="(tel:|https?:\/\/wa\.me\/)([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
const MD_LINK = /\[([^\]]*)\]\((tel:|https?:\/\/wa\.me\/)([^)\s]*)\)/g;

const collapse = (s) => s.replace(/[\s ]+/g, ' ');
const isTemplate = (s) => /\{\{|\{%/.test(s);

/**
 * Every classifying key in a run of text. A run that does not classify as a
 * whole is tried in contiguous windows of its space-separated groups, longest
 * first, so "in 2026 call 200 72500" still yields 20072500 and two numbers with
 * only a space between them are both found.
 */
function keysIn(raw) {
  const whole = normalise(raw);
  if (classify(whole) || SHORTCODES.has(whole)) return [whole];
  const groups = raw.trim().split(/[  ]+/);
  const found = [];
  const used = new Array(groups.length).fill(false);
  for (let len = groups.length - 1; len >= 1; len--) {
    for (let i = 0; i + len <= groups.length; i++) {
      if (used.slice(i, i + len).some(Boolean)) continue;
      const key = normalise(groups.slice(i, i + len).join(' '));
      if (classify(key) || SHORTCODES.has(key)) {
        found.push(key);
        used.fill(true, i, i + len);
      }
    }
  }
  return found;
}

/**
 * Scan one piece of content.
 * Returns { published: Set<key>, mismatches: [{kind, label, href}],
 *           unrecognised: [{kind, raw, label?}] }.
 */
export function extract(text) {
  const published = new Set();
  const mismatches = [];
  const unrecognised = [];
  const unrecognisedSeen = new Set();
  const flag = (kind, raw, label) => {
    // One report per number, however many forms it was seen in.
    const id = normalise(raw.replace(/^(tel:|https?:\/\/wa\.me\/)/, ''));
    if (unrecognisedSeen.has(id)) return;
    unrecognisedSeen.add(id);
    unrecognised.push(label === undefined ? { kind, raw } : { kind, raw, label });
  };
  const publish = (key) => {
    if (!SHORTCODES.has(key)) published.add(key);
  };

  const flat = collapse(text);

  // 1. Links: what a tel: or wa.me href actually dials, compared with its label.
  const links = [];
  for (const [, scheme, href, label] of flat.matchAll(HTML_LINK)) links.push({ scheme, href, label });
  for (const [, label, scheme, href] of flat.matchAll(MD_LINK)) links.push({ scheme, href, label });
  for (const { scheme, href, label } of links) {
    if (isTemplate(href) || isTemplate(label)) continue;
    const kind = scheme === 'tel:' ? 'tel' : 'whatsapp';
    const number = href.split(/[?#]/)[0];
    const hrefKey = normalise(kind === 'whatsapp' ? `+${number}` : number);
    if (SHORTCODES.has(hrefKey)) continue;
    if (!classify(hrefKey)) {
      flag(kind, `${scheme}${href}`, collapse(label.replace(/<[^>]+>/g, ' ')).trim());
      continue;
    }
    publish(hrefKey);
    const labelText = collapse(label.replace(/<[^>]+>/g, ' '));
    const labelKeys = [...labelText.matchAll(CANDIDATE)].map((m) => normalise(m[0]));
    if (labelKeys.length && !labelKeys.includes(hrefKey)) {
      mismatches.push({ kind, label: labelKeys[0], href: hrefKey });
    }
  }

  // 2. Prose: every digit run anywhere, including inside the links above.
  for (const [raw] of flat.matchAll(CANDIDATE)) {
    const keys = keysIn(raw);
    if (keys.length) {
      for (const key of keys) publish(key);
    } else if (raw.startsWith('+')) {
      flag('number', raw);
    }
  }

  return { published, mismatches, unrecognised };
}

/**
 * Provenance records from the page-local list and the contact register.
 * The stricter record wins: a number marked unverified in either place stays
 * unverified, so a register row with a source cannot launder a page-local
 * doubt, and a register row that loses its source is reported even if the
 * page-local list vouches for the number.
 */
export function mergeRecords(pageLocal, register) {
  const records = new Map();
  for (const [key, rec] of pageLocal) records.set(key, { ...rec, from: 'check-contacts.mjs' });

  const NO_SOURCE =
    'No source recorded against this row in the contact register. Whoever added or changed it should say where they checked it.';

  const add = (raw, service, row) => {
    if (!raw) return;
    const key = normalise(raw);
    if (SHORTCODES.has(key)) return;
    const fromRegister = {
      service,
      verified: row.verified || undefined,
      source: row.source || undefined,
      unverified: row.source ? undefined : NO_SOURCE,
      from: 'contacts.json',
    };
    const existing = records.get(key);
    if (existing && !existing.source) {
      records.set(key, { ...existing, alsoIn: 'contacts.json' });
      return;
    }
    if (existing && !fromRegister.source) {
      records.set(key, { ...fromRegister, alsoIn: 'check-contacts.mjs (as verified — the register row has lost its source)' });
      return;
    }
    records.set(key, fromRegister);
  };

  for (const row of register) {
    add(row.number, row.service, row);
    add(row.whatsapp, `${row.service} — WhatsApp`, row);
  }
  return records;
}
