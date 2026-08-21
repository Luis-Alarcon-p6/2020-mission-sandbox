const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createApp } = require('../src/app');
const store = require('../src/store');

describe('Notes API', () => {
  let app;

  beforeEach(() => {
    store.reset();
    app = createApp();
  });

  describe('GET /api/notes', () => {
    it('returns an empty array when no notes exist', async () => {
      const res = await request(app).get('/api/notes');
      assert.equal(res.status, 200);
      assert.deepEqual(res.body, []);
    });

    it('returns all notes sorted by updatedAt descending', async () => {
      const older = store.create({ title: 'First', content: 'one' });
      const newer = store.create({ title: 'Second', content: 'two' });
      store.update(older.id, { content: 'updated' });

      const res = await request(app).get('/api/notes');
      assert.equal(res.status, 200);
      assert.equal(res.body.length, 2);
      assert.equal(res.body[0].id, older.id);
      assert.equal(res.body[1].id, newer.id);
    });
  });

  describe('POST /api/notes', () => {
    it('creates a note and returns 201', async () => {
      const res = await request(app)
        .post('/api/notes')
        .send({ title: 'Hello', content: 'World' });

      assert.equal(res.status, 201);
      assert.equal(res.body.title, 'Hello');
      assert.equal(res.body.content, 'World');
      assert.ok(res.body.id);
      assert.ok(res.body.createdAt);
      assert.ok(res.body.updatedAt);
    });

    it('creates a note with empty fields when body is missing', async () => {
      const res = await request(app).post('/api/notes').send({});
      assert.equal(res.status, 201);
      assert.equal(res.body.title, '');
      assert.equal(res.body.content, '');
    });
  });

  describe('GET /api/notes/:id', () => {
    it('returns a single note', async () => {
      const note = store.create({ title: 'Test', content: 'Body' });
      const res = await request(app).get(`/api/notes/${note.id}`);
      assert.equal(res.status, 200);
      assert.deepEqual(res.body, note);
    });

    it('returns 404 for unknown id', async () => {
      const res = await request(app).get('/api/notes/999');
      assert.equal(res.status, 404);
      assert.equal(res.body.error, 'Note not found');
    });
  });

  describe('PUT /api/notes/:id', () => {
    it('updates title and content', async () => {
      const note = store.create({ title: 'Old', content: 'Old body' });
      const res = await request(app)
        .put(`/api/notes/${note.id}`)
        .send({ title: 'New', content: 'New body' });

      assert.equal(res.status, 200);
      assert.equal(res.body.title, 'New');
      assert.equal(res.body.content, 'New body');
      assert.ok(res.body.updatedAt >= note.updatedAt);
    });

    it('returns 404 for unknown id', async () => {
      const res = await request(app)
        .put('/api/notes/999')
        .send({ title: 'Nope' });
      assert.equal(res.status, 404);
    });
  });

  describe('DELETE /api/notes/:id', () => {
    it('deletes a note and returns 204', async () => {
      const note = store.create({ title: 'Bye', content: '' });
      const res = await request(app).delete(`/api/notes/${note.id}`);
      assert.equal(res.status, 204);
      assert.equal(store.get(note.id), null);
    });

    it('returns 404 for unknown id', async () => {
      const res = await request(app).delete('/api/notes/999');
      assert.equal(res.status, 404);
    });
  });

  describe('Static files', () => {
    it('serves index.html at /', async () => {
      const res = await request(app).get('/');
      assert.equal(res.status, 200);
      assert.match(res.text, /<title>Notes<\/title>/);
    });
  });
});

describe('Store unit tests', () => {
  beforeEach(() => store.reset());

  it('assigns incrementing ids', () => {
    const a = store.create({ title: 'a' });
    const b = store.create({ title: 'b' });
    assert.equal(b.id, a.id + 1);
  });

  it('trims title on create', () => {
    const note = store.create({ title: '  spaced  ', content: 'x' });
    assert.equal(note.title, 'spaced');
  });

  it('remove returns false for missing id', () => {
    assert.equal(store.remove(42), false);
  });
});
