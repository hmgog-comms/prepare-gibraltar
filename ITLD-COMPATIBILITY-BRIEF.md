# Technical Compatibility Brief — Prepare Gibraltar
**Prepared for:** Information Technology and Logistics Department (ITLD)  
**Prepared by:** Civil Contingencies Unit  
**Date:** 27 April 2026  
**Target domain:** https://prepare.gov.gi

> **Status update, September 2026 — this brief is partly superseded.**
> The hosting and CMS questions in sections 7 and 8 have since been decided: the site is owned and
> hosted by the Press Office on Cloudflare Pages, deployed from GitHub Actions, with Decap CMS on the
> `github` backend. **The only outstanding item for ITLD is DNS for `prepare.gov.gi`.** Sections 1-6
> remain accurate as a description of the site's portability.

---

## 1. What this site is

Prepare Gibraltar is a **static website** — a set of pre-built HTML, CSS, and image files with no server-side code, no database, and no application runtime. It is generated from Markdown content files using **Eleventy** (an open-source Node.js static site generator), then deployed as a folder of files to a web host.

There is no login system, no CMS backend in production, and no connection to any internal HMGoG network. The site is as simple as a web server can be: it serves files.

---

## 2. Infrastructure audit — portability

### Is it Cloudflare-specific?

No. The build output (`_site/`) is a plain directory of static files:

```
_site/
  index.html
  hazards/
    earthquake/index.html
    flood/index.html
    ...
  assets/
    css/style.css
    js/main.js
    images/
```

This directory can be hosted on **any web server** that can serve static files — Apache, Nginx, IIS, a CDN, or a cloud storage bucket. It has zero dependencies on Cloudflare-specific features (no Workers, no Cloudflare Pages Functions, no Cloudflare Access rules, no Durable Objects).

Cloudflare Pages is used purely as a static host. Deployment is driven by GitHub Actions, which builds the site and uploads the output directory — the Pages Git integration is deliberately not used. Switching to a different host requires:
1. Running `npm run build` (or equivalent CI step) to produce `_site/`
2. Uploading/copying `_site/` to the new host
3. Pointing the DNS record to the new host

### CMS in production

The CMS (Decap CMS, accessed at `/admin/`) runs entirely in the browser. In production it can be configured to commit directly to the Git repository via GitHub OAuth. **No CMS server process runs alongside the website.** Content editors visit `/admin/`, authenticate with GitHub, and their changes are raised as pull requests. Once a second person approves and merges, the build pipeline rebuilds and redeploys the site.

This means a hosting provider only needs to serve static files. There is no PHP, Python, Node, or database requirement for the live site.

---

## 3. Node.js environment

### Current runtime

- **Local development machine:** Node.js v25.6.1
- **Eleventy version installed:** 3.1.2 (locked in `package-lock.json`)

### Compatibility with government servers

Eleventy 3.x requires **Node.js 18 or later**. The recommended stable version for a new deployment environment is **Node.js 22 LTS** (long-term support, supported until April 2027) or **Node.js 24 LTS** (supported until April 2029, released April 2025).

> **Recommendation:** If ITLD provisions a build machine or CI runner, request Node.js 22 LTS or 24 LTS. Either will work without any changes to the project.

**Important:** Node.js is only needed at **build time** — to run `npm run build` and generate the `_site/` folder. The live website itself never runs Node. If the CI/CD pipeline is managed by ITLD, they can run the build step on any standard Linux or Windows machine with Node installed, then copy the output folder to the web server.

---

## 4. Dependency review

### Production dependencies (shipped to the live website)

| Package | Version | Purpose | Risk |
|---|---|---|---|
| `pdf-lib` | 1.17.1 | Client-side PDF generation for emergency checklists | Low — runs entirely in the user's browser; no external calls. |

### Build-time dependencies (not shipped to the live website)

| Package | Version | Purpose | Risk |
|---|---|---|---|
| `@11ty/eleventy` | 3.1.2 | Static site generator | Low — well-established, MIT licence. Used only during the build step. |
| `decap-cms` | 3.10.1 | CMS UI asset, copied into `/admin/` at build time | Low — open source, MIT licence. Runs in the browser; no server component. |
| `markdown-it` | (transitive) | Markdown rendering | Low — standard dependency. |

### External network calls from the built site

None in the current configuration. There are no CDN-loaded fonts, no Google Analytics (the `analyticsID` field in `site.json` is blank), no third-party scripts, and no API calls. The site is entirely self-contained once built.

> **For a restricted government network:** The live site will function correctly with no outbound internet access from the server, and no inbound access beyond standard HTTPS on port 443. The build step requires `npm install` once (downloads packages from the npm registry); subsequent builds can run fully offline if `node_modules/` is preserved.

---

## 5. URL and domain plan

### Current state

`site.json` already contains the target domain:

```json
"baseURL": "https://prepare.gov.gi"
```

No template or source file hardcodes a site domain. Note that `site.baseURL` is **not currently read by any template** — it is inert, and changing it alone has no effect on the build output. The remaining `prepare.gov.gi` strings are display text in the printable download documents, not links.

### What changes for .gov.gi launch

1. **DNS:** ITLD points `prepare.gov.gi` at the new host's IP address or CDN endpoint.
2. **TLS certificate:** The host provisions an HTTPS certificate for `prepare.gov.gi` (standard Let's Encrypt or ITLD-managed certificate).
3. **CMS backend:** `admin/config.yml` uses the `github` backend with a GitHub OAuth app registered under the Press Office account, authenticated through a self-hosted Cloudflare Worker. At the `.gov.gi` cutover the only changes are `site_url` in `admin/config.yml` and adding the new origin to the Worker's allow-list. Neither affects the public-facing site.
4. **No code changes required** to the site itself.

---

## 6. Why a static site is the right choice for ITLD

### Security

A static site has **no attack surface** that a dynamic site would have. There is no:
- Web application framework with CVEs to patch
- Database with SQL injection exposure
- Server-side session management
- Application secrets on the server

The only security concern is the web server software itself (Apache/Nginx/IIS), which ITLD already manages for other `.gov.gi` properties.

### Maintenance burden

Once deployed, the site requires no ongoing maintenance from ITLD beyond:
- Renewing the TLS certificate (typically automated)
- Applying OS/web-server security patches (same as any other `.gov.gi` site)

Content updates are made by Press Office staff via the `/admin/` CMS interface and do not require ITLD involvement.

### Performance

Static files are served directly from disk or CDN with no per-request processing. The site will load quickly on any connection speed, which is critical during an emergency when residents are accessing it under stress.

### Comparison with SharePoint

| Factor | Static site (this) | SharePoint |
|---|---|---|
| Hosting requirement | Any web server | SharePoint farm or SharePoint Online |
| Public internet access | Yes, trivially | Requires additional configuration/licencing |
| Custom domain (`.gov.gi`) | Standard DNS | Complex URL rewriting or vanity domain config |
| Mobile performance | Optimised — 50–100 KB page | Typically 1–5 MB+ page weight |
| Offline access / PDF download | Built in | Not practical |
| Content editing | Browser-based CMS | SharePoint editor |
| Security patching | Web server only | SharePoint platform + all dependencies |

---

## 7. Recommended hosting options for ITLD

In order of simplicity:

### Option A — Cloudflare Pages (current, keep)
- No server to manage; ITLD adds a CNAME record pointing `prepare.gov.gi` to the Cloudflare Pages URL.
- Free tier covers the site's needs. Cloudflare is a reputable UK/EU-accessible CDN with data centres in London.
- Requires HMGoG to maintain a Cloudflare account.

### Option B — Third-party UK static hosting (e.g. AWS S3 + CloudFront, Azure Static Web Apps)
- Files uploaded to a UK-region storage bucket; CDN serves them globally.
- AWS and Azure both have UK data centres and UK government framework agreements (G-Cloud).
- Build step runs in GitHub Actions (free for public repos) or ITLD's own CI runner; output is pushed to the bucket.

### Option C — ITLD-managed web server
- ITLD provisions an Apache or Nginx virtual host on an existing `.gov.gi` server.
- Build step runs on any machine with Node.js; output folder is copied to the server via SSH/SCP or a standard deployment pipeline.
- No new server needed if a suitable one already exists.
- This option gives ITLD full control and keeps everything on-island.

All three options are technically equivalent from the site's perspective. The decision is a matter of ITLD's infrastructure preferences and data residency requirements.

---

## 8. Summary checklist for ITLD

- [x] Static site — no server-side runtime in production
- [x] No Cloudflare-specific features — fully portable
- [x] Target domain (`prepare.gov.gi`) already set in config
- [x] No hardcoded preview domain in templates
- [x] No external dependencies loaded at runtime
- [x] Node.js 22 LTS or 24 LTS required for build step only
- [x] TLS certificate required on new host
- [x] ~~CMS backend config needs updating when going live~~ — done, `github` backend in place
- [x] ~~ITLD to confirm preferred hosting option (A, B, or C above)~~ — **decided Sept 2026:** the
      Press Office hosts the site on its own Cloudflare Pages account. No decision needed from ITLD.
- [x] ~~ITLD to advise on GitHub OAuth app registration for CMS~~ — resolved: a self-hosted Cloudflare
      Worker acts as the OAuth proxy, with the app registered under the Press Office account.
- [ ] **ITLD to provision the DNS record for `prepare.gov.gi`** — the single remaining item.

Once DNS is in place the cutover is: add `prepare.gov.gi` as a custom domain on the Pages project,
wait for the TLS certificate, then update `site_url` in `admin/config.yml` and add the new origin to
the OAuth Worker's allow-list.
