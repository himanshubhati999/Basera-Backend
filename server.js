const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

// Debug: Log environment on startup
console.log('=== SERVER STARTUP ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('MONGODB_URI exists:', !!process.env.MONGODB_URI);
console.log('MONGODB_URI length:', process.env.MONGODB_URI ? process.env.MONGODB_URI.length : 0);
console.log('PORT:', process.env.PORT || 3000);
console.log('======================');

// Initialize express app
const app = express();

// Middleware
// Configure CORS to allow your frontend domain
const defaultAllowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'https://baserainfrahome.com',
  'http://baserainfrahome.com'
];

const envAllowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = new Set([...defaultAllowedOrigins, ...envAllowedOrigins]);

const isVercelDomain = (origin) => /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no Origin header (e.g., curl, server-to-server)
    if (!origin) return callback(null, true);

    // Allow any localhost port for local frontend dev servers.
    if (/^http:\/\/localhost:\d+$/.test(origin)) {
      return callback(null, true);
    }

    // Allow Vercel frontend deployments (preview + production subdomains)
    if (isVercelDomain(origin)) {
      return callback(null, true);
    }

    if (allowedOrigins.has(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB (lazy connection for serverless)
let dbConnected = false;
let connectionAttempts = 0;
let lastConnectionError = null;

const isMongoConnected = () => mongoose.connection.readyState === 1;

const ensureDbConnection = async (req, res, next) => {
  // If runtime state is connected, skip reconnect attempts.
  if (isMongoConnected()) {
    dbConnected = true;
    connectionAttempts = 0;
    lastConnectionError = null;
    return next();
  }

  // Guard against stale flag values when Mongo disconnects after startup.
  dbConnected = false;

  try {
    connectionAttempts++;
    console.log(`MongoDB connection attempt ${connectionAttempts}`);
    console.log('MONGODB_URI exists:', !!process.env.MONGODB_URI);
    console.log('NODE_ENV:', process.env.NODE_ENV);

    await connectDB();

    if (!isMongoConnected()) {
      throw new Error('MongoDB connection was not established');
    }

    dbConnected = true;
    connectionAttempts = 0;
    lastConnectionError = null;
    console.log('MongoDB connected successfully');
    return next();
  } catch (error) {
    console.error('Database connection error:', error.message);
    console.error('Full error:', error);
    lastConnectionError = error.message;

    return res.status(503).json({ 
      success: false, 
      message: 'Database not available. Please check MongoDB Atlas network access settings and credentials.',
      error: lastConnectionError,
      mongoUri: process.env.MONGODB_URI ? 'exists' : 'missing',
      nodeEnv: process.env.NODE_ENV,
      attempts: connectionAttempts
    });
  }
};

const warmUpDbConnection = async () => {
  try {
    await connectDB();

    if (isMongoConnected()) {
      dbConnected = true;
      connectionAttempts = 0;
      lastConnectionError = null;
      console.log('MongoDB warm-up connection successful');
    }
  } catch (error) {
    dbConnected = false;
    lastConnectionError = error.message;
    console.warn('MongoDB warm-up connection failed:', error.message);
  }
};

warmUpDbConnection();

// Health check route (NO DB REQUIRED - must be first)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Debug endpoint to check env vars and DB status (NO DB REQUIRED)
app.get('/api/debug', (req, res) => {
  res.json({
    nodeEnv: process.env.NODE_ENV,
    hasMongoUri: !!process.env.MONGODB_URI,
    hasJwtSecret: !!process.env.JWT_SECRET,
    mongoUriStart: process.env.MONGODB_URI ? process.env.MONGODB_URI.substring(0, 20) + '...' : 'not set',
    dbConnected: dbConnected && isMongoConnected(),
    mongoReadyState: mongoose.connection.readyState,
    connectionAttempts: connectionAttempts,
    lastError: lastConnectionError,
    port: process.env.PORT || 3000
  });
});

// Routes (with DB connection middleware applied to routes that need it)
app.use('/api/auth', ensureDbConnection, require('./routes/auth'));
app.use('/api/wishlist', ensureDbConnection, require('./routes/wishlist'));
app.use('/api/properties', ensureDbConnection, require('./routes/property'));
app.use('/api/admin', ensureDbConnection, require('./routes/admin'));
app.use('/api/consults', ensureDbConnection, require('./routes/consult'));
app.use('/api/consult-fields', ensureDbConnection, require('./routes/consultField'));
app.use('/api/pages', ensureDbConnection, require('./routes/page'));
app.use('/api/upload', ensureDbConnection, require('./routes/upload'));
app.use('/api/reviews', ensureDbConnection, require('./routes/review'));
app.use('/api/analytics', ensureDbConnection, require('./routes/analytics'));
app.use('/api/testimonials', ensureDbConnection, require('./routes/testimonial'));

// Serve uploaded images (static files)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve static files from React build folder (after API routes)
app.use(express.static(path.join(__dirname, 'build')));

// Serve React app for all non-API routes (must be AFTER API routes)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// Export app for managed hosting platforms
// Only start server locally for development
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

module.exports = app;
