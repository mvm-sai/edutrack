/**
 * Admin-only middleware.
 * Must be used AFTER the auth middleware (which sets req.teacher).
 * Returns 403 if the logged-in user is not an admin.
 */
const adminAuth = (req, res, next) => {
  if (!req.teacher || req.teacher.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }
  next();
};

module.exports = adminAuth;
