# Prepare Gibraltar

**Be informed. Make a plan. Be prepared.**

Official emergency preparedness website for Gibraltar residents, published by HM Government of Gibraltar — Civil Contingencies Unit.

Built with [Eleventy](https://www.11ty.dev/) 3.x, [Decap CMS](https://decapcms.org/) and plain CSS.

**Live:** https://prepare-gibraltar.pages.dev (moving to `prepare.gov.gi` once ITLD add the DNS record)
**Edit:** https://prepare-gibraltar.pages.dev/admin/

The site is hosted on Netlify and also deploys to Cloudflare Pages until the domain moves, so the
address above stays current. Keep editing at the address above — `/admin/` on the Netlify address
will not sign you in until cutover.

---

## 1. Project Overview

Prepare Gibraltar provides:
- Emergency preparedness guidance for Gibraltar residents
- Before / during / after guidance for **18 hazard types**
- Emergency contact information
- Community preparedness resources and downloads
- Guidance for persons with disabilities and those with support needs
- Alerts and warnings information

The site is static, built with Eleventy and edited through Decap CMS, so Press Office staff can update content without touching code.

---

## 2. Prerequisites

- **Node.js** 18 or higher (CI builds on Node 24 LTS)
- **npm** (included with Node.js)

```bash
node --version
```

---

## 3. Install

```bash
git clone <repository-url>
cd prepare-gibraltar
npm install
```

---

## 4. Development Server

```bash
npm start
```

The site is served at `http://localhost:8080` with live reload.

---

## 5. Build

```bash
npm run build
```

Output goes to `_site/` — a complete static site, ready to deploy.

Before the day's changes are pushed, run the full local review:

```bash
npm run review
```

That is the contact check, the build, and an IBM Equal Access accessibility scan of everything in
`_site/`. Then look at the site on `http://localhost:8080` with `npm start`. Development changes go
out as one pull request a day, because every production deploy costs Netlify credits; CMS publishes
are not batched and go live as soon as an editor presses Publish.

Note that `admin/decap-cms.js` is **copied out of `node_modules` at build time**, not committed. The CMS version is governed by `package.json`, so it is visible to `npm audit` and Dependabot. Do not hand-drop a bundle into `admin/`.

---

## 6. Decap CMS — Local Development

**Step 1:** start the Eleventy dev server:
```bash
npm start
```

**Step 2:** in a second terminal, start the Decap local backend:
```bash
npx decap-server
```

**Step 3:** open `http://localhost:8080/admin/`

Locally the CMS reads and writes your working files directly; no Git credentials are needed. This works because `admin/config.yml` sets `local_backend: true`.

> **Leave `local_backend: true` in place.** It is inert in production — Decap only activates it when the page is served from localhost. It does not need removing before deploy.

---

## 7. Deployment

Deploys run in **GitHub Actions**, not from anyone's machine. A push to `main` triggers `.github/workflows/deploy.yml`, which builds with Eleventy and uploads `_site/` to **Netlify**.

During the move to `prepare.gov.gi` the same workflow also pushes production to Cloudflare Pages, so the `pages.dev` address people already have stays current. That step is marked temporary in the workflow and comes out once the new domain is live.

> **Do not connect the Cloudflare Pages project to Git.** The Pages Git integration was used on the previous project and never once built successfully — pushed deployments sat at stage `queued` indefinitely while direct uploads succeeded. The Actions workflow is the deploy path; a Git-connected project only reintroduces that failure.

Manual fallback, if Actions is unavailable:

```bash
npm run build
npx netlify-cli@27 deploy --dir=_site --prod --site 8dfda9be-7094-44cf-99f1-3b9e221c0986
```

---

## 8. Ports and Troubleshooting

| Service | Port |
|---|---|
| Eleventy dev server | 8080 |
| Decap CMS proxy (`decap-server`) | 8081 |

**Kill a stuck port:**
```bash
kill -9 $(lsof -ti:8080)
```

**CMS shows a blank page locally** — both processes must be running: `npm start` on 8080 and `npx decap-server` on 8081. Then open `http://localhost:8080/admin/`.

**Changes not appearing** — the dev server watches files automatically; if it seems stuck, Ctrl+C and run `npm start` again.

**A deploy fails with "No source is recorded for these numbers, and they are published"** — a number appears in the content with no provenance record. Usually this means a number was changed in the CMS and stale copies remain elsewhere, so the old one now matches nothing. The error names every file. Fix it by correcting the stale copies, or — if the number is genuinely right and simply isn't in the register — by adding it to `PAGE_LOCAL` in `check-contacts.mjs` **with the source you checked it against**. If you cannot find a source, do not guess: record it as unverified with the reason.

**A deploy fails with "A WhatsApp link does not match the number printed beside it"** — the `wa.me/350…` href and the visible number have drifted apart. Fix both.

Every published number needs a recorded source; `npm run check` fails the build without one, and `npm run build` runs it first so the manual deploy path is covered too.

**Deploys suddenly stop** — check the `NETLIFY_AUTH_TOKEN_PREPARE_GIBRALTAR` repository secret. Netlify personal access tokens do not expire but can be revoked, and a revoked one fails the deploy step while the site carries on serving the last good version. Replace it at Netlify → User settings → Applications → Personal access tokens, then update the secret **through the GitHub web UI** — a terminal prompt can store an empty value and still report success.

While the Cloudflare deploy is still running in parallel, `.github/workflows/token-expiry.yml` also monitors the `CLOUDFLARE_API_TOKEN` monthly and opens an issue if it becomes invalid. Both that workflow and the parallel deploy step retire together once `prepare.gov.gi` is live.

---

## 9. Updating Content Without Touching Code

All content is editable through the CMS at `/admin/`.

Every change goes through a pull request, so nothing reaches the live site without a deliberate second step — and there is always a full record of what changed and when.

1. Log in at `/admin/` with your GitHub account.
2. Edit a hazard page, the emergency contacts, or the homepage text.
3. Save. This opens a pull request — it does **not** publish.
4. Move the card through **In Review** to **Ready**, then click **Publish**. That merges the pull request and the site is live in a minute or two.

Two rules that matter:

- **Add images only from inside an entry**, never from the standalone Media Library button. The standalone uploader tries to commit directly to `main`, which the branch rule rejects — you will see a red "Failed to persist media" banner. That means you used the wrong button, not that the CMS is broken.
- **Deleting a published page or image** has the same problem, for the same reason. Those have to be done as a pull request by a developer.

> **When a second editor joins, do not change the branch rule.** Raising it to 1 required approval breaks Decap's Publish button — it merges via the API, and with reviews required that fails, closes the pull request and deletes the branch. The second editor would get an unreadable error and then have to review a diff in GitHub, which defeats the point of giving them a CMS. Publishing stays instant; a publish that fails to deploy raises an issue instead of being blocked.

### Hazard pages
Each has separate Before, During and After fields, plus an optional "Further Information and Resources" section. Edit them independently.

### Emergency contacts
The "Emergency Contacts" collection writes `src/_data/contacts.json` — the site's contact register. The emergency contacts page and the homepage panel both render from it, and the phone link is generated from the number, so the two cannot disagree.

**It does not reach the whole site.** Hazard pages, Get Prepared and the disability guidance write numbers into their own text, so changing a number here does not change those. That is exactly why `npm run check` runs first in `npm run build`: if a number no longer matches a copy elsewhere, or is published with no recorded source, the build fails and names every file to fix.

**Every number needs a source.** The CMS has "Date checked" and "Where you checked it" beside each one. They are optional, but a number with no source is reported as unverified on every build and in a monthly issue. If you cannot find a published source, say so rather than guessing — the question that matters is not "is this number correct?" but "is this the number to ring at 3am?"

### Other pages
Every page is editable under **Pages** — the homepage, Get Prepared, Persons with Disabilities, Downloads, the text around the contacts tables, the Hazards page intro, and the 404 page.

Pages built from a list of sections (Get Prepared, Persons with Disabilities) let you add, reorder and delete sections. Get Prepared numbers its headings and builds its "On this page" list automatically, so adding a section renumbers the page and updates its own navigation.

**Leave the Anchor field alone** unless you know what links to that section. It is what `/get-prepared/#be-informed` points at, including the redirect from the old Alerts page.

### Text fields that take markdown
Content fields that can contain links are set to plain markdown rather than the rich-text editor, because the rich-text editor strips the attributes that make external links open in a new tab. On those fields:

| What you want | How to write it |
|---|---|
| **Bold** | `**bold**` |
| A bullet list | `- one` on each line |
| A link | `[text](https://example.com)` |
| A sub-heading | `### Heading` |

---

## 10. Adding a New Hazard Page via the CMS

1. Go to `/admin/` and log in.
2. Select **Hazards**, then **New Hazard**.
3. Fill in Title, Summary, Who is Most at Risk, Before / During / After, and Local Contacts.
4. Save and move to **Ready**, then have the pull request reviewed and merged.

The new hazard appears automatically on `/hazards/` and in the "Other Hazards" list on every hazard page.

---

## Project Structure

```
prepare-gibraltar/
├── eleventy.config.js      # Eleventy configuration
├── package.json
├── admin/
│   ├── index.html          # Decap CMS admin panel
│   └── config.yml          # Decap CMS configuration
├── src/
│   ├── _data/
│   │   └── site.json       # Global site data (contacts, settings)
│   ├── _includes/
│   │   ├── layouts/
│   │   │   ├── base.njk    # HTML shell
│   │   │   ├── page.njk    # Standard content page
│   │   │   └── hazard.njk  # Hazard page with sidebar
│   │   ├── header.njk
│   │   └── footer.njk
│   ├── assets/
│   │   ├── css/style.css
│   │   ├── js/main.js
│   │   ├── images/
│   │   └── downloads/      # Generated PDFs and their HTML twins
│   ├── hazards/            # 18 hazard markdown files
│   ├── index.njk           # Homepage
│   ├── _headers            # Security headers (Cloudflare Pages)
│   ├── _redirects          # 301s (Cloudflare Pages)
│   ├── get-prepared/
│   ├── alerts/
│   ├── emergency-contacts/
│   ├── persons-with-disabilities/
│   ├── downloads/
│   ├── accessibility-statement/
│   ├── privacy-notice/
│   └── cookie-policy/
└── _site/                  # Build output (git-ignored)
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

## Accessibility

This site is built to **WCAG 2.2 AA**, as required by the Disability Act s.18:
- Skip link to main content
- ARIA landmarks throughout
- Focus-visible styles
- Semantic HTML (header, nav, main, footer, article, section, aside)
- Sufficient colour contrast
- Mobile-first responsive design

Test with IBM Equal Access:

```bash
npx achecker --policies IBM_Accessibility,WCAG_2_2 _site
```

Language follows the UN convention and SNDO guidance: "persons with disabilities", never "disabled persons"; "support needs", not "special needs".

---

## Licence

© HM Government of Gibraltar. All rights reserved.
