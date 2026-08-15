# Testing the notes app

## Run tests

Node.js **18+** is required (uses the built-in test runner and `fetch`).

```bash
npm install
npm test
```

That runs `node --test test` (plain Node, no extra test framework).

To start the app itself (not required for tests):

```bash
npm start
```

The server listens on `http://localhost:3000` by default (`PORT` overrides).

## What the tests cover

Acceptance tests in `test/acceptance.test.js` hit the app over **real HTTP** on an ephemeral port. They do not use a browser.

| Area | Checks |
|------|--------|
| `GET /api/notes` | Empty list is `[]` |
| `POST /api/notes` | Creates `{ id, title, content, createdAt }`, then appears in the list |
| Validation | Empty / whitespace-only notes are rejected with **400** |
| `GET /api/notes/:id` | Returns one note; unknown id → **404** |
| `PUT /api/notes/:id` | Updates title and content; unknown id → **404** |
| `DELETE /api/notes/:id` | Removes the note (**200** or **204**); unknown id → **404** |
| `GET /` | HTML page with note fields, a button, a notes list, and `fetch('/api/notes')` |

## App contract the tests expect

### Module surface

- `src/app.js` exports `createApp()` and **does not** call `listen()` (so tests can bind port `0`).
- `src/store.js` exports `reset()` so each test starts with no notes.
- `src/server.js` is the process entry used by `npm start`.

### Note shape

```json
{
  "id": 1,
  "title": "Groceries",
  "content": "Milk and eggs",
  "createdAt": "2026-08-15T17:00:00.000Z"
}
```

`id` may be a number or string. Extra fields (for example `updatedAt`) are allowed.

### HTTP API

| Method | Path | Body | Success |
|--------|------|------|---------|
| GET | `/api/notes` | — | **200** JSON array |
| POST | `/api/notes` | `{ "title": string, "content": string }` | **201** note object |
| GET | `/api/notes/:id` | — | **200** note object |
| PUT | `/api/notes/:id` | `{ "title"?: string, "content"?: string }` | **200** note object |
| DELETE | `/api/notes/:id` | — | **204** or **200** |
| GET | `/` | — | **200** `text/html` |

`POST` must return **400** when both `title` and `content` are missing, empty, or whitespace-only.

The one-page UI at `/` should load and create notes with `fetch` against `/api/notes`. Tests assert the HTML includes that wiring; they also create a note via the API and confirm `GET /api/notes` returns it (the data the page would render).
