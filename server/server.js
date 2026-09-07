const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const { apiLimiter } = require('./middleware/security');
const dotenv = require('dotenv');

dotenv.config();

const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Routes
const authRoutes = require('./routes/auth');
const salesRoutes = require('./routes/sales');
const inventoryRoutes = require('./routes/inventory');
const customerRoutes = require('./routes/customers');
const staffRoutes = require('./routes/staff');
const reportRoutes = require('./routes/reports');
const storeRoutes = require('./routes/store');
const expenseRoutes = require('./routes/expenses');

// Connect DB
connectDB();

const app = express();

// ─── CORS ─────────────────────────────────────────────────────────────────────
// In production, restrict to known frontend origins.
// In development, allow all origins for convenience.
// IMPORTANT: CORS is a browser security feature — it is NOT an authorization mechanism.
// Proper JWT-based authentication and ownership checks provide actual security.
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman — auth handles their access)
    if (!origin) return callback(null, true);

    if (process.env.NODE_ENV === 'development') {
      // Development: allow all origins
      return callback(null, true);
    }

    // Production: check against allowed origins list or any .vercel.app deployment
    if (
      allowedOrigins.length === 0 ||
      allowedOrigins.includes(origin) ||
      origin.endsWith('.vercel.app')
    ) {
      return callback(null, true);
    }

    return callback(new Error(`CORS: Origin ${origin} not allowed`));
  },
  credentials: true,
  optionsSuccessStatus: 200,
}));

// ─── Security Headers (Helmet) ─────────────────────────────────────────────────
app.use(helmet({
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  crossOriginEmbedderPolicy: false, // Allows PDFs to load in iframes
}));

// ─── Global Rate Limiter ────────────────────────────────────────────────────────
// Applies to all API routes — prevents abuse and DoS
app.use(apiLimiter);

// ─── Input Sanitization ────────────────────────────────────────────────────────
app.use(mongoSanitize()); // Prevent NoSQL injection (strips $ and . from user input)
app.use(xss());           // Prevent XSS (sanitizes HTML from user input)

// ─── Body Parsers ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));           // Prevent extremely large payloads
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(cookieParser());

// ─── API Routes ───────────────────────────────────────────────────────────────
// Helper to mount routes under a prefix (/api and fallback root)
const mountApiRoutes = (prefix = '') => {
  app.use(`${prefix}/auth`, authRoutes);
  app.use(`${prefix}/sales`, salesRoutes);
  app.use(`${prefix}/inventory`, inventoryRoutes);
  app.use(`${prefix}/customers`, customerRoutes);
  app.use(`${prefix}/staff`, staffRoutes);
  app.use(`${prefix}/reports`, reportRoutes);
  app.use(`${prefix}/store`, storeRoutes);
  app.use(`${prefix}/expenses`, expenseRoutes);
};

// Mount under /api (standard) and '' (fallback if client baseURL omits /api)
mountApiRoutes('/api');
mountApiRoutes('');

// ─── Welcome / Root Endpoint ──────────────────────────────────────────────────
app.get(['/', '/api'], (req, res) => {
  res.status(200).json({
    success: true,
    message: 'GroceryIQ Retail Store API is live and running 🚀',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      sales: '/api/sales',
      inventory: '/api/inventory',
      customers: '/api/customers',
      staff: '/api/staff',
      store: '/api/store',
      expenses: '/api/expenses',
      reports: '/api/reports'
    }
  });
});

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get(['/health', '/api/health'], (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── 404 Handler for unmatched routes ─────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ─── Error Handler (must be last) ─────────────────────────────────────────────
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Only listen if not running on Vercel
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
