const express = require('express');
const { randomUUID } = require('crypto');
const { HttpError } = require('../middleware/errorHandler');
const { validate, schemas, validateIdParam, GOAL_STATUSES } = require('../middleware/validation');
const { insertRow, updateRow, requireRow } = require('../db/database');
const map = require('../db/mappers');

module.exports = (db) => {
  const router = express.Router();
  router.param('id', validateIdParam);

  router.get('/', (req, res) => {
    let sql = 'SELECT * FROM goals';
    const params = [];
    if (req.query.status) {
      const wanted = String(req.query.status).split(',');
      if (!wanted.every((s) => GOAL_STATUSES.includes(s))) throw new HttpError(400, 'Invalid status filter');
      sql += ` WHERE status IN (${wanted.map(() => '?').join(', ')})`;
      params.push(...wanted);
    }
    sql += ' ORDER BY created_at DESC';
    res.json(db.prepare(sql).all(...params).map(map.goal));
  });

  router.post('/', (req, res) => {
    const data = validate(schemas.goal.create, req.body);
    const now = new Date().toISOString();
    const id = randomUUID();
    insertRow(db, 'goals', { id, ...data, createdAt: now, updatedAt: now });
    res.status(201).json(map.goal(requireRow(db, 'goals', id, 'Goal')));
  });

  router.get('/:id', (req, res) => {
    const { id } = req.params;
    const goal = requireRow(db, 'goals', id, 'Goal');
    res.json({
      ...map.goal(goal),
      plans: db.prepare('SELECT * FROM plans WHERE goal_id = ? ORDER BY order_index, created_at').all(id).map(map.plan),
      sessions: db.prepare('SELECT * FROM sessions WHERE goal_id = ? ORDER BY date DESC').all(id).map(map.session),
      resources: db.prepare('SELECT * FROM resources WHERE goal_id = ? ORDER BY created_at').all(id).map(map.resource),
      notes: db.prepare('SELECT * FROM notes WHERE goal_id = ? ORDER BY created_at DESC').all(id).map(map.note),
    });
  });

  router.patch('/:id', (req, res) => {
    const { id } = req.params;
    requireRow(db, 'goals', id, 'Goal');
    const data = validate(schemas.goal.update, req.body, { partial: true });
    if (Object.keys(data).length === 0) throw new HttpError(400, 'No valid fields to update');
    updateRow(db, 'goals', id, { ...data, updatedAt: new Date().toISOString() });
    res.json(map.goal(requireRow(db, 'goals', id, 'Goal')));
  });

  router.delete('/:id', (req, res) => {
    requireRow(db, 'goals', req.params.id, 'Goal');
    db.prepare('DELETE FROM goals WHERE id = ?').run(req.params.id);
    res.status(204).end();
  });

  return router;
};
