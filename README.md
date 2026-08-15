# Trine

A cinematic, HTML-only site for the 2020 AgentView mission sandbox. Three agents in harmonic aspect — Architect, Builder, Witness — rendered as a night atlas you can host on GitHub Pages.

No build step. No framework. Open `index.html` or serve the repository root.

## Preview locally

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## GitHub Pages

1. Repo **Settings → Pages**
2. Source: **Deploy from a branch**
3. Branch: `main`, folder: `/ (root)`
4. The site will publish at `https://luis-alarcon-p6.github.io/2020-mission-sandbox/`

Relative asset paths are used so the site works both at the domain root and as a project page.

## Files

| Path | Role |
| --- | --- |
| `index.html` | Landing observatory |
| `404.html` | Matching lost-in-the-dark page |
| `assets/css/site.css` | Atmosphere, type, layout |
| `assets/js/site.js` | Cursor, starfield, clock, signal |
| `assets/favicon.svg` | Trine mark |
| `.nojekyll` | Skip Jekyll processing on Pages |
