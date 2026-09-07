const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message;

  // Mongoose bad ObjectId
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 404;
    message = 'Resource not found';
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `A record with this ${field} already exists`;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map(e => e.message).join(', ');
  }

  // JWT errors — provide generic message, do not expose token details
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Not authorized, invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Not authorized, token expired';
  }

  // Log 401/403/500 for security auditing
  if (statusCode === 401 || statusCode === 403) {
    console.warn(
      `[SECURITY] ${statusCode} | ${req.method} ${req.originalUrl} | IP: ${req.ip} | msg: ${message}`
    );
  } else if (statusCode >= 500) {
    // Log full error internally for 500s but NEVER expose internals to client
    console.error(`[ERROR] 500 | ${req.method} ${req.originalUrl} | IP: ${req.ip}`, err);
  }

  // In production, replace unexpected 500 messages with a generic one
  // to prevent leaking stack traces, DB details, or internal logic
  if (statusCode >= 500 && process.env.NODE_ENV === 'production') {
    message = 'An unexpected error occurred. Please try again later.';
  }

  res.status(statusCode).json({
    success: false,
    message,
    // Only include stack trace in development — never in production
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
