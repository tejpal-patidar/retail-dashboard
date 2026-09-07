/**
 * Role-based access control middleware.
 * Must always be used AFTER the `protect` middleware so that req.user is available.
 * The user's role is sourced exclusively from the verified database record — never from the request.
 */
const roleCheck = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401);
      throw new Error('Not authorized — authentication required');
    }

    // isActive is also checked in protect middleware, but this is belt-and-suspenders defense
    if (!req.user.isActive) {
      console.warn(`[AUTHZ] Inactive user attempted access | userId: ${req.user._id} | IP: ${req.ip}`);
      res.status(401);
      throw new Error('Account has been deactivated');
    }

    if (!roles.includes(req.user.role)) {
      // Security log: authorized user attempting an unauthorized action
      console.warn(
        `[AUTHZ] Forbidden access | userId: ${req.user._id} | role: ${req.user.role} | required: [${roles.join(', ')}] | ${req.method} ${req.originalUrl} | IP: ${req.ip}`
      );
      res.status(403);
      throw new Error(`Access denied. Required role(s): ${roles.join(', ')}`);
    }

    next();
  };
};

module.exports = roleCheck;
