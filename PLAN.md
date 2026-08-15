# HTML-only GitHub Pages site

Single-page, static, visually impressive. No build step. Host via GitHub Pages from repo root.

## BUILDER

- Add `index.html` at repo root: self-contained HTML/CSS/JS (inline or same-folder `.css`/`.js` only).
- Design: dark cinematic landing, bold typography, gradient/mesh background, glass panels, smooth scroll, CSS motion (no frameworks/CDN).
- Sections: hero + CTA, feature grid, gallery/showcase, footer with GitHub Pages note.
- Add `.nojekyll` so Pages serves files as-is.
- Keep assets local; site must work when opened as `index.html` or via Pages (`https://<user>.github.io/<repo>/`).
- Do not add a server, bundler, or Markdown-rendered pages.

## VERIFIER

- Assert required files exist: `index.html`, `.nojekyll`.
- Parse HTML: one `<html>`, `<head>` with viewport + title, `<body>` with hero/features/gallery/footer.
- Check no external CDNs (`cdn.`, `unpkg`, `jsdelivr`, Google Fonts URLs) and no forbidden server files (`package.json`, `Dockerfile`).
- Confirm inline or local CSS/JS only; relative links; no broken `#`/`./` hrefs to missing files.
- Smoke: file is valid-enough HTML5 and remains readable without JS (content in markup, not injected-only).
