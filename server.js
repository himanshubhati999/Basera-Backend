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
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    'https://baserainfrahome.com',
    'http://baserainfrahome.com'
  ],
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
      console.log('MongoDB connected successfully');
    } catch (error) {
      console.error('Database connection error:', error.message);
      console.error('Full error:', error);
      
      // If max attempts reached, return error
      if (connectionAttempts >= MAX_CONNECTION_ATTEMPTS) {
        return res.status(503).json({ 
          success: false, 
          message: 'Database connection failed. Please check MongoDB Atlas network access settings.',
          error: error.message, // Temporarily show error in production for debugging
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
      error: 'Max connection attempts exceeded',
      mongoUri: process.env.MONGODB_URI ? 'exists' : 'missing',
      nodeEnv: process.env.NODE_ENV,
      attempts: connectionAttempts
    });
  }
  
  next();
};

// Apply database connection middleware to all routes
app.use('/api', ensureDbConnection);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/wishlist', require('./routes/wishlist'));
app.use('/api/properties', require('./routes/property'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/consults', require('./routes/consult'));
app.use('/api/consult-fields', require('./routes/consultField'));
app.use('/api/pages', require('./routes/page'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/reviews', require('./routes/review'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/testimonials', require('./routes/testimonial'));

// Serve static files from React build folder
app.use(express.static(path.join(__dirname, 'build')));

// Health check route (API only)
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Debug endpoint to check env vars (remove in production)
app.get('/api/debug', (req, res) => {
  res.json({
    nodeEnv: process.env.NODE_ENV,
    hasMongoUri: !!process.env.MONGODB_URI,
    hasJwtSecret: !!process.env.JWT_SECRET,
    mongoUriStart: process.env.MONGODB_URI ? process.env.MONGODB_URI.substring(0, 20) + '...' : 'not set',
    dbConnected: dbConnected,
    connectionAttempts: connectionAttempts
  });
});

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

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
