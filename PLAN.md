# Tiny Notes App Swarm Plan

## ARCHITECT (this file)
- Define interface contracts, task split, and acceptance criteria.
- Keep scope tiny: one page UI, one Express API, persistent in-memory notes.

## BUILDER (implementation)
1. Scaffold Express server with JSON middleware and routes:
   - `GET /api/notes` -> list notes
   - `POST /api/notes` -> create `{ id, text, createdAt }` (validate non-empty text)
2. Serve a single HTML page at `/` with:
   - note input, add button, notes list
   - fetch-based load + create flow with basic error display
3. Keep data store in-process (array) and export app/server for tests.

## VERIFIER (tests)
1. API tests (real HTTP): list initially empty, create note, reject empty text.
2. UI/integration test (or minimal browser-like test): page loads and renders created note.
3. Add npm scripts for tests and ensure they run in CI/local with one command.

## Done Criteria
- App runs with one command and supports create/list notes end-to-end.
- Tests are automated, pass reliably, and cover success + validation failure paths.
