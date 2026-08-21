const express = require('express');
const store = require('../store');

const router = express.Router();

router.get('/', (_req, res) => {
  res.json(store.list());
});

router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const note = store.get(id);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  res.json(note);
});

router.post('/', (req, res) => {
  const { title, content } = req.body ?? {};
  const note = store.create({ title, content });
  res.status(201).json(note);
});

router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const { title, content } = req.body ?? {};
  const note = store.update(id, { title, content });
  if (!note) return res.status(404).json({ error: 'Note not found' });
  res.json(note);
});

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!store.remove(id)) {
    return res.status(404).json({ error: 'Note not found' });
  }
  res.status(204).end();
});

module.exports = router;
