const path = require('path');
const express = require('express');
const { apiNotFound, errorHandler } = require('./middleware/errorHandler');

function createApp(db) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '5mb' }));

  app.use('/api/goals', require('./routes/goals')(db));
  app.use('/api/plans', require('./routes/plans')(db));
  app.use('/api/sessions', require('./routes/sessions')(db));
  app.use('/api/tasks', require('./routes/tasks')(db));
  app.use('/api/resources', require('./routes/resources')(db));
  app.use('/api/notes', require('./routes/notes')(db));
  app.use('/api', require('./routes/data')(db));
  app.use('/api', apiNotFound);

  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
