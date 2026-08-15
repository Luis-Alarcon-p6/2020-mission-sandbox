# Notes App

A tiny notes web app: Express REST API, single-page UI, and real tests.

## Quick start

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000).

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/notes` | List all notes (newest first) |
| POST | `/api/notes` | Create `{ title, content }` |
| GET | `/api/notes/:id` | Get one note |
| PUT | `/api/notes/:id` | Update `{ title, content }` |
| DELETE | `/api/notes/:id` | Delete a note |

## Tests

```bash
npm test
```

Uses Node's built-in test runner with supertest for HTTP integration tests.
