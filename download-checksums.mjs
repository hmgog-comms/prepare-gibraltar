/**
 * download-checksums.mjs — ties each committed download PDF to the HTML twin it
 * was generated from.
 *
 * generate-pdfs.mjs writes src/assets/downloads/checksums.sha256 after a
 * successful run: one line per file, in sha256sum format, for every twin and
 * every PDF. check-contacts.mjs recomputes and compares on every build. If a
 * twin was edited and the PDFs not regenerated, or a PDF regenerated and not
 * committed with its sidecar, the build fails and names the file — the PDF is
 * what the Downloads page offers, and until 16 Sept 2026 nothing checked that
 * it still matched the twin the contact check actually reads.
 *
 * Verify by hand: cd src/assets/downloads && shasum -a 256 -c checksums.sha256
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const SIDECAR = 'checksums.sha256';
const EXTENSIONS = ['html', 'pdf'];
const RERUN = 'run node generate-pdfs.mjs and commit the PDFs with checksums.sha256';

const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

/** Records the current hash of every twin and PDF named. */
export function writeChecksums(dir, names) {
  const lines = names.flatMap((name) =>
    EXTENSIONS.map((ext) => `${sha256(join(dir, `${name}.${ext}`))}  ${name}.${ext}`)
  );
  writeFileSync(join(dir, SIDECAR), `${lines.join('\n')}\n`);
}

/** Problems, one line each, or an empty array when every file matches its record. */
export function verifyChecksums(dir, names) {
  const sidecar = join(dir, SIDECAR);
  if (!existsSync(sidecar)) return [`${SIDECAR} is missing — ${RERUN}`];
  const recorded = new Map(
    readFileSync(sidecar, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [hash, file] = line.split(/\s{2}/);
        return [file, hash];
      })
  );
  const problems = [];
  for (const name of names) {
    const files = EXTENSIONS.map((ext) => `${name}.${ext}`);
    if (files.some((f) => !recorded.has(f))) {
      problems.push(`${name} is not recorded in ${SIDECAR} — ${RERUN}`);
      continue;
    }
    for (const file of files) {
      const path = join(dir, file);
      if (!existsSync(path)) {
        problems.push(`${file} is missing`);
      } else if (sha256(path) !== recorded.get(file)) {
        problems.push(`${file} has changed since the PDFs were last generated — ${RERUN}`);
      }
    }
  }
  return problems;
}
