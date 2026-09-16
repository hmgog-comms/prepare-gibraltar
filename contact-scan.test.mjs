/**
 * Tests for contact-scan.mjs — the extraction and classification behind
 * check-contacts.mjs. Every case here is a way a number was found to slip past
 * the check in the 16 Sept 2026 review, or a way it must not false-positive.
 *
 * Run: npm test
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { normalise, classify, extract, mergeRecords } from './contact-scan.mjs';
import { writeChecksums, verifyChecksums } from './download-checksums.mjs';

describe('normalise + classify', () => {
  const cases = [
    // [written form, canonical key, class]
    ['200 72500', '20072500', 'Gibraltar landline'],
    ['20072500', '20072500', 'Gibraltar landline'],
    ['+350 200 72500', '20072500', 'Gibraltar landline'],
    ['+35020072500', '20072500', 'Gibraltar landline'],
    ['0035020072500', '20072500', 'Gibraltar landline'],
    ['35020072500', '20072500', 'Gibraltar landline'],
    ['200-72500', '20072500', 'Gibraltar landline'],
    ['2007 2500', '20072500', 'Gibraltar landline'],
    ['200 72500', '20072500', 'Gibraltar landline'],          // NBSP
    ['222 59050', '22259050', 'Gibraltar landline'],
    ['58297000', '58297000', 'Gibraltar mobile'],
    ['5829 7000', '58297000', 'Gibraltar mobile'],
    ['+350 58297000', '58297000', 'Gibraltar mobile'],
    ['0800 111 999', '0800111999', 'UK freephone'],
    ['0808 800 4444', '08088004444', 'UK freephone'],
    ['+44 20 7008 5000', '+442070085000', 'International'],
    ['+44 (0)20 7008 5000', '+442070085000', 'International'],
    ['0044 20 7008 5000', '+442070085000', 'International'],
    ['+34 956 123 456', '+34956123456', 'International'],
  ];
  for (const [raw, key, label] of cases) {
    test(`${JSON.stringify(raw)} → ${key} (${label})`, () => {
      assert.equal(normalise(raw), key);
      assert.equal(classify(key), label);
    });
  }

  const notNumbers = ['200 725000', '2007250', '2026', '0 0 24 24', '231F20', '15'];
  for (const raw of notNumbers) {
    test(`${JSON.stringify(raw)} does not classify`, () => {
      assert.equal(classify(normalise(raw)), null);
    });
  }
});

describe('extract — numbers in prose', () => {
  test('finds a plainly written landline', () => {
    const r = extract('Ring 200 72500 at any hour.');
    assert.deepEqual([...r.published], ['20072500']);
  });

  test('finds a number split by a YAML fold (newline plus indentation)', () => {
    const r = extract('summary: >\n  If in doubt call 200\n      72500 at any hour.');
    assert.deepEqual([...r.published], ['20072500']);
  });

  test('finds hyphenated, 4-4 grouped and E.164 spellings', () => {
    const r = extract('200-72500, 2007 2500, +35020072500, 0035020072500');
    assert.deepEqual([...r.published], ['20072500']);
  });

  test('finds a mobile written with a space', () => {
    assert.deepEqual([...extract('Text 5829 7000.').published], ['58297000']);
  });

  test('skips national short codes', () => {
    const r = extract('Dial 999, 111, 112 or 116 123.');
    assert.equal(r.published.size, 0);
    assert.equal(r.unrecognised.length, 0);
  });

  test('a +-prefixed run that does not classify is unrecognised, not ignored', () => {
    const r = extract('Call +350 200 7250 now.');       // one digit short
    assert.equal(r.published.size, 0);
    assert.equal(r.unrecognised.length, 1);
    assert.match(r.unrecognised[0].raw, /\+350 200 7250/);
  });

  test('a bare run that does not classify is ignored (years, references)', () => {
    const r = extract('Data Protection Act 2004; reviewed 15 September 2026; ref 200 725000.');
    assert.equal(r.published.size, 0);
    assert.equal(r.unrecognised.length, 0);
  });
});

describe('extract — false positives it must not raise', () => {
  const noise = [
    'viewBox="0 0 24 24"',
    'd="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919"',
    'color: #231F20; background: rgba(0,0,0,0.88); margin: 15mm 20mm 12mm;',
    'Tune to 91.6 FM or 1458 AM.',
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAA12345678AAAAB',
    'sha256 3f2a9c20072500bb17e',
    'li + li { margin-top: 0.5rem }',
    '2026-09-16T10:00:00Z',
  ];
  for (const text of noise) {
    test(`ignores ${JSON.stringify(text.slice(0, 40))}`, () => {
      const r = extract(text);
      assert.equal(r.published.size, 0, `published ${[...r.published]}`);
      assert.equal(r.unrecognised.length, 0, `unrecognised ${JSON.stringify(r.unrecognised)}`);
    });
  }
});

describe('extract — tel: and wa.me links', () => {
  test('records the number a tel: href actually dials', () => {
    const r = extract('<a href="tel:+35020072500">Call us</a>');
    assert.deepEqual([...r.published], ['20072500']);
    assert.equal(r.mismatches.length, 0);
  });

  test('reports a markdown tel: link whose label and href disagree', () => {
    const r = extract('Call the port on [200 72500](tel:+35020072509).');
    assert.equal(r.mismatches.length, 1);
    assert.deepEqual(r.mismatches[0], { kind: 'tel', label: '20072500', href: '20072509' });
  });

  test('reports an HTML tel: link whose label and href disagree', () => {
    const r = extract('<a class="x" href="tel:20072509">200 72500</a>');
    assert.equal(r.mismatches.length, 1);
    assert.equal(r.mismatches[0].href, '20072509');
  });

  test('accepts a tel: link whose label carries +350 and href does not', () => {
    const r = extract('[+350 200 72500](tel:20072500)');
    assert.equal(r.mismatches.length, 0);
  });

  test('reports a markdown wa.me link whose label and href disagree', () => {
    const r = extract('[56003195](https://wa.me/35056003196)');
    assert.equal(r.mismatches.length, 1);
    assert.deepEqual(r.mismatches[0], { kind: 'whatsapp', label: '56003195', href: '56003196' });
  });

  test('accepts the HTML wa.me form used on the site', () => {
    const r = extract(
      '<a href="https://wa.me/35056003195" target="_blank" rel="noopener noreferrer">56003195<span class="visually-hidden"> (opens in new tab)</span></a>'
    );
    assert.equal(r.mismatches.length, 0);
    assert.deepEqual([...r.published], ['56003195']);
  });

  test('reports a wa.me link with a prefilled message when the numbers disagree', () => {
    const r = extract('<a href="https://wa.me/35056003196?text=Hello">56003195</a>');
    assert.equal(r.mismatches.length, 1);
  });

  test('a wa.me href whose number does not classify is unrecognised', () => {
    const r = extract('<a href="https://wa.me/3505600319">56003195</a>');
    assert.equal(r.unrecognised.length, 1);
    assert.equal(r.unrecognised[0].kind, 'whatsapp');
  });

  test('a tel: href whose number does not classify is unrecognised', () => {
    const r = extract('[200 72500](tel:+3502007250)');
    assert.equal(r.unrecognised.length, 1);
    assert.equal(r.unrecognised[0].kind, 'tel');
  });

  test('a label with words and no digits is not compared', () => {
    const r = extract('[WhatsApp us](https://wa.me/35056003195)');
    assert.equal(r.mismatches.length, 0);
    assert.deepEqual([...r.published], ['56003195']);
  });

  test('a template expression in href and label is neither published nor a mismatch', () => {
    const r = extract('<a href="tel:{{ row.number | replace(" ", "") }}">{{ row.number }}</a>');
    assert.equal(r.published.size, 0);
    assert.equal(r.mismatches.length, 0);
    assert.equal(r.unrecognised.length, 0);
  });
});

describe('mergeRecords — the stricter record wins', () => {
  const pageLocal = new Map([
    ['20074636', { service: 'GRA', unverified: 'could not be confirmed', raised: '2026-09-16' }],
    ['58466000', { service: 'GEA out of hours', verified: '2026-09-14', source: 'gea.gi' }],
  ]);

  test('a register row with a source does not launder a page-local unverified record', () => {
    const register = [{ service: 'GRA', number: '200 74636', verified: '', source: 'TBC' }];
    const records = mergeRecords(pageLocal, register);
    const r = records.get('20074636');
    assert.equal(r.source, undefined);
    assert.match(r.unverified, /could not be confirmed/);
  });

  test('a register row with no source is unverified', () => {
    const register = [{ service: 'X', number: '200 11111' }];
    const r = mergeRecords(pageLocal, register).get('20011111');
    assert.equal(r.source, undefined);
    assert.match(r.unverified, /No source recorded/);
  });

  test('a register row with a source is verified and comes from contacts.json', () => {
    const register = [{ service: 'RGP', number: '200 72500', verified: '2026-09-15', source: 'police.gi' }];
    const r = mergeRecords(pageLocal, register).get('20072500');
    assert.equal(r.source, 'police.gi');
    assert.equal(r.from, 'contacts.json');
  });

  test('the whatsapp field on a register row gets the row\'s provenance', () => {
    const register = [{ service: 'SNDO', number: '200 12345', whatsapp: '56003195', verified: '2026-09-15', source: 'Daniel' }];
    const r = mergeRecords(pageLocal, register).get('56003195');
    assert.equal(r.source, 'Daniel');
    assert.match(r.service, /WhatsApp/);
  });

  test('a register number written with +350 keys the same as the bare number', () => {
    const register = [{ service: 'X', number: '+350 200 72500', source: 's' }];
    assert.ok(mergeRecords(pageLocal, register).has('20072500'));
  });
});

describe('download checksums — the PDFs must match the twins they came from', () => {
  const setup = () => {
    const dir = mkdtempSync(join(tmpdir(), 'dl-'));
    writeFileSync(join(dir, 'a.html'), '<p>200 72500</p>');
    writeFileSync(join(dir, 'a.pdf'), 'pdf-bytes-a');
    writeFileSync(join(dir, 'b.html'), '<p>b</p>');
    writeFileSync(join(dir, 'b.pdf'), 'pdf-bytes-b');
    return dir;
  };

  test('a freshly written sidecar verifies clean', () => {
    const dir = setup();
    writeChecksums(dir, ['a', 'b']);
    assert.deepEqual(verifyChecksums(dir, ['a', 'b']), []);
    rmSync(dir, { recursive: true });
  });

  test('editing a twin without regenerating names that twin', () => {
    const dir = setup();
    writeChecksums(dir, ['a', 'b']);
    writeFileSync(join(dir, 'a.html'), '<p>200 72509</p>');
    const problems = verifyChecksums(dir, ['a', 'b']);
    assert.equal(problems.length, 1);
    assert.match(problems[0], /a\.html/);
    rmSync(dir, { recursive: true });
  });

  test('a PDF that was regenerated but not the one recorded names that PDF', () => {
    const dir = setup();
    writeChecksums(dir, ['a', 'b']);
    writeFileSync(join(dir, 'b.pdf'), 'pdf-bytes-b-new');
    const problems = verifyChecksums(dir, ['a', 'b']);
    assert.equal(problems.length, 1);
    assert.match(problems[0], /b\.pdf/);
    rmSync(dir, { recursive: true });
  });

  test('a missing sidecar is a problem, not a pass', () => {
    const dir = setup();
    const problems = verifyChecksums(dir, ['a', 'b']);
    assert.equal(problems.length, 1);
    assert.match(problems[0], /checksums\.sha256/);
    rmSync(dir, { recursive: true });
  });

  test('a document missing from the sidecar is a problem', () => {
    const dir = setup();
    writeChecksums(dir, ['a']);
    const problems = verifyChecksums(dir, ['a', 'b']);
    assert.equal(problems.length, 1);
    assert.match(problems[0], /b/);
    rmSync(dir, { recursive: true });
  });
});

// Added after the pre-merge review of 16 Sept 2026: innocent content that the
// first version of the wider scanner would have failed the build on.
describe('extract — legitimate content that must not fail the build', () => {
  const innocent = [
    "Gibraltar's international dialling code is +350.",
    'From abroad dial (+350) then the number.',
    'Temperatures of +40°C are expected.',
    'A surge of +5 metres is possible.',
    'The 2000-2025 strategy period.',
    'Closed from 2250-2300 hrs for maintenance.',
    'The reservoirs hold 50 000 000 litres.',
  ];
  for (const text of innocent) {
    test(`does not fail on ${JSON.stringify(text)}`, () => {
      const r = extract(text);
      assert.equal(r.published.size, 0, `published ${[...r.published]}`);
      assert.equal(r.unrecognised.length, 0, `unrecognised ${JSON.stringify(r.unrecognised)}`);
    });
  }

  test('still flags a +350 number with a digit missing', () => {
    const r = extract('Call +350 200 7250 now.');
    assert.equal(r.unrecognised.length, 1);
  });

  test('a label with words and a following count is compared on the number only', () => {
    const r = extract('<a href="tel:20073659">200 73659 24 hours</a>');
    assert.equal(r.mismatches.length, 0, JSON.stringify(r.mismatches));
    assert.deepEqual([...r.published], ['20073659']);
  });

  test('a markdown label with a bracketed suffix is compared on the number only', () => {
    const r = extract('[200 73659 (24/7)](tel:20073659)');
    assert.equal(r.mismatches.length, 0, JSON.stringify(r.mismatches));
  });

  test('a hyphenated 3-5 landline is still found', () => {
    assert.deepEqual([...extract('Ring 200-72500.').published], ['20072500']);
  });
});
