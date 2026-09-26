// Centralized error handler. Route handlers should call next(err)
// (or wrap async work in the asyncHandler helper below) instead of
// building their own try/catch + res.status boilerplate everywhere.

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // eslint-disable-next-line no-console
  console.error(err);

  if (err.code === '23505') {
    // Postgres unique_violation
    return res.status(409).json({ error: 'A record with that value already exists' });
  }
  if (err.code === '23503') {
    // Postgres foreign_key_violation
    return res.status(400).json({ error: 'Referenced record does not exist' });
  }

  const status = err.status || 500;
  return res.status(status).json({ error: err.message || 'Internal server error' });
}

module.exports = { asyncHandler, errorHandler };
