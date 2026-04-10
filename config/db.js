const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
  // If already connected, return
  if (isConnected && mongoose.connection.readyState === 1) {
    console.log('Using existing MongoDB connection');
    return;
  }

  try {
    const mongoUri = (process.env.MONGODB_URI || '').trim();

    if (!mongoUri) {
      throw new Error('MONGODB_URI is not set');
    }

    // Optimize for serverless environment and avoid keeping idle sockets.
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 20000,
      connectTimeoutMS: 20000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 0,
      family: 4,
    });

    isConnected = true;
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    console.error(`Error details:`, error);
    isConnected = false;
    
    // Always throw the error so it can be handled properly
    throw new Error(`Database connection failed: ${error.message}`);
  }
};

module.exports = connectDB;
