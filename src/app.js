const express = require('express');
const path = require('path');
const notesRouter = require('./routes/notes');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/notes', notesRouter);
  app.use(express.static(path.join(__dirname, '..', 'public')));
  return app;
}

module.exports = { createApp };
