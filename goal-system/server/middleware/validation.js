const { HttpError } = require('./errorHandler');

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}/;

const GOAL_STATUSES = ['idea', 'active', 'completed', 'archived'];
const PRIORITIES = ['high', 'medium', 'low'];
const PLAN_STATUSES = ['active', 'inactive', 'completed'];
const TASK_STATUSES = ['pending', 'completed'];
const RESOURCE_TYPES = ['link', 'course', 'book', 'video', 'article', 'file'];

const bad = (message) => { throw new HttpError(400, message); };
const isValidId = (v) => typeof v === 'string' && ID_RE.test(v);

function checkField(name, rule, value) {
  if (value === null) {
    if (rule.nullable) return null;
    if (!rule.required && 'default' in rule) return rule.default;
    bad(`${name} cannot be null`);
  }

  switch (rule.type) {
    case 'id':
      if (!isValidId(value)) bad(`${name} is not a valid id`);
      return value;

    case 'string': {
      if (typeof value !== 'string') bad(`${name} must be a string`);
      const v = value.trim();
      if (rule.required && v === '') bad(`${name} is required`);
      if (v.length > rule.max) bad(`${name} is too long (max ${rule.max} characters)`);
      return v;
    }

    case 'enum':
      if (!rule.values.includes(value)) bad(`${name} must be one of: ${rule.values.join(', ')}`);
      return value;

    case 'int':
      if (!Number.isInteger(value) || value < rule.min || value > rule.max) {
        bad(`${name} must be a whole number between ${rule.min} and ${rule.max}`);
      }
      return value;

    case 'bool':
      if (typeof value !== 'boolean') bad(`${name} must be true or false`);
      return value;

    case 'date':
      if (typeof value !== 'string' || !DATE_RE.test(value) || Number.isNaN(Date.parse(value))) {
        bad(`${name} must be a valid date (YYYY-MM-DD or ISO timestamp)`);
      }
      return value;

    case 'url': {
      if (typeof value !== 'string') bad(`${name} must be a string`);
      const v = value.trim();
      if (v === '') return '';
      if (v.length > 2000) bad(`${name} is too long`);
      let parsed;
      try { parsed = new URL(v); } catch { bad(`${name} is not a valid URL`); }
      if (!['http:', 'https:'].includes(parsed.protocol)) bad(`${name} must start with http:// or https://`);
      return v;
    }

    case 'tags': {
      if (!Array.isArray(value) || value.length > 20) bad(`${name} must be an array of at most 20 tags`);
      return value.map((t) => {
        if (typeof t !== 'string') bad(`${name} must contain only strings`);
        const tag = t.trim();
        if (tag.length > 50) bad(`each tag must be at most 50 characters`);
        return tag;
      }).filter(Boolean);
    }

    default:
      throw new Error(`Unknown rule type: ${rule.type}`);
  }
}

function validate(schema, body, { partial = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    bad('Request body must be a JSON object');
  }
  const out = {};
  for (const [name, rule] of Object.entries(schema)) {
    const value = body[name];
    if (value === undefined) {
      if (partial) continue;
      if (rule.required) bad(`${name} is required`);
      if ('default' in rule) out[name] = rule.default;
      continue;
    }
    out[name] = checkField(name, rule, value);
  }
  return out;
}

const str = (max, extra = {}) => ({ type: 'string', max, default: '', ...extra });

const fields = {
  goal: {
    name: str(200, { required: true }),
    description: str(2000),
    status: { type: 'enum', values: GOAL_STATUSES, default: 'active' },
    priority: { type: 'enum', values: PRIORITIES, default: 'medium' },
    tags: { type: 'tags', default: [] },
    startDate: { type: 'date', nullable: true, default: null },
    targetDate: { type: 'date', nullable: true, default: null },
  },
  plan: {
    name: str(200, { required: true }),
    description: str(2000),
    status: { type: 'enum', values: PLAN_STATUSES },
    order: { type: 'int', min: 0, max: 100000 },
  },
  session: {
    title: str(200, { required: true }),
    date: { type: 'date' },
    duration: { type: 'int', min: 0, max: 100000, nullable: true, default: null },
    stopPoint: str(2000),
    nextStep: str(2000),
    summary: str(5000),
    isCompleted: { type: 'bool', default: false },
  },
  task: {
    title: str(300, { required: true }),
    status: { type: 'enum', values: TASK_STATUSES, default: 'pending' },
    order: { type: 'int', min: 0, max: 100000 },
  },
  resource: {
    name: str(200, { required: true }),
    url: { type: 'url', default: '' },
    type: { type: 'enum', values: RESOURCE_TYPES, default: 'link' },
    description: str(1000),
  },
  note: {
    content: str(5000, { required: true }),
  },
};

const idReq = { type: 'id', required: true };
const idOpt = { type: 'id', nullable: true, default: null };
const parents = {
  goal: {},
  plan: { goalId: idReq },
  session: { goalId: idReq },
  task: { sessionId: idReq },
  resource: { goalId: idReq },
  note: { goalId: idOpt, sessionId: idOpt },
};

const schemas = {};
for (const key of Object.keys(fields)) {
  schemas[key] = { create: { ...parents[key], ...fields[key] }, update: fields[key] };
}

function validateIdParam(req, res, next, id) {
  if (!isValidId(id)) return next(new HttpError(400, 'Invalid id'));
  next();
}

module.exports = { validate, schemas, validateIdParam, isValidId, GOAL_STATUSES };
