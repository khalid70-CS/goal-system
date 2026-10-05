const express = require('express');
const { randomUUID } = require('crypto');
const { HttpError } = require('../middleware/errorHandler');
const { validate, schemas, validateIdParam, isValidId } = require('../middleware/validation');
const { insertRow, updateRow, requireRow } = require('../db/database');
const map = require('../db/mappers');

module.exports = (db) => {
  const router = express.Router();
  router.param('id', validateIdParam);

  router.get('/', (req, res) => {
    const where = [];
    const params = [];
    for (const [query, column] of [['goalId', 'goal_id'], ['sessionId', 'session_id']]) {
      if (req.query[query] === undefined) continue;
      if (!isValidId(req.query[query])) throw new HttpError(400, `Invalid ${query}`);
      where.push(`${column} = ?`);
      params.push(req.query[query]);
    }
    const sql = `SELECT * FROM notes ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC`;
    res.json(db.prepare(sql).all(...params).map(map.note));
  });

  router.post('/', (req, res) => {
    const data = validate(schemas.note.create, req.body);
    let { goalId, sessionId } = data;

    if (sessionId) {
      const session = requireRow(db, 'sessions', sessionId, 'Session');
      if (goalId && goalId !== session.goal_id) throw new HttpError(400, 'Session does not belong to this goal');
      goalId = session.goal_id;
    } else if (goalId) {
      requireRow(db, 'goals', goalId, 'Goal');
    }

    const id = randomUUID();
    insertRow(db, 'notes', { id, content: data.content, goalId, sessionId, createdAt: new Date().toISOString() });
    res.status(201).json(map.note(requireRow(db, 'notes', id, 'Note')));
  });

  router.patch('/:id', (req, res) => {
    const { id } = req.params;
    requireRow(db, 'notes', id, 'Note');
    const data = validate(schemas.note.update, req.body, { partial: true });
    if (Object.keys(data).length === 0) throw new HttpError(400, 'No valid fields to update');
    updateRow(db, 'notes', id, data);
    res.json(map.note(requireRow(db, 'notes', id, 'Note')));
  });

  router.delete('/:id', (req, res) => {
    requireRow(db, 'notes', req.params.id, 'Note');
    db.prepare('DELETE FROM notes WHERE id = ?').run(req.params.id);
    res.status(204).end();
  });

  return router;
};
