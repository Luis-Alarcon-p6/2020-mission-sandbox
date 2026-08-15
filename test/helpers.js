'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function fileExists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function loadModule(rel) {
  if (!fileExists(rel)) return null;
  return require(path.join(ROOT, rel));
}

/**
 * Load the Express app without binding a port.
 * Prefers `createApp()` from src/app.js (Builder layout).
 */
function loadApp() {
  const candidates = ['src/app.js', 'app.js', 'index.js'];

  for (const rel of candidates) {
    const mod = loadModule(rel);
    if (!mod) continue;

    if (typeof mod.createApp === 'function') {
      return mod.createApp();
    }
    if (mod.app && typeof mod.app.listen === 'function') {
      return mod.app;
    }
    if (typeof mod === 'function' && typeof mod.listen === 'function') {
      return mod;
    }
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

module.exports = { loadApp, resetStore, listen, httpRequest };
