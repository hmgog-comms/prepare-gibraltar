# Prepare Gibraltar — Command Reference

## Every Day Dev

### Start the local dev server
```bash
npm start
```
→ Site available at http://localhost:8080
→ Edits to any file auto-rebuild and refresh the browser
→ Use this same command to restart after closing Claude or your terminal

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

## Sharing a Preview

### Quick anonymous preview link (free, random URL)
```bash
npx cloudflared tunnel --url http://localhost:8080
```
→ Gives you a public URL like `https://random-words.trycloudflare.com`
→ Share this link — valid until you Ctrl+C

### Branch previews
Every pull request gets its own Cloudflare Pages preview URL automatically, posted onto the
pull request by the deploy workflow. For CMS edits this is the link a reviewer should check
before approving — no tunnel needed.

---

## Ports & Processes

| Service | Port |
|---|---|
| Eleventy dev server | 8080 |
| Decap CMS proxy | 8081 |
| Cloudflare tunnel metrics | 20241 |

### Kill a stuck port
```bash
kill -9 $(lsof -ti:8081)
```
Replace `8081` with whichever port is stuck.

---

## Troubleshooting

### CMS shows blank page
Make sure both terminals are running:
1. `npm start` (port 8080)
2. `npx decap-server` (port 8081)
Then open http://localhost:8080/admin/

### Changes not showing in browser
The dev server watches files automatically — if it seems stuck, Ctrl+C and run `npm start` again.

### Port already in use on restart
```bash
kill -9 $(lsof -ti:8080)
kill -9 $(lsof -ti:8081)
```
Then restart normally.

---

## Deployment (Cloudflare Pages)

Deploys run in GitHub Actions. Pushing to `main` triggers `.github/workflows/deploy.yml`,
which builds and uploads `_site/` with `wrangler pages deploy`.

> **Do not connect the Cloudflare Pages project to Git.** That integration was used on the
> previous project and never built once — pushed deployments sat at stage `queued` forever
> while direct uploads succeeded.

Manual fallback if Actions is unavailable:
```bash
npm run build
npx wrangler pages deploy _site --project-name=prepare-gibraltar --branch=main
```

---

## Key File Locations

| What | Where |
|---|---|
| Site name, contact numbers | `src/_data/site.json` |
| Homepage | `src/index.njk` |
| Hazard pages | `src/hazards/` |
| Stylesheet | `src/assets/css/style.css` |
| Header | `src/_includes/header.njk` |
| Footer | `src/_includes/footer.njk` |
| CMS config | `admin/config.yml` |
