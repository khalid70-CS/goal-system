const express = require('express');
const { randomUUID } = require('crypto');
const { HttpError } = require('../middleware/errorHandler');
const { validate, schemas, validateIdParam } = require('../middleware/validation');
const { insertRow, updateRow, requireRow } = require('../db/database');
const map = require('../db/mappers');

module.exports = (db) => {
  const router = express.Router();
  router.param('id', validateIdParam);

  router.post('/', (req, res) => {
    const data = validate(schemas.task.create, req.body);
    requireRow(db, 'sessions', data.sessionId, 'Session');
    const { maxOrder } = db
      .prepare('SELECT COALESCE(MAX(order_index), 0) AS maxOrder FROM tasks WHERE session_id = ?')
      .get(data.sessionId);
    const id = randomUUID();
    insertRow(db, 'tasks', { id, ...data, order: data.order ?? maxOrder + 1, createdAt: new Date().toISOString() });
    res.status(201).json(map.task(requireRow(db, 'tasks', id, 'Task')));
  });

  router.patch('/:id', (req, res) => {
    const { id } = req.params;
    requireRow(db, 'tasks', id, 'Task');
    const data = validate(schemas.task.update, req.body, { partial: true });
    if (Object.keys(data).length === 0) throw new HttpError(400, 'No valid fields to update');
    updateRow(db, 'tasks', id, data);
    res.json(map.task(requireRow(db, 'tasks', id, 'Task')));
  });

  router.delete('/:id', (req, res) => {
    requireRow(db, 'tasks', req.params.id, 'Task');
    db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
    res.status(204).end();
  });

  return router;
};
