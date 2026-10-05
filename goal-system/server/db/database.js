const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { HttpError } = require('../middleware/errorHandler');

function openDatabase(file = ':memory:') {
  if (file !== ':memory:') {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }

  const db = new Database(file);
  db.pragma('foreign_keys = ON');
  db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  return db;
}

function toColumn(key) {
  if (key === 'order') return 'order_index';
  return key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
}

function toDbValue(value) {
  if (value === undefined) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (Array.isArray(value)) return JSON.stringify(value);
  return value;
}

function insertRow(db, table, data) {
  const columns = Object.keys(data).map(toColumn);
  const placeholders = columns.map(() => '?').join(', ');
  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
  db.prepare(sql).run(...Object.values(data).map(toDbValue));
}

function updateRow(db, table, id, data) {
  const sets = Object.keys(data).map((key) => `${toColumn(key)} = ?`);
  const sql = `UPDATE ${table} SET ${sets.join(', ')} WHERE id = ?`;
  db.prepare(sql).run(...Object.values(data).map(toDbValue), id);
}

function requireRow(db, table, id, label) {
  const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
  if (!row) throw new HttpError(404, `${label} not found`);
  return row;
}

module.exports = { openDatabase, insertRow, updateRow, requireRow };
