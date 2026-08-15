# Testing the HTML-only GitHub Pages site

These are independent acceptance tests for the static site described in `PLAN.md` (and the swarm mission): a visually impressive **HTML-only** page hosted with **GitHub Pages** from the repository root.

## Run tests

Node.js **18+** is required (built-in test runner and `fetch`). There are **no npm dependencies**.

```bash
npm test
```

That runs `node --test` (plain Node, no Jest/Mocha/Playwright). Equivalent:

```bash
node --test
```

Node discovers `*.test.js` files (including `test/site.test.js`).

`npm install` is optional. This `package.json` exists only so `npm test` works; the site itself must not need Node, a bundler, or a server.

## What the tests cover

| Area | Checks |
|------|--------|
| Required files | `index.html` and `.nojekyll` at repo root |
| HTML5 document | `<!DOCTYPE html>`, a single `<html>`, `<head>` with charset, viewport, and non-empty `<title>`, plus `<body>` |
| Sections | Hero + CTA, feature grid, gallery/showcase, footer that mentions GitHub Pages |
| Static-only | No Dockerfile/server entry, no CDN/framework URLs, CSS/JS inline or local relative files |
| Assets | Relative links; local `href`/`src`/`url()` files exist |
| Visual design | Dark cinematic look, gradient/mesh, glass panels, CSS motion, smooth scroll |
| No-JS content | Hero/features/gallery/footer copy lives in markup (not injected by JavaScript) |
| Smoke | A tiny static HTTP server serves `index.html` (and linked local CSS/JS) with **200** |

Tests parse files on disk. They do not open a browser.

## Site contract the tests expect

### Layout (GitHub Pages)

- Host from the **repository root** (not `/docs`).
- `index.html` is the homepage; `.nojekyll` tells Pages to skip Jekyll.
- The page must work as a local file and at `https://<user>.github.io/<repo>/`, so asset URLs are **relative** (`styles.css`, `./app.js`) — not root-absolute (`/styles.css`) and not `http(s):` CDNs.

### Markup

- Valid-enough HTML5: doctype, one `<html>`, `<head>`, `<body>`.
- `<meta charset>` and `<meta name="viewport" …>`.
- `<title>` with real text.
- Landmarks named in `id`, `class`, `aria-label`, or a heading: **hero**, **features** (or a grid of 3+ `<article>` cards), **gallery** or **showcase** (or 3+ `<figure>` tiles), and a `<footer>` (or footer landmark).
- A CTA control (`<a>` or `<button>`) in/near the hero.
- Page copy includes the phrase **GitHub Pages** (typically in the footer).

### CSS / JS

- Styles and scripts are **inline** or **local relative files** (same folder or a subfolder such as `assets/css/site.css`). Root-absolute paths (`/styles.css`) break project Pages.
- No external CDNs: `cdn.`, `unpkg`, `jsdelivr`, `cdnjs`, Google Fonts (`fonts.googleapis`, `fonts.gstatic`), Tailwind/Bootstrap CDNs, etc.
- Combined CSS should include:
  - a **dark** page background
  - **gradient** or mesh (`linear-gradient`, `radial-gradient`, or `conic-gradient`)
  - **glass** (`backdrop-filter` and/or translucent `rgba`/`hsla`)
  - **motion** (`transition`, `animation`, or `@keyframes`)
  - **smooth scroll** (`scroll-behavior: smooth`)

### Not a web app backend

The site must not require a server to view. Tests fail if they find:

- `Dockerfile`, `docker-compose.yml`
- Express-style `src/server.js` / `src/app.js`
- `.js` files outside `test/` that call `createServer` / `listen` / `express`
- `.php` files
- `express` / `fastify` / `koa` / `next` / `vite` / `webpack` / `parcel` in `package.json` dependencies
- an `npm start` script

Same-folder client scripts such as `app.js` are allowed. `package.json` for **tests only** (this file) is allowed.

## How this relates to the Builder

The Builder implements the page on another branch. On this tests-only branch, `npm test` is expected to **fail** until `index.html` and `.nojekyll` exist. After the site lands, remaining failures are contract gaps (for example Google Fonts CDNs, or a missing gallery/showcase landmark).
