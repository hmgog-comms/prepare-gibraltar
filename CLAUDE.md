# Prepare Gibraltar — Claude Code Guide

Official emergency preparedness website for Gibraltar residents, published by HM Government of Gibraltar — Civil Contingencies Unit.

**Stack:** Eleventy 3.x (ESM), Nunjucks templates, Decap CMS, plain CSS. Deployed to Netlify from
GitHub Actions.

**Status: Live at https://prepare-gibraltar.pages.dev**, and also deploying to
https://prepare-gibraltar.netlify.app while the move to `prepare.gov.gi` is in progress.

**The host moved to Netlify on 15 Sept 2026**, because Cloudflare Pages cannot serve a `.gov.gi`
subdomain — full reasoning under Deployment. Both hosts receive production deploys until the DNS
moves, so the address people already have does not go stale.

**The final domain will be `prepare.gov.gi`, and one CNAME from ITLD is the only thing left.**
Everything on our side is ready and waiting for it.

Be willing to make structural changes; don't treat anything as too risky to touch.

**Ownership:** repo `hmgog-comms/prepare-gibraltar` (public), hosting on the Press Office **Netlify**
team, deploys via GitHub Actions. The Cloudflare account is retained for the `cms-auth` worker and,
until cutover, the parallel Pages deploy. Nothing in the chain depends on an individual's machine or
personal accounts. Internal working notes are in the git-ignored `NOTES-INTERNAL.md`, and the older
guides in `docs-internal/`.

**Note — not the same as hmgog-website:** This site uses plain CSS and custom Nunjucks layouts. The main HMGoG site uses the GOV.UK Design System. Do not import conventions, components, or patterns from one into the other.

---

## Dev Commands

```bash
npm start          # Eleventy dev server → http://localhost:8080 (with live reload)
npx decap-server   # Decap CMS proxy → http://localhost:8080/admin/ (run in second terminal)
npm run build      # Static build → _site/
npm run check      # Contact number provenance check — `npm run build` runs it first
npm run test:auth  # Which origin the OAuth proxy hands the GitHub token to
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
├── _headers                 # Security headers (Netlify's format; Cloudflare adopted it)
├── _redirects               # 301s (same format, served natively by both)
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
  runs first inside `npm run build`, so it guards the manual deploy path as well as CI. It scans all
  four number formats the site uses — Gibraltar
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

`src/_data/contacts.json` is the register: four groups, eleven rows. The emergency contacts page and
the homepage teaser both render from it, and **the `tel:` link is derived from the number** by
stripping spaces — they used to be written out separately, so changing a number in the CMS updated
the label while the link still dialled the old one. The CMS rejects anything but digits and spaces in
that field. Do not reintroduce a hand-written `tel:` href beside a data-driven number.

**The WhatsApp link is derived the same way**, from a `whatsapp` field, for the same reason: it used
to be hand-written markup inside an `extra` line with the number appearing twice, once in
`wa.me/350…` and once as the visible text. Page prose cannot be derived — a markdown file is not run
through the template engine — so `src/persons-with-disabilities/index.md` really does write it twice,
and `check-contacts.mjs` compares the two and **fails the build if they disagree**. A WhatsApp
message to a wrong number gives no wrong-number signal: a stranger simply receives it and the sender
believes it arrived.

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
- **Accessibility:** WCAG 2.2 AA. Last **full** scan 24 Aug 2026, 0 violations. Pages changed since
  have been scanned individually and stay at 0, most recently the Downloads page and the four
  download web versions on 15 Sept 2026 — **a full rescan is due** before anyone claims the whole
  site again. The four download PDFs are **not** tagged for screen readers; the accessibility
  statement discloses this and offers an alternative format on request.
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
- **Neither deploy token expires, deliberately** — `NETLIFY_AUTH_TOKEN_PREPARE_GIBRALTAR` and the
  Cloudflare one. There may be nobody in post to rotate them, and an expiry date would be a scheduled
  outage on an emergency site triggered by absence rather than by anything going wrong. **Do not
  reintroduce an expiry unless someone has explicitly taken on rotating it.**
  `.github/workflows/token-expiry.yml` checks monthly and opens an issue — but it watches the
  **Cloudflare** token only, which after cutover deploys nothing. Repointing it is step 8 of the
  cutover.
- **The ruleset is at 0 approvals with no required status check, deliberately.** See "Publishing is
  deliberately instant" and "A second editor does not change the ruleset" under Content editing —
  both were decided on 15 Sept 2026 and both are easy to undo by accident.
- **The old repo `neoghio/emergency-preparedness-gibraltar` is archived, not deleted.** It is the
  only online copy of the pre-handover commit history, including the provenance of the September 2026
  hazard review that the ground-zero squash discarded. Do not delete it.

---

## If you have inherited this project

This site is designed to survive being unattended. It is static files: no database, no runtime to
patch, no certificate to renew by hand. **Left alone it keeps serving emergency guidance** — it
simply stops being updatable. That is a deliberate property, not an accident.

**Two things would strand it, and one of them is new.**

1. **Access to the `hmgog-comms` GitHub account**, which owns the repository. Without it nobody can
   merge, so nobody can publish. If you have inherited this and cannot get in, solve that first.
2. **The Netlify bill.** Until 15 Sept 2026 this site was on Cloudflare's free tier and this section
   read "no invoice to miss". That is no longer true. Netlify's Press Office team is a paid plan
   whose credits are **pooled across every site on it**, and when they run out Netlify **pauses all
   of them** — this site and `residency.gov.gi` together. Auto-recharge is on, which converts that
   into a small charge instead of an outage, but it means a dead card or a lapsed plan now takes the
   site down. Cloudflare Pages had unlimited bandwidth and was immune to this; it simply could not
   serve a `.gov.gi` subdomain. That was the trade.

Everything else has a manual fallback:
- **Deploys** — `npm run build && npx netlify-cli@27 deploy --dir=_site --prod --site 8dfda9be-7094-44cf-99f1-3b9e221c0986`
  after `npx netlify-cli login` against the Press Office Netlify account.
- **Content** — every page is a file in `src/`. The CMS is a convenience over git, not a dependency.

**Beware duplicated content.** The GBC frequency alone appears in 23 files. Before adding a fact to a
page, check whether it already lives somewhere canonical — the site restates itself readily, and
every copy can go stale. `/alerts/` was removed for this reason in Sept 2026 (it was ~60% duplication
of Get Prepared and Emergency Contacts) and 301s to `/get-prepared/#be-informed`; **Ivor's Severe
Weather Warning wording belongs under Get Prepared §1 → Weather warnings**, not on a page of its
own.

---

## Deployment

**Netlify**, site `prepare-gibraltar`, ID `8dfda9be-7094-44cf-99f1-3b9e221c0986`, on the Press Office
team (`hmgog-comms`) alongside `residency.gov.gi` and the customs preview.

**Why not Cloudflare Pages, which this site used until 15 Sept 2026.** Pages cannot serve a `.gov.gi`
subdomain: its custom domain needs the DNS zone on Cloudflare, and subdomain zones are
**Enterprise-only**. Moving the whole `gov.gi` zone is an ITLD-wide migration affecting every
government domain. Confirmed three ways — the Pages dashboard returns "Transfer DNS management",
Cloudflare's own documentation lists subdomain setup as Free/Pro/Business **No**, and the residency
project tested it independently in July and moved to Netlify for the same reason. Do not re-litigate
this from Cloudflare's Pages docs, which describe an external-DNS CNAME path the product does not
offer here.

**Both hosts receive production deploys until `prepare.gov.gi` is live.** `prepare-gibraltar.pages.dev`
is the address people were given, so it has to keep receiving content; if it went stale, an editor
could publish, see the CMS report success, and the address the public holds would silently keep the
old content. The Cloudflare step in `deploy.yml` is marked temporary and comes out at cutover.
Previews go to Netlify only.

- **Deploys run in GitHub Actions**, not from anyone's machine: push to `main` triggers
  `.github/workflows/deploy.yml`, which builds with Eleventy and uploads `_site/` with the pinned
  `netlify-cli@27`.
- **Do not connect either host's Git integration.** Cloudflare's was used on the previous project and
  never once built successfully. Netlify's works — residency uses it — but the gates this site
  depends on (`npm run check`, `npm run test:auth`) live in the workflow, and a host-run build
  bypasses them.
- **The deploy job is called `Build and deploy`** deliberately: host-neutral, because it has been a
  required status check before and a status-check context is the job name.
- Manual fallback, if Actions is unavailable:
  `npm run build && npx netlify-cli@27 deploy --dir=_site --prod --site 8dfda9be-7094-44cf-99f1-3b9e221c0986`
  (requires `npx netlify-cli login` against the Press Office account). `npm run build` runs the
  contact check first, so this path is guarded too.
- **`NETLIFY_AUTH_TOKEN_PREPARE_GIBRALTAR` is the only secret the deploy needs.** The site ID is
  inlined in the workflow — it is an identifier, not a credential. The token has **no expiry**, for
  the same reason as the Cloudflare one: there may be nobody in post to rotate it.

**Netlify credits are pooled per team, and auto-recharge must stay on.** From Netlify's billing
documentation: when the monthly allotment is used up, *"all of your web projects (sites/apps) are
paused"*, auto-recharge is *"turned off by default"*, and *"if one site/web project exceeds its
limits, all sites/projects on your account will be paused"*. With it off, a traffic spike on this
site **during an emergency** would take `residency.gov.gi` down with it. It was enabled on
15 Sept 2026. Do not turn it off.

### Moving to prepare.gov.gi

**`prepare.gov.gi` is the only address the public should ever see.** The `pages.dev` and
`netlify.app` addresses are infrastructure, not URLs to share.

**No page needs changing.** Every internal link is root-relative, and there is no canonical tag, no
sitemap, no `og:url` and no self-referencing absolute URL anywhere in the build — the site does not
know what it is called. The four download **HTML** versions, and the vulnerable-persons **PDF**,
already print `prepare.gov.gi` (`generate-pdfs.cjs:574`; the other three PDF footers carry no
domain), so those are slightly wrong today and become correct at cutover.

1. **Register the domain on the host first**, or it answers 522. ✅ **Done** — `prepare.gov.gi` is
   the custom domain on the Netlify site, showing `ssl: false` until DNS resolves.
2. **ITLD create one record** in the `gov.gi` zone:

   ```
   prepare.gov.gi   CNAME   prepare-gibraltar.netlify.app
   ```

   The same shape they added for `residency.gov.gi` on 7 July 2026 (Louis Soiza, Infrastructure
   section manager). TLS issues and renews automatically. `prepare.gov.gi` is completely clean — no
   NS, SOA, CNAME or A record — so unlike residency there is **no stale delegation to clear first**.
   Skip `www.`: residency added it and needed a domain alias plus a certificate reprovision.
3. **Deploy the OAuth worker** — `cd cms-auth && npm run test:auth && npx wrangler deploy`, then
   check the live worker rather than the file:
   `curl -s https://prepare-gibraltar-cms-auth.pressoffice.workers.dev/health` must list
   `https://prepare.gov.gi`.

   This is the step that breaks quietly. The worker hands the GitHub token to the CMS with
   `postMessage(message, targetOrigin)`, and the browser drops the message silently unless the origin
   matches exactly. Miss it and sign-in completes, GitHub authorises, and `/admin/` hangs with no
   error. Breaks editing, not serving. Note `prepare-gibraltar.netlify.app` is **deliberately not**
   in `ALLOWED_ORIGINS` — `/admin/` there will hang, because editors stay on the current address
   until cutover.
4. `admin/config.yml`: `site_url` → `https://prepare.gov.gi`.
5. **Test `/admin/` on the new domain** with a full save → review → publish cycle, while every
   address still works.
6. **Retire both old addresses.** Two mechanisms, because they are two hosts:
   - *Netlify* — a host-matched rule in `src/_redirects`:
     `https://prepare-gibraltar.netlify.app/*  https://prepare.gov.gi/:splat  301!`
     A rule with a host in the `from` applies only to that host, and deploy previews live at
     `<hash>--prepare-gibraltar.netlify.app`, a different hostname — so this cannot swallow them.
   - *Cloudflare* — keep the Pages project, stop deploying to it, and add a Bulk Redirect from
     `prepare-gibraltar.pages.dev` to `https://prepare.gov.gi`, 301, subpath matching, preserve path
     suffix and query string. **Do not tick "Include subdomains."** Do not delete the project: the
     address has been shared and a redirect sends those links somewhere useful.
7. **Remove the temporary dual deploy** from `deploy.yml`, and the `CLOUDFLARE_*` secrets once
   nothing uses them. Keep the Cloudflare account — it still hosts the `cms-auth` worker.
8. **Repoint `token-expiry.yml`.** It watches the Cloudflare token, which after step 7 deploys
   nothing, while the Netlify token that does deploy is unmonitored.
9. Update `README.md`, `docs-internal/COMMANDS.md`, the editor guide, and `src/_data/site.json` if
   the name differs from `prepare.gov.gi`.
10. **Expect an NCSC Protective DNS false positive.** `residency.gov.gi` was blocked on UK
    public-sector devices as a new-domain false positive. It does not show on a normal connection, so
    test deliberately from a PDNS-enrolled device about a week after the record lands. Only a
    PDNS-subscribing organisation can request the review; residency's went via Gibraltar House
    London, not ITLD.

`site.baseURL` in `src/_data/site.json` is **inert** — no template reads it — but keep it correct
rather than misleading.

## Content editing

Press Office staff edit at `/admin/` (Decap CMS, `github` backend, editorial workflow). A save opens
a pull request rather than committing to `main`; Publish merges it, which triggers the deploy.
About 90 seconds from Publish to live.

### Publishing is deliberately instant

The `main` ruleset requires a pull request with **0 approving reviews**, and **no required status
check**. Both of those are decisions, not oversights.

A required status check on the build was added on 15 Sept 2026 and **removed the same day**. It
blocked the merge until the build reported, which meant every publish waited ~90 seconds and
publishing inside that window produced `Repository rule violations found — Required status check
"Build and deploy" is expected` — an error a press officer cannot interpret, on the one action this
site exists to make fast. Being told *"the road is closed, change the text"* during an incident has
to be actionable immediately.

**The failure it guarded against is caught instead of prevented.** If a published change breaks the
build, `.github/workflows/deploy.yml` raises an issue titled *"A published change did not reach the
site"*, naming the commit, the failed run, the likely cause and what to do; GitHub also emails
whoever pushed, which for a CMS publish is the editor. The site is never damaged either way —
`npm run check` runs before Eleventy, so nothing bad is uploaded and the previous version keeps
serving. What is lost is only the new change, while the CMS said it worked. That is what the alarm
is for.

**Do not reintroduce a merge-blocking rule to solve a content problem.** If a class of bad edit needs
catching, catch it in `check-contacts.mjs` and let the alarm report it.

### A second editor does not change the ruleset

The obvious move when a second person gets an account is to raise the rule to 1 required approval.
**Do not.** With required reviews on, Decap's Publish merges via the API and fails — decaporg
issues #1019 and #3904 describe it silently failing, closing the pull request and deleting the
branch. The second editor would hit an opaque error and then have to sign into GitHub, find the pull
request, review a diff and merge it, which defeats the point of giving them a CMS.

Peer approval guards against bad *content*; the real control there is that both editors are press
officers publishing their own department's words. Revisit only if the CCU asks for a formal
two-person rule, and if they do, expect to hand editors the GitHub flow.

### Known CMS limits, not bugs

The standalone Media Library uploader and deletion of a published entry both commit directly to
`main` and are rejected by the pull-request rule regardless of approval count. Editors see a red
"Failed to persist media" banner. Images added from inside an entry work correctly; deletions are a
developer job. See `NOTES-INTERNAL.md` for the full runbook.
