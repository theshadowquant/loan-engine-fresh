module.exports = (err, req, res, next) => {
  const isProd = process.env.NODE_ENV === 'production';

  // mysql2 duplicate-key error → 409
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'A record with this value already exists.' });
  }

  console.error(isProd ? `[ERROR] ${err.message}` : err);

  res.status(err.status || 500).json({
    error:   err.message || 'Internal server error',
    ...(isProd ? {} : { stack: err.stack }),
  });
};

