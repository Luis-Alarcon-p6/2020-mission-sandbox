'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.join(__dirname, '..');

function loadModule(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return null;
  return require(abs);
}

function loadApp() {
  const candidates = ['src/app.js', 'app.js', 'index.js'];

  for (const rel of candidates) {
    const mod = loadModule(rel);
    if (!mod) continue;

    if (typeof mod.createApp === 'function') return mod.createApp();
    if (mod.app && typeof mod.app.listen === 'function') return mod.app;
    if (typeof mod === 'function' && typeof mod.listen === 'function') return mod;
  }

  throw new Error(
    'Could not load the Express app. Export createApp() from src/app.js ' +
      '(or export the app from app.js) without calling listen(). See TESTING.md.'
  );
}

function resetStore() {
  for (const rel of ['src/store.js', 'store.js']) {
    const mod = loadModule(rel);
    if (mod && typeof mod.reset === 'function') {
      mod.reset();
      return true;
    }
  }
  return false;
}

function listen(app) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${port}`,
        close() {
          return new Promise((res, rej) => {
            server.close((err) => (err ? rej(err) : res()));
          });
        },
      });
    });
    server.once('error', reject);
  });
}

async function httpRequest(baseUrl, method, urlPath, body) {
  const headers = {};
  const init = { method, headers };
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const res = await fetch(baseUrl + urlPath, init);
  const text = await res.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  return {
    status: res.status,
    contentType: res.headers.get('content-type') || '',
    text,
    json,
  };
}

describe('notes app acceptance', { concurrency: false }, () => {
  let ctx;
  let req;

  before(async () => {
    const app = loadApp();
    ctx = await listen(app);
    req = (method, urlPath, body) => httpRequest(ctx.baseUrl, method, urlPath, body);
  });

  after(async () => {
    if (ctx) await ctx.close();
  });

  beforeEach(() => {
    assert.equal(
      resetStore(),
      true,
      'Store must export reset() so tests start from an empty notes list. See TESTING.md.'
    );
  });

  describe('GET /api/notes', () => {
    it('returns an empty JSON array when no notes exist', async () => {
      const res = await req('GET', '/api/notes');
      assert.equal(res.status, 200);
      assert.match(res.contentType, /json/i);
      assert.ok(Array.isArray(res.json));
      assert.equal(res.json.length, 0);
    });
  });

  describe('POST /api/notes', () => {
    it('creates a note and returns 201 with id, title, content, createdAt', async () => {
      const res = await req('POST', '/api/notes', {
        title: 'Groceries',
        content: 'Milk and eggs',
      });

      assert.equal(res.status, 201);
      assert.match(res.contentType, /json/i);
      assert.ok(res.json);
      assert.ok(res.json.id != null);
      assert.equal(res.json.title, 'Groceries');
      assert.equal(res.json.content, 'Milk and eggs');
      assert.ok(res.json.createdAt);
      assert.doesNotThrow(() => new Date(res.json.createdAt).toISOString());
    });

    it('lists a created note on GET /api/notes', async () => {
      const created = await req('POST', '/api/notes', {
        title: 'Listed',
        content: 'Visible in list',
      });
      assert.equal(created.status, 201);

      const list = await req('GET', '/api/notes');
      assert.equal(list.status, 200);
      assert.ok(Array.isArray(list.json));
      const found = list.json.find((n) => String(n.id) === String(created.json.id));
      assert.ok(found, 'created note must appear in GET /api/notes');
      assert.equal(found.title, 'Listed');
      assert.equal(found.content, 'Visible in list');
    });

    it('rejects an empty note with 400', async () => {
      for (const body of [{}, { title: '', content: '' }, { title: '   ', content: '   ' }]) {
        const res = await req('POST', '/api/notes', body);
        assert.equal(
          res.status,
          400,
          `expected 400 for empty note payload ${JSON.stringify(body)}, got ${res.status}`
        );
      }
    });
  });

  describe('GET /api/notes/:id', () => {
    it('returns a single created note', async () => {
      const created = await req('POST', '/api/notes', {
        title: 'One',
        content: 'Body',
      });
      assert.equal(created.status, 201);

      const res = await req('GET', `/api/notes/${created.json.id}`);
      assert.equal(res.status, 200);
      assert.equal(String(res.json.id), String(created.json.id));
      assert.equal(res.json.title, 'One');
      assert.equal(res.json.content, 'Body');
    });

    it('returns 404 for an unknown id', async () => {
      const res = await req('GET', '/api/notes/999999');
      assert.equal(res.status, 404);
    });
  });

  describe('PUT /api/notes/:id', () => {
    it('updates title and content', async () => {
      const created = await req('POST', '/api/notes', {
        title: 'Old',
        content: 'Old body',
      });
      assert.equal(created.status, 201);

      const res = await req('PUT', `/api/notes/${created.json.id}`, {
        title: 'New',
        content: 'New body',
      });
      assert.equal(res.status, 200);
      assert.equal(res.json.title, 'New');
      assert.equal(res.json.content, 'New body');

      const fetched = await req('GET', `/api/notes/${created.json.id}`);
      assert.equal(fetched.json.title, 'New');
      assert.equal(fetched.json.content, 'New body');
    });

    it('returns 404 for an unknown id', async () => {
      const res = await req('PUT', '/api/notes/999999', { title: 'Nope' });
      assert.equal(res.status, 404);
    });
  });

  describe('DELETE /api/notes/:id', () => {
    it('deletes a note and omits it from later reads', async () => {
      const created = await req('POST', '/api/notes', {
        title: 'Temp',
        content: 'Gone soon',
      });
      assert.equal(created.status, 201);

      const res = await req('DELETE', `/api/notes/${created.json.id}`);
      assert.ok(res.status === 204 || res.status === 200);

      const missing = await req('GET', `/api/notes/${created.json.id}`);
      assert.equal(missing.status, 404);

      const list = await req('GET', '/api/notes');
      const found = list.json.find((n) => String(n.id) === String(created.json.id));
      assert.equal(found, undefined);
    });

    it('returns 404 for an unknown id', async () => {
      const res = await req('DELETE', '/api/notes/999999');
      assert.equal(res.status, 404);
    });
  });

  describe('GET / (one page UI)', () => {
    it('serves an HTML page with note input, add control, and a notes list', async () => {
      const res = await req('GET', '/');
      assert.equal(res.status, 200);
      assert.match(res.contentType, /html/i);
      assert.match(res.text, /<html/i);
      assert.match(res.text, /note/i);
      assert.match(res.text, /<input|<textarea/i);
      assert.match(res.text, /<button/i);
      assert.match(res.text, /id=["']notes["']|notes-list|id=["']list["']/i);
    });

    it('wires the page to load notes from the API so a created note can render', async () => {
      const created = await req('POST', '/api/notes', {
        title: 'Rendered',
        content: 'From the API',
      });
      assert.equal(created.status, 201);

      const page = await req('GET', '/');
      assert.equal(page.status, 200);
      assert.match(page.text, /fetch\s*\(/i);
      assert.match(page.text, /\/api\/notes/);

      const list = await req('GET', '/api/notes');
      const found = list.json.find((n) => String(n.id) === String(created.json.id));
      assert.ok(found, 'page fetch target GET /api/notes must include the created note');
      assert.equal(found.title, 'Rendered');
    });
  });
});
