# Prepare Gibraltar

**Be informed. Make a plan. Be prepared.**

Official emergency preparedness website for Gibraltar residents, published by HM Government of Gibraltar — Civil Contingencies Unit.

Built with [Eleventy](https://www.11ty.dev/) 3.x, [Decap CMS](https://decapcms.org/) and plain CSS.

**Live:** https://prepare-gibraltar.pages.dev (moving to `prepare.gov.gi` once DNS is provisioned)
**Edit:** https://prepare-gibraltar.pages.dev/admin/

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

Deploys run in **GitHub Actions**, not from anyone's machine. A push to `main` triggers `.github/workflows/deploy.yml`, which builds with Eleventy and uploads `_site/` to Cloudflare Pages using `wrangler pages deploy`.

> **Do not connect the Cloudflare Pages project to Git.** The Pages Git integration was used on the previous project and never once built successfully — pushed deployments sat at stage `queued` indefinitely while direct uploads succeeded. The Actions workflow is the deploy path; a Git-connected project only reintroduces that failure.

Manual fallback, if Actions is unavailable:

```bash
npm run build
npx wrangler pages deploy _site --project-name=prepare-gibraltar --branch=main
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

**Deploys stop working around September 2027** — the Cloudflare API token expires. Mint a new one (Account → Cloudflare Pages → Edit, that account only) and update the `CLOUDFLARE_API_TOKEN` repository secret.

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

> **When a second editor joins**, raise the branch rule from 0 required approvals to 1. At that point Decap's Publish button stops working — it cannot merge when a review is outstanding — and the flow becomes: editor moves the card to Ready, a second person approves and merges **in GitHub**. Update this section when that happens.

### Hazard pages
Each has separate Before, During and After fields, plus an optional "Further Information and Resources" section. Edit them independently.

### Emergency contacts
Phone numbers live in the "Emergency Contacts" collection, which writes `src/_data/site.json` and populates the whole site.

### Homepage
The hero headline and subheadline are in the "Pages → Homepage" collection.

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
