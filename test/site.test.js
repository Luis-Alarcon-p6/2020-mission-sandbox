'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.resolve(path.join(__dirname, '..'));

const CDN_RE =
  /cdn\.|unpkg|jsdelivr|cdnjs|fonts\.googleapis|fonts\.gstatic|ajax\.googleapis|bootstrapcdn|fontawesome\.com|tailwindcss\.com|code\.jquery|unpkg\.com/i;

const FORBIDDEN_SERVER_FILES = [
  'Dockerfile',
  'docker-compose.yml',
  'docker-compose.yaml',
  'src/server.js',
  'src/app.js',
];

const FORBIDDEN_DEPS = [
  'express',
  'fastify',
  'koa',
  'next',
  'vite',
  'webpack',
  'parcel',
  'react',
  'vue',
  'svelte',
];

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function walkFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, acc);
    else acc.push(full);
  }
  return acc;
}

function stripComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, '');
}

function attr(tag, name) {
  const re = new RegExp(
    `${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    'i'
  );
  const m = tag.match(re);
  if (!m) return null;
  return m[1] ?? m[2] ?? m[3] ?? null;
}

function tags(html, name) {
  const re = new RegExp(`<${name}\\b[^>]*>`, 'gi');
  return [...html.matchAll(re)].map((m) => m[0]);
}

function paired(html, name) {
  const re = new RegExp(`<${name}\\b([^>]*)>([\\s\\S]*?)</${name}>`, 'gi');
  return [...html.matchAll(re)].map((m) => ({
    open: m[0],
    attrs: m[1],
    inner: m[2],
  }));
}

function hasLandmark(html, names) {
  for (const name of names) {
    const n = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(
      [
        `<${n}\\b`,
        `\\bid=["'][^"']*\\b${n}\\b[^"']*["']`,
        `\\bclass=["'][^"']*\\b${n}\\b[^"']*["']`,
        `aria-label=["'][^"']*${n}[^"']*["']`,
        `<h[1-6][^>]*>[^<]*\\b${n}\\b`,
      ].join('|'),
      'i'
    );
    if (re.test(html)) return true;
  }
  return false;
}

function hasCta(html) {
  if (/<button\b/i.test(html)) return true;
  for (const tag of tags(html, 'a')) {
    const hay = `${attr(tag, 'class') || ''} ${attr(tag, 'id') || ''} ${attr(tag, 'role') || ''}`;
    if (/\b(cta|btn|button)\b/i.test(hay)) return true;
  }
  const heroOpen = html.match(/<[^>]+hero[^>]*>/i);
  if (!heroOpen) return false;
  const start = html.indexOf(heroOpen[0]);
  const slice = html.slice(start, start + 4000);
  const end = slice.search(/<\/(section|header|div|article)>/i);
  const region = end === -1 ? slice : slice.slice(0, end);
  return /<a\b/i.test(region);
}

function textOf(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function isHttpUrl(url) {
  return /^(https?:)?\/\//i.test(url);
}

function isIgnorableRef(url) {
  if (!url) return true;
  const trimmed = url.trim();
  if (!trimmed || trimmed === '#') return true;
  if (/^(mailto:|tel:|javascript:|data:)/i.test(trimmed)) return true;
  if (trimmed.startsWith('#')) return true;
  if (/^%23/i.test(trimmed)) return true; // encoded #fragment (SVG filters inside data URIs)
  return false;
}

function localPath(url) {
  const cleaned = url.trim().split(/[?#]/)[0];
  if (!cleaned || isHttpUrl(cleaned) || cleaned.startsWith('/')) return null;
  return cleaned.replace(/^\.\//, '');
}

function extractCss(html) {
  const chunks = [];
  for (const block of paired(html, 'style')) chunks.push(block.inner);
  for (const tag of tags(html, 'link')) {
    const rel = attr(tag, 'rel') || '';
    if (!/\bstylesheet\b/i.test(rel)) continue;
    const href = attr(tag, 'href');
    const relPath = href && localPath(href);
    if (relPath && exists(relPath)) chunks.push(read(relPath));
  }
  return chunks.join('\n');
}

function cssUrls(css) {
  return [...css.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi)].map((m) =>
    m[2].trim()
  );
}

function collectLocalRefs(html, css) {
  const refs = [];
  for (const tag of tags(html, 'link')) {
    const href = attr(tag, 'href');
    if (href) refs.push({ kind: 'link', url: href });
  }
  for (const tag of tags(html, 'script')) {
    const src = attr(tag, 'src');
    if (src) refs.push({ kind: 'script', url: src });
  }
  for (const tag of [...tags(html, 'img'), ...tags(html, 'source'), ...tags(html, 'video'), ...tags(html, 'audio')]) {
    const src = attr(tag, 'src');
    if (src) refs.push({ kind: 'media', url: src });
    const srcset = attr(tag, 'srcset');
    if (srcset) {
      for (const part of srcset.split(',')) {
        const u = part.trim().split(/\s+/)[0];
        if (u) refs.push({ kind: 'media', url: u });
      }
    }
  }
  for (const tag of tags(html, 'a')) {
    const href = attr(tag, 'href');
    if (href) refs.push({ kind: 'anchor', url: href });
  }
  for (const url of cssUrls(css)) refs.push({ kind: 'css-url', url });
  return refs;
}

const indexPath = path.join(ROOT, 'index.html');
const html = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8') : '';
const markup = html ? stripComments(html) : '';
const css = html ? extractCss(markup) : '';
const noJsHtml = markup.replace(/<script\b[\s\S]*?<\/script>/gi, ' ');

describe('GitHub Pages static site', () => {
  describe('required files', () => {
    it('has index.html at the repository root', () => {
      assert.ok(
        exists('index.html'),
        'GitHub Pages from repo root requires index.html next to README.md'
      );
    });

    it('has .nojekyll so Pages serves files as-is', () => {
      assert.ok(
        exists('.nojekyll'),
        'Add an empty .nojekyll file at the repo root (PLAN.md)'
      );
    });
  });

  describe('HTML5 document', () => {
    it('starts with an HTML5 doctype', () => {
      assert.ok(html, 'index.html is missing');
      assert.match(html.trimStart(), /<!DOCTYPE html>/i);
    });

    it('has exactly one <html> element', () => {
      assert.ok(html, 'index.html is missing');
      assert.equal((html.match(/<html\b/gi) || []).length, 1);
      assert.match(html, /<\/html>/i);
    });

    it('has <head> with charset, viewport, and a non-empty title', () => {
      assert.ok(html, 'index.html is missing');
      const heads = paired(html, 'head');
      assert.equal(heads.length, 1, 'expected a single <head>');
      const head = heads[0].inner;
      assert.match(head, /<meta\b[^>]*charset\s*=/i, 'missing <meta charset>');
      const viewport = tags(head, 'meta').some((tag) => {
        const name = attr(tag, 'name') || '';
        const content = attr(tag, 'content') || '';
        return /^viewport$/i.test(name) && /width\s*=/i.test(content);
      });
      assert.ok(viewport, 'missing <meta name="viewport" content="width=...">');
      const titles = paired(head, 'title');
      assert.ok(titles.length >= 1, 'missing <title>');
      assert.ok(titles[0].inner.trim().length > 0, '<title> is empty');
    });

    it('has a <body>', () => {
      assert.ok(html, 'index.html is missing');
      assert.match(html, /<body\b/i);
      assert.match(html, /<\/body>/i);
    });
  });

  describe('required sections', () => {
    it('includes a hero section with a CTA', () => {
      assert.ok(html, 'index.html is missing');
      assert.ok(hasLandmark(markup, ['hero']), 'missing hero landmark (id/class/heading)');
      assert.ok(
        hasCta(markup),
        'hero should include a CTA (<a class="cta|btn"> or <button>)'
      );
    });

    it('includes a features / feature-grid section', () => {
      assert.ok(html, 'index.html is missing');
      const named = hasLandmark(markup, [
        'features',
        'feature',
        'feature-grid',
        'featuregrid',
      ]);
      const grid = (markup.match(/<article\b/gi) || []).length >= 3;
      assert.ok(
        named || grid,
        'missing features landmark (id/class/heading) or a grid of 3+ <article> cards'
      );
    });

    it('includes a gallery or showcase section', () => {
      assert.ok(html, 'index.html is missing');
      const named = hasLandmark(markup, ['gallery', 'showcase']);
      const figures = (markup.match(/<figure\b/gi) || []).length >= 3;
      assert.ok(
        named || figures,
        'missing gallery/showcase landmark (id/class/heading) or 3+ <figure> tiles'
      );
    });

    it('includes a footer that mentions GitHub Pages', () => {
      assert.ok(html, 'index.html is missing');
      assert.ok(
        /<footer\b/i.test(markup) || hasLandmark(markup, ['footer']),
        'missing <footer>'
      );
      assert.match(
        textOf(markup),
        /github\s*pages/i,
        'footer (or page copy) must mention GitHub Pages'
      );
    });
  });

  describe('static-only: no backend, no CDN', () => {
    it('does not ship server / container entry files', () => {
      const found = FORBIDDEN_SERVER_FILES.filter((rel) => exists(rel));
      assert.deepEqual(
        found,
        [],
        `HTML-only site must not include ${found.join(', ')}`
      );
    });

    it('does not include PHP (or other server-rendered) pages', () => {
      const bad = walkFiles(ROOT).filter((file) =>
        /\.(php|aspx|jsp|erb)$/i.test(file)
      );
      assert.deepEqual(
        bad.map((f) => path.relative(ROOT, f)),
        [],
        'server-rendered templates are not allowed'
      );
    });

    it('does not depend on a bundler or Node web framework', () => {
      if (!exists('package.json')) return;
      const pkg = JSON.parse(read('package.json'));
      const deps = {
        ...(pkg.dependencies || {}),
        ...(pkg.devDependencies || {}),
      };
      const found = FORBIDDEN_DEPS.filter((name) => deps[name]);
      assert.deepEqual(
        found,
        [],
        `remove runtime/bundler deps: ${found.join(', ')} (tests may keep an empty package.json)`
      );
      assert.ok(
        !pkg.scripts || !pkg.scripts.start,
        'do not add npm start — GitHub Pages serves static files'
      );
    });

    it('keeps JavaScript client-side (no HTTP server)', () => {
      const serverish =
        /require\(['"]express['"]\)|from\s+['"]express['"]|createServer\s*\(|\blisten\s*\(/;
      const offenders = walkFiles(ROOT)
        .filter((file) => file.endsWith('.js'))
        .filter((file) => !path.relative(ROOT, file).startsWith('test' + path.sep))
        .filter((file) => serverish.test(fs.readFileSync(file, 'utf8')))
        .map((file) => path.relative(ROOT, file));
      assert.deepEqual(
        offenders,
        [],
        `client JS must not start a server: ${offenders.join(', ')}`
      );
    });

    it('does not load scripts or styles from CDNs', () => {
      assert.ok(html, 'index.html is missing');
      const haystack = [markup, css].join('\n');
      assert.equal(
        CDN_RE.test(haystack),
        false,
        'PLAN.md forbids cdn./unpkg/jsdelivr/Google Fonts and similar CDNs'
      );
    });
  });

  describe('local assets', () => {
    it('uses only inline or local relative CSS and JS', () => {
      assert.ok(html, 'index.html is missing');
      const sheets = tags(markup, 'link').filter((tag) =>
        /\bstylesheet\b/i.test(attr(tag, 'rel') || '')
      );
      for (const tag of sheets) {
        const href = attr(tag, 'href') || '';
        assert.equal(isHttpUrl(href), false, `stylesheet must be local: ${href}`);
        assert.equal(
          href.startsWith('/'),
          false,
          `use a relative stylesheet path (not root-absolute): ${href}`
        );
        const relPath = localPath(href);
        assert.ok(relPath, `stylesheet href is not a local relative path: ${href}`);
        assert.equal(
          relPath.split(/[\\/]/).includes('..'),
          false,
          `stylesheet must stay inside the repo: ${href}`
        );
      }
      for (const tag of tags(markup, 'script')) {
        const src = attr(tag, 'src');
        if (!src) continue;
        assert.equal(isHttpUrl(src), false, `script must be local: ${src}`);
        assert.equal(
          src.startsWith('/'),
          false,
          `use a relative script path (not root-absolute): ${src}`
        );
        const relPath = localPath(src);
        assert.ok(relPath, `script src is not a local relative path: ${src}`);
        assert.equal(
          relPath.split(/[\\/]/).includes('..'),
          false,
          `script must stay inside the repo: ${src}`
        );
      }
      const hasStyle =
        paired(markup, 'style').some((b) => b.inner.trim().length > 0) ||
        sheets.length > 0;
      assert.ok(hasStyle, 'page needs inline <style> or a local stylesheet');
    });

    it('has no broken local href/src/url() files', () => {
      assert.ok(html, 'index.html is missing');
      const missing = [];
      for (const ref of collectLocalRefs(markup, css)) {
        if (isIgnorableRef(ref.url)) continue;
        if (isHttpUrl(ref.url)) continue; // off-site URLs are covered by the CDN test
        if (ref.url.startsWith('/')) {
          missing.push(`${ref.kind} is root-absolute (breaks project Pages): ${ref.url}`);
          continue;
        }
        const relPath = localPath(ref.url);
        if (!relPath) continue;
        if (ref.kind === 'anchor' && !/\.[a-z0-9]+$/i.test(relPath)) {
          if (exists(relPath) || exists(relPath + '.html')) continue;
          if (!/\.(html?|css|js|png|jpe?g|gif|svg|webp|ico|woff2?|ttf)$/i.test(relPath)) {
            continue;
          }
        }
        if (!exists(relPath)) missing.push(`${ref.kind} -> ${ref.url}`);
      }
      assert.deepEqual(missing, [], `broken local asset refs:\n${missing.join('\n')}`);
    });
  });

  describe('visual design', () => {
    it('uses a dark cinematic background', () => {
      assert.ok(html, 'index.html is missing');
      const darkHex = /background[^;]{0,160}#(?:0|1)[0-9a-f]{2,5}/i.test(css);
      const darkRgb = /background[^;]{0,160}rgba?\(\s*\d{1,2}\s*,\s*\d{1,2}\s*,\s*\d{1,2}/i.test(css);
      const scheme = /color-scheme\s*:\s*dark/i.test(css);
      const gradientBg = /background[^;]{0,400}(?:linear-gradient|radial-gradient|conic-gradient)/i.test(css);
      const darkToken = /#(?:0|1)[0-9a-f]{2,5}/i.test(css) && /background/i.test(css);
      assert.ok(
        darkHex || darkRgb || scheme || gradientBg || darkToken,
        'expected a dark page background (dark hex/rgb, color-scheme: dark, or gradient backdrop)'
      );
    });

    it('includes a gradient or mesh background', () => {
      assert.ok(html, 'index.html is missing');
      assert.match(
        css,
        /linear-gradient|radial-gradient|conic-gradient/i,
        'expected CSS gradient/mesh (linear-gradient, radial-gradient, or conic-gradient)'
      );
    });

    it('includes glass panels', () => {
      assert.ok(html, 'index.html is missing');
      const glass =
        /backdrop-filter\s*:/i.test(css) ||
        /rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*(0?\.\d+|0|1)\s*\)/i.test(css) ||
        /hsla?\(\s*[\d.]+\s*,\s*[\d.]+%\s*,\s*[\d.]+%\s*,\s*(0?\.\d+|0|1)\s*\)/i.test(css);
      assert.ok(
        glass,
        'expected glass styling (backdrop-filter and/or translucent rgba/hsla fills)'
      );
    });

    it('includes CSS motion', () => {
      assert.ok(html, 'index.html is missing');
      assert.match(
        css,
        /@keyframes\b|\banimation\s*:|\btransition\s*:/i,
        'expected CSS motion (transition, animation, or @keyframes)'
      );
    });

    it('enables smooth scrolling', () => {
      assert.ok(html, 'index.html is missing');
      assert.match(
        css,
        /scroll-behavior\s*:\s*smooth/i,
        'expected scroll-behavior: smooth'
      );
    });
  });

  describe('readable without JavaScript', () => {
    it('keeps hero, features, gallery, and footer content in markup', () => {
      assert.ok(html, 'index.html is missing');
      const text = textOf(noJsHtml);
      assert.ok(
        text.length >= 180,
        `expected substantial copy in HTML without JS (got ${text.length} chars)`
      );
      assert.ok(hasLandmark(noJsHtml, ['hero']), 'hero disappears if scripts are stripped');
      const featuresRemain =
        hasLandmark(noJsHtml, ['features', 'feature', 'feature-grid', 'featuregrid']) ||
        (noJsHtml.match(/<article\b/gi) || []).length >= 3;
      assert.ok(featuresRemain, 'features disappear if scripts are stripped');
      const galleryRemain =
        hasLandmark(noJsHtml, ['gallery', 'showcase']) ||
        (noJsHtml.match(/<figure\b/gi) || []).length >= 3;
      assert.ok(galleryRemain, 'gallery disappears if scripts are stripped');
      assert.ok(
        /<footer\b/i.test(noJsHtml) || hasLandmark(noJsHtml, ['footer']),
        'footer disappears if scripts are stripped'
      );
    });
  });
});

describe('static HTTP smoke', { concurrency: false }, () => {
  let server;
  let baseUrl;

  before(async () => {
    if (!exists('index.html')) return;
    server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
      const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\//, '');
      const file = path.normalize(path.join(ROOT, rel));
      if (!file.startsWith(ROOT)) {
        res.writeHead(403);
        res.end();
        return;
      }
      fs.readFile(file, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('not found');
          return;
        }
        const types = {
          '.html': 'text/html; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.js': 'text/javascript; charset=utf-8',
          '.svg': 'image/svg+xml',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.webp': 'image/webp',
          '.ico': 'image/x-icon',
        };
        res.writeHead(200, {
          'content-type': types[path.extname(file).toLowerCase()] || 'application/octet-stream',
        });
        res.end(data);
      });
    });
    await new Promise((resolve, reject) => {
      server.listen(0, '127.0.0.1', resolve);
      server.once('error', reject);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    if (!server) return;
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('serves index.html as text/html', async () => {
    assert.ok(baseUrl, 'index.html is missing');
    const res = await fetch(baseUrl + '/');
    const body = await res.text();
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /text\/html/i);
    assert.match(body, /<html\b/i);
    assert.match(body, /<title>/i);
  });

  it('serves linked local stylesheets and scripts', async () => {
    assert.ok(baseUrl, 'index.html is missing');
    const res = await fetch(baseUrl + '/');
    const body = await res.text();
    const page = stripComments(body);
    const assets = [];
    for (const tag of tags(page, 'link')) {
      if (!/\bstylesheet\b/i.test(attr(tag, 'rel') || '')) continue;
      const href = attr(tag, 'href');
      if (href && !isHttpUrl(href) && !isIgnorableRef(href)) assets.push(href);
    }
    for (const tag of tags(page, 'script')) {
      const src = attr(tag, 'src');
      if (src && !isHttpUrl(src) && !isIgnorableRef(src)) assets.push(src);
    }
    for (const href of assets) {
      const url = new URL(href, baseUrl + '/').href;
      const assetRes = await fetch(url);
      assert.equal(assetRes.status, 200, `expected 200 for ${href}`);
    }
  });
});
