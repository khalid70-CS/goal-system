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
    const data = validate(schemas.resource.create, req.body);
    requireRow(db, 'goals', data.goalId, 'Goal');
    const id = randomUUID();
    insertRow(db, 'resources', { id, ...data, createdAt: new Date().toISOString() });
    res.status(201).json(map.resource(requireRow(db, 'resources', id, 'Resource')));
  });

  router.patch('/:id', (req, res) => {
    const { id } = req.params;
    requireRow(db, 'resources', id, 'Resource');
    const data = validate(schemas.resource.update, req.body, { partial: true });
    if (Object.keys(data).length === 0) throw new HttpError(400, 'No valid fields to update');
    updateRow(db, 'resources', id, data);
    res.json(map.resource(requireRow(db, 'resources', id, 'Resource')));
  });

  router.delete('/:id', (req, res) => {
    requireRow(db, 'resources', req.params.id, 'Resource');
    db.prepare('DELETE FROM resources WHERE id = ?').run(req.params.id);
    res.status(204).end();
  });

  return router;
};
