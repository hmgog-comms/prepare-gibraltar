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
├── _data/site.json          # Global data: site name, emergency contacts
├── _includes/
│   ├── layouts/
│   │   ├── base.njk         # HTML shell
│   │   ├── page.njk         # Standard content page
│   │   └── hazard.njk       # Hazard page with sidebar
│   ├── header.njk
│   └── footer.njk
├── assets/
│   ├── css/style.css
│   ├── js/main.js
│   └── images/
├── hazards/                 # 18 hazard markdown files
├── _headers                 # Security headers (Cloudflare Pages)
├── _redirects               # 301s (Cloudflare Pages)
├── index.njk                # Homepage
└── [section pages]/         # get-prepared, alerts, downloads, etc.
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
- **Download documents** (`src/assets/downloads/`) are generated — edit `generate-pdfs.cjs` and run `node generate-pdfs.cjs`; keep the standalone `.html` twins' wording in sync manually.
- **No build pipeline for CSS/JS** — plain files, no bundler.
- **Emergency contact numbers are NOT centralised, despite appearances.** `src/_data/site.json` is
  shown in the CMS as "Emergency Contacts", but most pages write the numbers into their own content —
  changing the CMS field updates only a couple of pages. `check-contacts.mjs` runs in CI before every
  build and fails it if a `200 xxxxx` number appears that is neither in `site.json` nor on the
  `PAGE_LOCAL` allowlist, naming every file to fix. **Do not weaken or skip this check**; a wrong
  phone number is the worst defect this site can ship. If a flagged number is correct and simply not
  CMS-managed, add it to `PAGE_LOCAL` with the service it belongs to.

---

## What the CMS can and cannot edit

Content lives in two shapes, and only one is safe for Decap to touch.

**Editable in the CMS:**

| Collection | Backing file(s) |
|---|---|
| Hazards | `src/hazards/*.md` — 18 pages, all content in frontmatter |
| Emergency Contacts | `src/_data/site.json` |
| Homepage | `src/_data/homepage.json` — hero headline and subheadline only |
| Policy Pages | `src/{privacy-notice,cookie-policy,accessibility-statement}/index.md` |

**Not editable — still developer-only:** `get-prepared/`, `emergency-contacts/` page body,
`persons-with-disabilities/`, `downloads/`, the `hazards/` index and `404`.

These are `.njk` templates built from bespoke components (`content-section`, `alert-box--danger`,
`section__intro`). **Never map one to a Decap collection as-is.** Decap writes back frontmatter only,
so the first save would strip every line of markup below it. `src/index.njk` was mapped that way and
would have destroyed the homepage on first save; the fix was to extract the editable text to
`src/_data/homepage.json` and point the collection at that. Apply the same pattern to open any of the
remaining pages: extract the prose to a data file, leave the markup in the template.

Pure-prose pages (only `<p>`, `<h2>`, `<ul>`) are the exception — convert those to Markdown and
expose the body, as was done for the three policy pages.

Two Decap behaviours to expect rather than debug:
- **Every mapped JSON file needs `extension: json` and `format: json`.** Without them Decap treats
  it as Markdown-with-frontmatter and corrupts the file on save.
- **The standalone Media Library uploader and deleting a published entry both commit directly to
  `main`**, which the branch ruleset rejects. Editors see a red "Failed to persist media" banner.
  Images added from inside an entry work correctly.

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
