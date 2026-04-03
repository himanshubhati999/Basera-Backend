const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
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
const allowedOrigins = new Set([
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'https://baserainfrahome.com',
  'http://baserainfrahome.com'
]);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no Origin header (e.g., curl, server-to-server)
    if (!origin) return callback(null, true);

    // Allow any localhost port for local frontend dev servers.
    if (/^http:\/\/localhost:\d+$/.test(origin)) {
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
const MAX_CONNECTION_ATTEMPTS = 3;

const ensureDbConnection = async (req, res, next) => {
  if (!dbConnected && connectionAttempts < MAX_CONNECTION_ATTEMPTS) {
    try {
      connectionAttempts++;
      console.log(`MongoDB connection attempt ${connectionAttempts}/${MAX_CONNECTION_ATTEMPTS}`);
      console.log('MONGODB_URI exists:', !!process.env.MONGODB_URI);
      console.log('NODE_ENV:', process.env.NODE_ENV);
      
      await connectDB();
      dbConnected = true;
      lastConnectionError = null;
      console.log('MongoDB connected successfully');
    } catch (error) {
      console.error('Database connection error:', error.message);
      console.error('Full error:', error);
      lastConnectionError = error.message;
      
      // If max attempts reached, return error
      if (connectionAttempts >= MAX_CONNECTION_ATTEMPTS) {
        return res.status(503).json({ 
          success: false, 
          message: 'Database connection failed. Please check MongoDB Atlas network access settings.',
          error: error.message,
          mongoUri: process.env.MONGODB_URI ? 'exists' : 'missing',
          nodeEnv: process.env.NODE_ENV
        });
      }
    }
  }
  
  // If still not connected after attempts, return error
  if (!dbConnected) {
    return res.status(503).json({ 
      success: false, 
      message: 'Database not available. Please try again later.',
      error: lastConnectionError || 'Max connection attempts exceeded',
      mongoUri: process.env.MONGODB_URI ? 'exists' : 'missing',
      nodeEnv: process.env.NODE_ENV,
      attempts: connectionAttempts
    });
  }
  
  next();
};

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
    dbConnected: dbConnected,
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

// Export app for Hostinger (they handle the port binding)
// Only start server locally for development
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

module.exports = app;
