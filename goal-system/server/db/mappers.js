function camelCase(key) {
  return key.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
}

function mapRow(row) {
  const result = {};
  for (const key of Object.keys(row)) {
    result[camelCase(key)] = row[key];
  }
  return result;
}

function parseTags(value) {
  try {
    const tags = JSON.parse(value);
    return Array.isArray(tags) ? tags : [];
  } catch {
    return [];
  }
}

function mapOrderedRow(row) {
  const result = mapRow(row);
  result.order = result.orderIndex;
  delete result.orderIndex;
  return result;
}

module.exports = {
  goal: (row) => ({ ...mapRow(row), tags: parseTags(row.tags) }),
  plan: mapOrderedRow,
  task: mapOrderedRow,
  session: (row) => ({ ...mapRow(row), isCompleted: row.is_completed === 1 }),
  resource: mapRow,
  note: mapRow,
};
