# Prepare Gibraltar — Claude Code Guide

Official emergency preparedness website for Gibraltar residents, published by HM Government of Gibraltar — Civil Contingencies Unit.

**Stack:** Eleventy 3.x (ESM), Nunjucks templates, Decap CMS, plain CSS. Deployed to Cloudflare Pages.

**Status: Live at https://prepare-gibraltar.pages.dev** (Cloudflare Pages, Press Office account). The
final domain will be `prepare.gov.gi` once ITLD provision DNS — that is the only outstanding item
with them. Be willing to make structural changes; don't treat anything as too risky to touch.

**Ownership:** repo `hmgog-comms/prepare-gibraltar` (public), hosting on the Press Office Cloudflare
account, deploys via GitHub Actions. Nothing in the chain depends on an individual's machine or
personal accounts. Internal working notes are in the git-ignored `NOTES-INTERNAL.md`, and the older
guides in `docs-internal/`.

**Note — not the same as hmgog-website:** This site uses plain CSS and custom Nunjucks layouts. The main HMGoG site uses the GOV.UK Design System. Do not import conventions, components, or patterns from one into the other.

---

## Dev Commands

```bash
npm start          # Eleventy dev server → http://localhost:8080 (with live reload)
npx decap-server   # Decap CMS proxy → http://localhost:8080/admin/ (run in second terminal)
npm run build      # Static build → _site/
npm run check      # Emergency contact drift check — also runs in CI before every build
```

Both `npm start` and `npx decap-server` must be running to use the CMS locally.

Kill a stuck port: `kill -9 $(lsof -ti:8080)`

---

## Project Structure

```
src/
├── _data/
│   ├── site.json            # Site name, tagline, footer text
│   ├── contacts.json        # THE contact register — see "Contact numbers have one home"
│   └── homepage.json        # All homepage text
├── _includes/
│   ├── layouts/
│   │   ├── base.njk         # HTML shell
│   │   ├── page.njk         # Standard content page — breadcrumb, h1, content
│   │   ├── hazard.njk       # Hazard page with sidebar
│   │   ├── sections.njk     # Prose pages built from a sections[] list
│   │   ├── hazards-index.njk
│   │   ├── downloads.njk
│   │   └── contacts.njk
│   ├── alert-box.njk        # One alert box, used by several layouts
│   ├── whatsapp-channels.njk
│   ├── header.njk
│   └── footer.njk
├── assets/
│   ├── css/style.css
│   ├── js/main.js
│   └── images/
├── hazards/                 # 18 hazard markdown files
├── _headers                 # Security headers (Cloudflare Pages)
├── _redirects               # 301s (Cloudflare Pages)
├── index.njk                # Homepage — the only page not using page.njk
├── 404.md
└── [section pages]/         # get-prepared, hazards, downloads, emergency-contacts,
                             # persons-with-disabilities — each an index.md
admin/
├── index.html               # Decap CMS panel
└── config.yml               # Decap CMS configuration
_site/                       # Build output (git-ignored)
```

---

## Colour Palette

| Token | Value | Usage |
|---|---|---|
| `--color-primary` | `#E31F26` | Red — primary brand, CTAs |
| `--color-primary-dark` | `#B5181E` | Hover states |
| `--color-black` | `#231F20` | Header, footer backgrounds |
| `--color-text` | `#231F20` | Body text |
| `--color-surface` | `#F4F4F4` | Card backgrounds |
| `--color-border` | `#CCCCCC` | Borders |

---

## Key Conventions

- **Templating:** Nunjucks (`.njk`). Global data from `src/_data/site.json` is available in all templates.
- **Hazard pages:** Each hazard is a Markdown file in `src/hazards/`. Frontmatter fields, in order: `layout`, `title`, `summary`, `thumbnail`, optional `thumbnail_position`, `at_risk`, `tags`, `before`, `during`, `after`, optional `resources`, `local_contacts`. All snake_case. The bodies are empty — everything lives in frontmatter. `at_risk` renders as plain text (no markdown); every other long field goes through `markdownify`, which runs with `linkify: false`, so links must use explicit `[text](url)` syntax. Sub-headings inside `before`/`during` use `###` to keep heading order valid.
- **CMS:** Decap CMS manages hazards, emergency contacts, and page content. Config is in `admin/config.yml`, using the `github` backend with `publish_mode: editorial_workflow` and a self-hosted Cloudflare Worker as the OAuth proxy. `local_backend: true` is set, so for local CMS work just run `npx decap-server` in a second terminal alongside `npm start` — no config editing needed. Do not use Git Gateway or Netlify Identity.
- **CMS bundle:** `admin/decap-cms.js` is copied from `node_modules/decap-cms/dist/` at build time by a passthrough rule — it is not committed. Change the version in `package.json`, not by hand-dropping a file.
- **Accessibility:** WCAG 2.2 AA (required by Disability Act s.18 — confirmed by SNDO/GRA, Aug 2026). Use semantic HTML, ARIA landmarks, and sufficient colour contrast. Test with IBM Equal Access: `npx achecker --policies IBM_Accessibility,WCAG_2_2 _site`.
- **Language:** person-first, per UN convention — "persons with disabilities", never "disabled persons"; "support needs", not "special needs". The office is the "Supported Needs & Disability Office (SNDO)" (not "Special Needs"); in `.njk` content write the `&` as `&amp;`.
- **Download documents** (`src/assets/downloads/`) are generated — edit `generate-pdfs.cjs` and run
  `node generate-pdfs.cjs`. The script writes the PDFs only; the standalone `.html` twins beside them
  are hand-maintained and must be edited to match, or the two drift. The twins are **not linked from
  the Downloads page** — they exist so wording can be checked and printed. Two traps:
  - **`infoSection()` silently discards any bullet past two rendered lines.** No warning, no error —
    the text simply does not appear. After any content edit, render the PDFs to images and look at
    them (`pdftoppm -png -r 100 file.pdf out`); a text diff will not show it.
  - **The PDFs are not tagged for screen readers** (checked 15 Sept 2026: no `StructTreeRoot` on any
    of the four). The accessibility statement says so and offers an alternative format on request.
    Do not claim they are tagged. pdf-lib has no structure-tree API, so real tagging means a
    different generator.
- **No build pipeline for CSS/JS** — plain files, no bundler.
- **Every phone number published on this site must have a recorded source.** `check-contacts.mjs`
  runs in CI before every build. It scans all four number formats the site uses — Gibraltar
  landlines, Gibraltar mobiles, UK freephone and international — and **fails the build if a number
  appears that has no provenance record**, naming every file. A record says what the number is, the
  date it was confirmed, and who says it is right. **Do not weaken or skip this check**; a wrong
  phone number is the worst defect this site can ship. See "The verification rule" below.

---

## What the CMS can and cannot edit

**Every page on the site is editable.** Nothing is developer-only any more.

| Collection | Backing file(s) |
|---|---|
| Hazards | `src/hazards/*.md` — 18 pages, all content in frontmatter |
| Emergency Contacts | `src/_data/contacts.json` — the contact register (see below) |
| Site details | `src/_data/site.json` — name, tagline, footer text |
| Pages | `src/index.njk`'s text via `src/_data/homepage.json`, plus `index.md` for get-prepared, persons-with-disabilities, emergency-contacts, downloads, hazards, 404 |
| Policy Pages | `src/{privacy-notice,cookie-policy,accessibility-statement}/index.md` |

### The pattern: content in frontmatter, markup in a layout

**Never map a `.njk` template to a Decap collection.** Decap writes back frontmatter only, so the
first save strips every line of markup below it. `src/index.njk` was mapped that way once and would
have destroyed the homepage on the first save.

The pages converted in September 2026 use the *hazard* pattern instead: a `.md` file with an **empty
body** and all content in YAML frontmatter, rendered by a layout that holds the markup. Four layouts
cover the site — `sections.njk` (get-prepared, persons-with-disabilities, 404), `hazards-index.njk`,
`downloads.njk` and `contacts.njk` — each chaining to `page.njk` the way `page.njk` chains to
`base.njk`. Shared pieces live in `src/_includes/alert-box.njk` and `whatsapp-channels.njk`.

**Use markdown frontmatter, not a JSON data file, for page prose.** This was considered and the JSON
route rejected for three reasons, in order of weight:

1. **`check-contacts.mjs` scans `.njk`, `.md`, `.html` and `.json` — but page prose in a JSON data
   file would sit outside the files it treats as content.** This was not theoretical: when the
   contact register was introduced, deliberately changing a number failed the build and named
   `src/get-prepared/index.md` and `src/persons-with-disabilities/index.md` among the stale files.
   Had those pages become `src/_data/pages/*.json`, the guard would have lost sight of them.
2. **Pull-request review is the safety model here.** JSON stores a paragraph as one `\n`-escaped
   line, so a wording change shows as a single altered line with no word-level diff. YAML block
   scalars diff line by line.
3. It is the idiom the 18 hazard pages already use and Decap already round-trips.

`src/_data/homepage.json` and `contacts.json` stay JSON because they are genuine global data, read by
more than one page.

### Contact numbers have one home

`src/_data/contacts.json` is the register: four groups, ten rows. The emergency contacts page and the
homepage teaser both render from it, and **the `tel:` link is derived from the number** by stripping
spaces — they used to be written out separately, so changing a number in the CMS updated the label
while the link still dialled the old one. The CMS rejects anything but digits and spaces in that
field. Do not reintroduce a hand-written `tel:` href beside a data-driven number.

Most pages still write numbers into their own content — a data file is not run through the template
engine — so the register is the source of truth, not a mechanism that reaches every page.

### The verification rule

**A number already on the site is not a verified number.** Established after September 2026, when an
audit of the numbers this site publishes found, among others:

- `200 59271`, published as "Gibraltar Veterinary Services", was **the fax number of the Office of
  the Deputy Chief Minister**. The page told the public to report animal disease to it immediately.
- `200 42292`, published as the Meteorological Office, appeared in no source anywhere. The only
  search result for the number was this repository — published long enough to become its own
  citation.
- `200 41288`, AquaGib's **customer services** line, was published as the water *emergency* contact
  in four printed documents. That number is real and is in the register; it was the wrong one for
  the purpose.

All three passed every check that existed. They were internally consistent and wrong.

So `check-contacts.mjs` asks two questions rather than one: *is this number known, and who says it
is right?* Provenance lives in two places and the check merges them:

- **`src/_data/contacts.json`** — rows in the register carry optional `verified` (date) and `source`
  (free text). Both are editable in the CMS. A row with a number and no `source` is reported as
  unverified.
- **`PAGE_LOCAL` in `check-contacts.mjs`** — numbers that live in page content rather than the
  register. Each entry carries either `verified` + `source`, or `unverified` with the reason it
  could not be confirmed and the date it was raised.

**Three outcomes:**

| State | Result |
|---|---|
| Number has a record with a source | Passes |
| Number has a record marked `unverified` | **Passes**, and is printed on every build |
| Number has no record at all | **Fails the build** |

An unverified number does not fail the build deliberately. This site must stay updatable when a
check is pending and there may be nobody in post to clear it — an expiring blocker would be an
outage triggered by absence. Instead `.github/workflows/unverified-numbers.yml` runs monthly and
opens an issue naming every number still waiting, the same pattern `token-expiry.yml` uses.

**If you cannot find a published source for a number, do not guess and do not substitute a
plausible-looking alternative.** Swapping one unverified number for another is not a fix. Record it
as unverified with the reason and ask Daniel to ring it.

Ask which number it is, too, not just whether the digits are right. A main switchboard can be
correct and still be the wrong thing to publish: AquaGib's was an office line with a separate
24-hour fault service; the Electricity Authority's is a 24-hour line with a menu and a separate
direct route. **The question is "is this the number to ring at 3am?"**

### Five Decap behaviours to expect rather than debug

- **Every mapped JSON file needs `extension: json` and `format: json`.** Without them Decap treats it
  as Markdown-with-frontmatter and corrupts the file on save.
- **Decap sorts frontmatter keys into the collection's field order on save.** Keep the field order in
  `admin/config.yml` matching the key order in the file, or the first save reorders the whole file.
- **Markdown fields that carry HTML are set to `modes: ["raw"]`.** The rich-text editor serialises
  through `remark`, which strips inline `<span>` tags and link attributes — including the
  `target="_blank"`, `rel="noopener noreferrer"` and `visually-hidden` spans the external links
  depend on. Raw mode means the widget never parses the body, so the string passes through untouched.
  The cost is that editors type markdown on those fields; the editor guide covers it.
- **The converted pages are committed in Decap's own serialiser output** (folded `>` scalars,
  reflowed at 80 columns), so an editor's first save shows only the line they changed rather than a
  200-line reformat. Verified idempotent. The 18 hazard pages are still hand-authored, so for those
  the old advice stands: review the preview, not the diff.
- **The standalone Media Library uploader and deleting a published entry both commit directly to
  `main`**, which the branch ruleset rejects. Editors see a red "Failed to persist media" banner.
  Images added from inside an entry work correctly.

### Three things the build depends on

- **The `hazards` collection is filtered by layout**, because `src/hazards/index.md` is matched by the
  same `src/hazards/*.md` glob that builds the grid. Without the filter the index renders as a
  nineteenth card inside its own grid.
- **It is also sorted by title.** No hazard file sets `date`, so Eleventy fell back to file
  modification time — the card order came from the filesystem, and only looked stable because a CI
  checkout gives every file the same timestamp. Do not remove the sort.
- **Indented code blocks are disabled** in both markdown-it instances (`md.disable("code")` and
  `amendLibrary`). Content lives in YAML block scalars the CMS rewrites on save; a four-space
  re-indent would otherwise render a whole paragraph inside `<pre><code>` — a total loss of
  formatting that looks like a whitespace change in the diff.

---

## Current State

- **Content:** all 18 hazard pages were reviewed by their owning teams and the revisions applied in
  September 2026. 17 of 18 carry a `resources` section; `src/hazards/storms.md` deliberately does
  not, pending the Severe Weather Warning wording.
- **Accessibility:** WCAG 2.2 AA. IBM Equal Access passes with 0 violations on every page
  (last full scan 24 Aug 2026). The accessibility statement is current.
- **Language:** person-first throughout, per SNDO guidance implemented Aug 2026. The page lives at
  `/persons-with-disabilities/`, with 301s from `/disabled-persons/` in `src/_redirects`.
- **Open threads** involving named colleagues, other organisations' services, and unresolved content
  gaps are kept in `NOTES-INTERNAL.md` (git-ignored, not published). Read it before picking up
  outstanding work.
- **Handover completed 14 Sept 2026.** The CMS editorial workflow was tested end to end: a save
  opened `cms/hazards/power-cuts`, Publish merged it, and the Action deployed to production.
  Note that Decap normalises a page's YAML on its first save (`|` block scalars become `>`, long
  lines reflow), which makes that first diff large. It is cosmetic — rendered output was verified
  byte-identical — and subsequent edits to the same file diff normally. Review the preview
  deployment, not the raw diff.
- **The deploy token deliberately does not expire.** An expiring credential was replaced on
  14 Sept 2026 with a non-expiring one, because there may be nobody in post to rotate it — an expiry
  date would be a scheduled outage on an emergency site triggered by absence rather than by anything
  going wrong. `.github/workflows/token-expiry.yml` still runs monthly and opens an issue if the
  token ever becomes invalid. **Do not reintroduce an expiry unless someone has explicitly taken on
  rotating it.**
- **Raising the branch ruleset to 1 required approval will break Decap's Publish button.** It is at
  0 approvals because there is currently one editor and GitHub forbids approving your own PR.
- **The old repo `neoghio/emergency-preparedness-gibraltar` is archived, not deleted.** It is the
  only online copy of the pre-handover commit history, including the provenance of the September 2026
  hazard review that the ground-zero squash discarded. Do not delete it.

---

## If you have inherited this project

This site is designed to survive being unattended. It is static files on Cloudflare's free tier:
no database, no runtime to patch, no certificate to renew by hand, no invoice to miss. **Left
completely alone it keeps serving emergency guidance indefinitely** — it simply stops being
updatable. That is a deliberate property, not an accident.

The one dependency that would strand it is access to the **`hmgog-comms` GitHub account**, which owns
the repository. Without it nobody can merge, so nobody can publish. If you have inherited this and
cannot get into that account, that is the first thing to solve.

Everything else has a manual fallback:
- **Deploys** — `npm run build && npx wrangler pages deploy _site --project-name=prepare-gibraltar --branch=main`
  after `npx wrangler login` against the Press Office Cloudflare account.
- **Content** — every page is a file in `src/`. The CMS is a convenience over git, not a dependency.
- **`/alerts/` was removed 14 Sept 2026.** It was roughly 60% duplication of Get Prepared and
  Emergency Contacts, and was never in the main navigation — only a footer link. Its unique content
  moved into **Get Prepared §1 "Be Informed"**: weather warnings (Yellow/Amber/Red), "Stay safe
  online" on misinformation, the CCU explanation, and the loudhailer/door-to-door detail. `/alerts/`
  301s to `/get-prepared/#be-informed`. **Ivor's Severe Weather Warning wording now belongs under
  Get Prepared §1 → Weather warnings**, not on a separate page.
- **Beware duplicated content generally.** The GBC frequency alone appears in 23 files. Before adding
  a fact to a page, check whether it already lives somewhere canonical — the site has a real tendency
  to restate itself, and every copy is a copy that can go stale.

---

## Deployment

Cloudflare Pages, project `prepare-gibraltar`, owned by the Press Office.

- **Deploys run in GitHub Actions**, not from anyone's machine: push to `main` triggers
  `.github/workflows/deploy.yml`, which builds with Eleventy and uploads `_site/` with
  `wrangler pages deploy`.
- **Do not connect the Cloudflare Pages project to Git.** The Pages Git integration was used on the
  previous project and never once built successfully — pushed deployments sat at stage `queued`
  permanently while direct uploads succeeded. Actions is the deploy path; a Git-connected project
  only reintroduces that failure mode.
- Manual fallback, if Actions is unavailable:
  `npm run build && npx wrangler pages deploy _site --project-name=prepare-gibraltar --branch=main`
  (requires `npx wrangler login` against the Press Office account).

## Content editing

Press Office staff edit at `/admin/` (Decap CMS, `github` backend, editorial workflow).

A save opens a pull request rather than committing to `main`; Publish merges it, which triggers the
deploy. The `main` ruleset requires a pull request but **0 approving reviews**, because there is
currently a single editor and GitHub forbids approving your own PR — at 1 approval nothing could
ever be merged.

**When a second editor joins, raise the rule to 1 approval.** At that point Decap's Publish button
stops working: it merges via the API, gets a 405, and its `forceMergePR` fallback is blocked by the
same rule, so the editor sees only an opaque error. The flow then becomes draft in Decap, approve and
merge in GitHub. Update `README.md` and the editor guide at the same time.

Note that the standalone Media Library uploader and deletion of published entries both commit
directly to `main` and are rejected by the ruleset regardless of the approval count. See
`NOTES-INTERNAL.md` for the full runbook.
