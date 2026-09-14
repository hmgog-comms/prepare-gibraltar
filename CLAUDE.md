# Prepare Gibraltar — Claude Code Guide

Official emergency preparedness website for Gibraltar residents, published by HM Government of Gibraltar — Civil Contingencies Unit.

**Stack:** Eleventy 3.x (ESM), Nunjucks templates, Decap CMS, plain CSS. Deployed to Cloudflare Pages.

**Status: Live on Cloudflare Pages.** The final domain will be `prepare.gov.gi` once ITLD provision DNS. Be willing to make structural changes — don't treat anything as too risky to touch.

**Note — not the same as hmgog-website:** This site uses plain CSS and custom Nunjucks layouts. The main HMGoG site uses the GOV.UK Design System. Do not import conventions, components, or patterns from one into the other.

---

## Dev Commands

```bash
npm start          # Eleventy dev server → http://localhost:8080 (with live reload)
npx decap-server   # Decap CMS proxy → http://localhost:8080/admin/ (run in second terminal)
npm run build      # Static build → _site/
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
