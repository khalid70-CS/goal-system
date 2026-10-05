const express = require('express');
const { HttpError } = require('../middleware/errorHandler');
const { validate, schemas } = require('../middleware/validation');
const { insertRow } = require('../db/database');
const map = require('../db/mappers');

const TABLES = [
  ['goals', 'goal', map.goal],
  ['plans', 'plan', map.plan],
  ['sessions', 'session', map.session],
  ['tasks', 'task', map.task],
  ['resources', 'resource', map.resource],
  ['notes', 'note', map.note],
];

module.exports = (db) => {
  const router = express.Router();

  router.get('/export', (req, res) => {
    const out = {};
    for (const [table, , mapper] of TABLES) {
      out[table] = db.prepare(`SELECT * FROM ${table} ORDER BY created_at`).all().map(mapper);
    }
    out.exportedAt = new Date().toISOString();
    res.json(out);
  });

  router.post('/import', (req, res) => {
    const body = req.body;
    if (!body || typeof body !== 'object') throw new HttpError(400, 'Request body must be a JSON object');

    const now = new Date().toISOString();
    const parsed = {};
    for (const [table, key] of TABLES) {
      const list = body[table] ?? [];
      if (!Array.isArray(list)) throw new HttpError(400, `${table} must be an array`);
      const schema = {
        id: { type: 'id', required: true },
        createdAt: { type: 'date' },
        ...(key === 'goal' ? { updatedAt: { type: 'date' } } : {}),
        ...schemas[key].create,
      };
      parsed[table] = list.map((item, i) => {
        try {
          return validate(schema, item);
        } catch (e) {
          throw new HttpError(400, `${table}[${i}]: ${e.message}`);
        }
      });
    }

    const ids = (table) => new Set(parsed[table].map((r) => r.id));
    const goalIds = ids('goals');
    let skipped = 0;
    const keep = (table, parentSet, field) => {
      const before = parsed[table].length;
      parsed[table] = parsed[table].filter((r) => parentSet.has(r[field]));
      skipped += before - parsed[table].length;
    };
    keep('plans', goalIds, 'goalId');
    keep('sessions', goalIds, 'goalId');
    keep('resources', goalIds, 'goalId');
    const validSessions = new Set(parsed.sessions.map((s) => s.id));
    keep('tasks', validSessions, 'sessionId');
    for (const n of parsed.notes) {
      if (n.goalId && !goalIds.has(n.goalId)) n.goalId = null;
      if (n.sessionId && !validSessions.has(n.sessionId)) n.sessionId = null;
    }

    const run = db.transaction(() => {
      for (const [table] of [...TABLES].reverse()) db.prepare(`DELETE FROM ${table}`).run();
      for (const [table] of TABLES) {
        for (const rec of parsed[table]) {
          const row = { ...rec, createdAt: rec.createdAt ?? now };
          if (table === 'goals') row.updatedAt = rec.updatedAt ?? row.createdAt;
          insertRow(db, table, row);
        }
      }
    });
    try {
      run();
    } catch (e) {
      if (typeof e.code === 'string' && e.code.startsWith('SQLITE_CONSTRAINT')) {
        throw new HttpError(400, 'Backup file is inconsistent (duplicate ids or broken references)');
      }
      throw e;
    }

    const counts = Object.fromEntries(TABLES.map(([table]) => [table, parsed[table].length]));
    res.json({ imported: counts, skipped });
  });

  router.delete('/data', (req, res) => {
    db.transaction(() => {
      for (const [table] of [...TABLES].reverse()) db.prepare(`DELETE FROM ${table}`).run();
    })();
    res.status(204).end();
  });

  return router;
};
