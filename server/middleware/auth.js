const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');

const protect = asyncHandler(async (req, res, next) => {
  let token;

  // Extract token from Authorization header or httpOnly cookie
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    // Security log: unauthenticated request
    console.warn(`[AUTH] No token provided | IP: ${req.ip} | ${req.method} ${req.originalUrl}`);
    res.status(401);
    throw new Error('Not authorized, no token');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    // Security log: invalid/expired token
    console.warn(`[AUTH] Invalid/expired token | IP: ${req.ip} | ${req.method} ${req.originalUrl} | Error: ${err.message}`);
    res.status(401);
    throw new Error('Not authorized, token invalid');
  }

  // Load the user from DB — this is the authoritative source of identity
  // Never trust userId, role, storeId from the request body or query string
  const user = await User.findById(decoded.id).select('-password');

  if (!user) {
    console.warn(`[AUTH] Token references non-existent user: ${decoded.id} | IP: ${req.ip}`);
    res.status(401);
    throw new Error('Not authorized, user not found');
  }

  // Check if account is active — deactivated users must not access the API
  if (!user.isActive) {
    console.warn(`[AUTH] Deactivated user attempted access | userId: ${user._id} | IP: ${req.ip} | ${req.method} ${req.originalUrl}`);
    res.status(401);
    throw new Error('Account has been deactivated');
  }

  // Attach authoritative identity to request — all downstream code must use these
  req.user = user;

  // Derive storeId from the verified DB user — NEVER from req.body or req.query
  req.storeId = user.store;

  next();
});

module.exports = { protect };
