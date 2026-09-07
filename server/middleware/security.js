const rateLimit = require('express-rate-limit');

// 1. Strict Auth Rate Limiter
// Applied to login and register-store endpoints
// Protects against brute-force and credential-stuffing attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // max 10 attempts per IP per window
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP. Please try again in 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    console.warn(`[RATE_LIMIT] Auth rate limit hit | IP: ${req.ip} | ${req.method} ${req.originalUrl}`);
    res.status(429).json(options.message);
  }
});

// 2. Global API Rate Limiter
// Applied to all API routes to prevent abuse/DoS
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,                  // 300 requests per IP per window (generous for dashboard use)
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => ['/api/health', '/health', '/', '/api'].includes(req.path),
});

// NOTE: strictOrigin (blocking Postman/Hoppscotch) has been intentionally removed.
// Per security requirements, do NOT block API clients — instead, enforce auth/authz properly.
// CORS is a browser mechanism, not an authorization mechanism.

module.exports = { authLimiter, apiLimiter };
