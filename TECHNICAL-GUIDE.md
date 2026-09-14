# Prepare Gibraltar — Technical Guide

**For:** Site administrator / developer
**Last updated:** March 2026

---

## Project Overview

Prepare Gibraltar is a static website built with:
- **Eleventy** 3.x (ESM) — static site generator
- **Decap CMS** — browser-based content management
- **Plain CSS** — no frameworks
- **Node.js** — required to run locally

Planned hosting: Cloudflare Pages (or equivalent static host)
CMS backend: Decap CMS, `github` backend with editorial workflow, authenticated through a self-hosted Cloudflare Worker OAuth proxy

---

## Project Location

```
prepare-gibraltar/
```

---

## Prerequisites

- Node.js 18 or higher
- npm (included with Node.js)
- A GitHub account (for deployment and CMS backend)

Install Node.js from: https://nodejs.org

---

## Initial Setup (first time only)

```bash
npm install
```

---

## Daily Development

### Start the local dev server
```bash
npm start
```
→ Site available at http://localhost:8080
→ Edits to any file auto-rebuild and refresh the browser
→ Use this same command to restart after closing your terminal

### Start the CMS editor (second terminal)
```bash
npx decap-server
```
→ CMS available at http://localhost:8080/admin/
→ Keep this running alongside `npm start`

### Build the static site (no live server)
```bash
npm run build
```
→ Output goes to `_site/` folder

---

## Project Structure

```
prepare-gibraltar/
├── .eleventy.js              # Eleventy configuration
├── package.json
├── admin/
│   ├── index.html            # Decap CMS admin panel
│   └── config.yml            # Decap CMS configuration
├── src/
│   ├── _data/
│   │   └── site.json         # Global site data (contacts, settings)
│   ├── _includes/
│   │   ├── layouts/
│   │   │   ├── base.njk      # HTML shell
│   │   │   ├── page.njk      # Standard content page
│   │   │   └── hazard.njk    # Hazard page with sidebar
│   │   ├── header.njk
│   │   ├── footer.njk
│   │   └── cookie-banner.njk
│   ├── assets/
│   │   ├── css/style.css
│   │   ├── js/main.js
│   │   └── images/
│   ├── hazards/              # 18 hazard markdown files
│   ├── index.njk             # Homepage
│   ├── get-prepared/
│   ├── get-involved/
│   ├── persons-with-disabilities/
│   ├── alerts/
│   ├── emergency-contacts/
│   ├── downloads/
│   ├── accessibility-statement/
│   ├── privacy-notice/
│   └── cookie-policy/
└── _site/                    # Build output (do not edit directly)
```

---

## Key Files

| What | Where |
|---|---|
| Site name, contact numbers | `src/_data/site.json` |
| Homepage | `src/index.njk` |
| Hazard pages | `src/hazards/` |
| Stylesheet | `src/assets/css/style.css` |
| Header | `src/_includes/header.njk` |
| Footer | `src/_includes/footer.njk` |
| CMS config | `admin/config.yml` |

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

## Ports & Processes

| Service | Port |
|---|---|
| Eleventy dev server | 8080 |
| Decap CMS proxy | 8081 |

### Kill a stuck port
```bash
kill -9 $(lsof -ti:8080)
kill -9 $(lsof -ti:8081)
```

---

## Troubleshooting

### CMS shows blank page
Make sure both terminals are running:
1. `npm start` (port 8080)
2. `npx decap-server` (port 8081)

Then open http://localhost:8080/admin/

### Changes not showing in browser
The dev server watches files automatically. If stuck, Ctrl+C and run `npm start` again.

### Port already in use on restart
```bash
kill -9 $(lsof -ti:8080)
kill -9 $(lsof -ti:8081)
```
Then restart normally.

---

## Deployment Process (when domain is ready)

1. **Register the domain** (likely a .gov.gi — check with CCU/Gibraltar registry)
2. **Push project to GitHub** (create a private repo)
3. **Connect to Cloudflare Pages:**
   - Build command: `npm run build`
   - Output directory: `_site`
   - Auto-deploys on every push to main branch
4. **Point domain DNS to Cloudflare Pages** (Cloudflare provides the values)
5. **SSL** is handled automatically by Cloudflare — free
6. **Configure Decap CMS for production:**
   - Leave `local_backend: true` — it is inert outside localhost and needs no change for production
   - Authentication is the `github` backend via the Cloudflare Worker OAuth proxy; do not use Git Gateway or Netlify Identity
   - Create editor accounts for colleagues
   - Share the COLLEAGUE-GUIDE.md with editors, updating the [PLACEHOLDERS]

---

## Accessibility

Built to WCAG 2.2 AA:
- Skip link to main content
- ARIA landmarks throughout
- Focus-visible styles
- Semantic HTML
- Sufficient colour contrast
- Mobile-first responsive design

---

## Hazards Covered (12 total)

1. Cyber
2. Domestic Fire
3. Extreme Heat
4. Flooding
5. Hazardous Materials
6. Infectious Disease
7. Overseas Emergencies
8. Power Cuts
9. Storms
10. Terrorism
11. Water Outages
12. Wildfire

---

*© HM Government of Gibraltar. All rights reserved.*
