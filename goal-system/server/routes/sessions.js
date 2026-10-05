const express = require('express');
const { randomUUID } = require('crypto');
const { HttpError } = require('../middleware/errorHandler');
const { validate, schemas, validateIdParam } = require('../middleware/validation');
const { insertRow, updateRow, requireRow } = require('../db/database');
const map = require('../db/mappers');

module.exports = (db) => {
  const router = express.Router();
  router.param('id', validateIdParam);

  router.get('/', (req, res) => {
    res.json(db.prepare('SELECT * FROM sessions ORDER BY date DESC').all().map(map.session));
  });

  router.post('/', (req, res) => {
    const data = validate(schemas.session.create, req.body);
    requireRow(db, 'goals', data.goalId, 'Goal');
    const now = new Date().toISOString();
    const id = randomUUID();
    insertRow(db, 'sessions', { id, ...data, date: data.date ?? now, createdAt: now });
    res.status(201).json(map.session(requireRow(db, 'sessions', id, 'Session')));
  });

  router.get('/:id', (req, res) => {
    const { id } = req.params;
    const session = requireRow(db, 'sessions', id, 'Session');
    res.json({
      ...map.session(session),
      tasks: db.prepare('SELECT * FROM tasks WHERE session_id = ? ORDER BY order_index, created_at').all(id).map(map.task),
      notes: db.prepare('SELECT * FROM notes WHERE session_id = ? ORDER BY created_at DESC').all(id).map(map.note),
    });
  });

  router.patch('/:id', (req, res) => {
    const { id } = req.params;
    requireRow(db, 'sessions', id, 'Session');
    const data = validate(schemas.session.update, req.body, { partial: true });
    if (Object.keys(data).length === 0) throw new HttpError(400, 'No valid fields to update');
    updateRow(db, 'sessions', id, data);
    res.json(map.session(requireRow(db, 'sessions', id, 'Session')));
  });

  router.delete('/:id', (req, res) => {
    requireRow(db, 'sessions', req.params.id, 'Session');
    db.prepare('DELETE FROM sessions WHERE id = ?').run(req.params.id);
    res.status(204).end();
  });

  return router;
};
