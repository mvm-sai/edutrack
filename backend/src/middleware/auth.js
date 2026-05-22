const jwt = require('jsonwebtoken');

/**
 * JWT authentication middleware.
 * Expects:  Authorization: Bearer <token>
 * Sets req.teacher = decoded token payload on success.
 */
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  const token = authHeader.slice(7); // Remove "Bearer "

  try {
    const decoded  = jwt.verify(token, process.env.JWT_SECRET);
    req.teacher    = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Invalid token. Please log in.' });
  }
};

module.exports = authMiddleware;
