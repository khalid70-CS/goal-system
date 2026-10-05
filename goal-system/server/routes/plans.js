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
    const data = validate(schemas.plan.create, req.body);
    requireRow(db, 'goals', data.goalId, 'Goal');

    const { n, maxOrder } = db
      .prepare('SELECT COUNT(*) AS n, COALESCE(MAX(order_index), 0) AS maxOrder FROM plans WHERE goal_id = ?')
      .get(data.goalId);
    const id = randomUUID();
    insertRow(db, 'plans', {
      id,
      ...data,
      order: data.order ?? maxOrder + 1,
      status: data.status ?? (n === 0 ? 'active' : 'inactive'),
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(map.plan(requireRow(db, 'plans', id, 'Plan')));
  });

  router.patch('/:id', (req, res) => {
    const { id } = req.params;
    requireRow(db, 'plans', id, 'Plan');
    const data = validate(schemas.plan.update, req.body, { partial: true });
    if (Object.keys(data).length === 0) throw new HttpError(400, 'No valid fields to update');
    updateRow(db, 'plans', id, data);
    res.json(map.plan(requireRow(db, 'plans', id, 'Plan')));
  });

  router.delete('/:id', (req, res) => {
    requireRow(db, 'plans', req.params.id, 'Plan');
    db.prepare('DELETE FROM plans WHERE id = ?').run(req.params.id);
    res.status(204).end();
  });

  return router;
};
