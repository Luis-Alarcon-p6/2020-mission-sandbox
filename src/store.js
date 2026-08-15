/** In-memory note store. Exported for testing. */

let notes = [];
let nextId = 1;

function reset() {
  notes = [];
  nextId = 1;
}

function list() {
  return [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function get(id) {
  return notes.find((n) => n.id === id) ?? null;
}

function create({ title = '', content = '' }) {
  const now = new Date().toISOString();
  const note = {
    id: nextId++,
    title: String(title).trim(),
    content: String(content),
    createdAt: now,
    updatedAt: now,
  };
  notes.push(note);
  return note;
}

function update(id, { title, content }) {
  const note = get(id);
  if (!note) return null;

  if (title !== undefined) note.title = String(title).trim();
  if (content !== undefined) note.content = String(content);
  note.updatedAt = new Date().toISOString();
  return note;
}

function remove(id) {
  const index = notes.findIndex((n) => n.id === id);
  if (index === -1) return false;
  notes.splice(index, 1);
  return true;
}

module.exports = { reset, list, get, create, update, remove };
