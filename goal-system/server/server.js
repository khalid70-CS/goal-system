const path = require('path');
const { openDatabase } = require('./db/database');
const { seedIfEmpty } = require('./db/seed');
const { createApp } = require('./app');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'goal-system.db');

const db = openDatabase(DB_PATH);
seedIfEmpty(db);

createApp(db).listen(PORT, HOST, () => {
  console.log(`Goal System running at http://${HOST}:${PORT}`);
  console.log(`Database: ${DB_PATH}`);
});
