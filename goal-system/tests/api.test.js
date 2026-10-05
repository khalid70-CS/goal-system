const request = require('supertest');
const { openDatabase } = require('../server/db/database');
const { createApp } = require('../server/app');

let db;
let api;
beforeEach(() => {
  db = openDatabase(':memory:');
  api = request(createApp(db));
});
afterEach(() => db.close());

const count = (table) => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
const createGoal = async (body = {}) => (await api.post('/api/goals').send({ name: 'Learn SQL', ...body })).body;

describe('Goals API (CRUD)', () => {
  test('POST /api/goals creates a goal with defaults', async () => {
    const res = await api.post('/api/goals').send({ name: '  Learn SQL  ', tags: ['db', ' sql '] });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Learn SQL', status: 'active', priority: 'medium', tags: ['db', 'sql'] });
    expect(typeof res.body.id).toBe('string');
    expect(count('goals')).toBe(1);
  });

  test('GET /api/goals lists goals and can filter by status', async () => {
    await createGoal({ name: 'A' });
    const b = await createGoal({ name: 'B' });
    await api.patch(`/api/goals/${b.id}`).send({ status: 'archived' });

    const all = await api.get('/api/goals');
    expect(all.status).toBe(200);
    expect(all.body).toHaveLength(2);

    const archived = await api.get('/api/goals?status=archived');
    expect(archived.body.map((g) => g.name)).toEqual(['B']);
  });

  test('GET /api/goals/:id returns the goal with its plans, sessions, resources and notes', async () => {
    const goal = await createGoal();
    await api.post('/api/plans').send({ goalId: goal.id, name: 'Phase 1' });

    const res = await api.get(`/api/goals/${goal.id}`);
    expect(res.status).toBe(200);
    expect(res.body.plans).toHaveLength(1);
    expect(res.body).toMatchObject({ sessions: [], resources: [], notes: [] });
  });

  test('PATCH /api/goals/:id updates only the given fields', async () => {
    const goal = await createGoal({ priority: 'low' });
    const res = await api.patch(`/api/goals/${goal.id}`).send({ status: 'completed' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Learn SQL', priority: 'low', status: 'completed' });
    expect(res.body.updatedAt >= goal.updatedAt).toBe(true);
  });

  test('DELETE /api/goals/:id removes the goal', async () => {
    const goal = await createGoal();

    expect((await api.delete(`/api/goals/${goal.id}`)).status).toBe(204);
    expect((await api.get(`/api/goals/${goal.id}`)).status).toBe(404);
    expect(count('goals')).toBe(0);
  });
});

describe('Validation and error handling', () => {
  test('missing or blank required fields are rejected with a JSON error', async () => {
    const missing = await api.post('/api/goals').send({ priority: 'high' });
    expect(missing.status).toBe(400);
    expect(missing.body).toEqual({ error: 'name is required' });

    const blank = await api.post('/api/goals').send({ name: '   ' });
    expect(blank.status).toBe(400);
    expect(count('goals')).toBe(0);
  });

  test('invalid enum values, too-long text and bad dates are rejected', async () => {
    const bodies = [
      { name: 'x', priority: 'urgent' },
      { name: 'x', status: 'finished' },
      { name: 'x'.repeat(201) },
      { name: 'x', targetDate: 'tomorrow' },
      { name: 'x', tags: 'not-an-array' },
    ];
    for (const body of bodies) {
      const res = await api.post('/api/goals').send(body);
      expect(res.status).toBe(400);
    }
    expect(count('goals')).toBe(0);
  });

  test('resource URLs must be http(s)', async () => {
    const goal = await createGoal();
    const bad = await api.post('/api/resources').send({ goalId: goal.id, name: 'x', url: 'javascript:alert(1)' });
    expect(bad.status).toBe(400);

    const good = await api.post('/api/resources').send({ goalId: goal.id, name: 'x', url: 'https://example.com' });
    expect(good.status).toBe(201);
  });

  test('malformed ids give 400, unknown ids give 404, empty PATCH gives 400', async () => {
    expect((await api.get('/api/goals/not$valid')).status).toBe(400);
    expect((await api.get('/api/goals/does-not-exist')).body).toEqual({ error: 'Goal not found' });

    const goal = await createGoal();
    expect((await api.patch(`/api/goals/${goal.id}`).send({})).status).toBe(400);
  });

  test('malformed JSON and unknown routes return JSON errors, not HTML', async () => {
    const badJson = await api.post('/api/goals').set('Content-Type', 'application/json').send('{oops');
    expect(badJson.status).toBe(400);
    expect(badJson.body.error).toBeDefined();

    const unknown = await api.get('/api/nothing');
    expect(unknown.status).toBe(404);
    expect(unknown.body).toEqual({ error: 'Route not found' });
  });

  test('SQL in user input is stored as plain text (parameterized queries)', async () => {
    const evil = "x'); DROP TABLE goals; --";
    const res = await api.post('/api/goals').send({ name: evil });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe(evil);
    expect(count('goals')).toBe(1);
  });
});

describe('Relationships (foreign keys)', () => {
  async function buildGoalTree() {
    const goal = await createGoal();
    await api.post('/api/plans').send({ goalId: goal.id, name: 'Plan' });
    await api.post('/api/resources').send({ goalId: goal.id, name: 'Book' });
    await api.post('/api/notes').send({ goalId: goal.id, content: 'goal note' });
    const session = (await api.post('/api/sessions').send({ goalId: goal.id, title: 'S1' })).body;
    await api.post('/api/tasks').send({ sessionId: session.id, title: 'Task' });
    await api.post('/api/notes').send({ sessionId: session.id, content: 'session note' });
    return { goal, session };
  }

  test('deleting a goal cascades to plans, sessions, tasks, resources and notes', async () => {
    const { goal } = await buildGoalTree();
    for (const t of ['plans', 'sessions', 'tasks', 'resources']) expect(count(t)).toBe(1);
    expect(count('notes')).toBe(2);

    await api.delete(`/api/goals/${goal.id}`);

    for (const t of ['goals', 'plans', 'sessions', 'tasks', 'resources', 'notes']) expect(count(t)).toBe(0);
  });

  test('deleting a session removes its tasks but keeps its notes on the goal', async () => {
    const { goal, session } = await buildGoalTree();

    await api.delete(`/api/sessions/${session.id}`);

    expect(count('tasks')).toBe(0);
    expect(count('notes')).toBe(2);
    const note = db.prepare("SELECT goal_id, session_id FROM notes WHERE content = 'session note'").get();
    expect(note).toEqual({ goal_id: goal.id, session_id: null });
  });

  test('children cannot reference a goal that does not exist', async () => {
    const res = await api.post('/api/plans').send({ goalId: 'missing', name: 'x' });
    expect(res.status).toBe(404);

    expect(() => db.prepare(
      "INSERT INTO plans (id, goal_id, name, created_at) VALUES ('p', 'missing', 'x', 'now')"
    ).run()).toThrow(/FOREIGN KEY/);
  });
});

describe('Sessions and tasks', () => {
  test('a session note is linked to the goal of its session', async () => {
    const goal = await createGoal();
    const session = (await api.post('/api/sessions').send({ goalId: goal.id, title: 'S' })).body;

    const note = await api.post('/api/notes').send({ sessionId: session.id, content: 'hi' });

    expect(note.body).toMatchObject({ goalId: goal.id, sessionId: session.id });
  });

  test('tasks are numbered in order, can be toggled, and the session can be completed', async () => {
    const goal = await createGoal();
    const session = (await api.post('/api/sessions').send({ goalId: goal.id, title: 'S' })).body;
    expect(session).toMatchObject({ isCompleted: false, duration: null });

    const t1 = (await api.post('/api/tasks').send({ sessionId: session.id, title: 'one' })).body;
    const t2 = (await api.post('/api/tasks').send({ sessionId: session.id, title: 'two' })).body;
    expect([t1.order, t2.order, t1.status]).toEqual([1, 2, 'pending']);

    const toggled = await api.patch(`/api/tasks/${t1.id}`).send({ status: 'completed' });
    expect(toggled.body.status).toBe('completed');

    const done = await api.patch(`/api/sessions/${session.id}`).send({ isCompleted: true, duration: 30, summary: 'ok' });
    expect(done.body).toMatchObject({ isCompleted: true, duration: 30, summary: 'ok' });

    const full = await api.get(`/api/sessions/${session.id}`);
    expect(full.body.tasks.map((t) => t.title)).toEqual(['one', 'two']);
  });
});

describe('Backup (export / import)', () => {
  test('export then import restores the same data, and a bad file changes nothing', async () => {
    const goal = await createGoal({ tags: ['a'] });
    const session = (await api.post('/api/sessions').send({ goalId: goal.id, title: 'S' })).body;
    await api.post('/api/tasks').send({ sessionId: session.id, title: 'T' });

    const backup = (await api.get('/api/export')).body;
    await api.delete('/api/data');
    expect(count('goals')).toBe(0);

    const imported = await api.post('/api/import').send(backup);
    expect(imported.status).toBe(200);
    expect([count('goals'), count('sessions'), count('tasks')]).toEqual([1, 1, 1]);

    const bad = await api.post('/api/import').send({ goals: [{ id: 'g', name: '' }] });
    expect(bad.status).toBe(400);
    expect(count('goals')).toBe(1);
  });
});
