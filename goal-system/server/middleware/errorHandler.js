class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function apiNotFound(req, res) {
  res.status(404).json({ error: 'Route not found' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body is not valid JSON' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body is too large' });
  }
  if (typeof err.code === 'string' && err.code.startsWith('SQLITE_CONSTRAINT')) {
    return res.status(400).json({ error: 'Request conflicts with existing data' });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}

module.exports = { HttpError, apiNotFound, errorHandler };
