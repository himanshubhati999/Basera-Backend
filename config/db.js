const mongoose = require('mongoose');

let isConnected = false;
let connectPromise = null;

const connectDB = async () => {
  if (connectPromise) {
    console.log('Waiting for in-flight MongoDB connection');
    return connectPromise;
  }

  // If already connected, return
  if (isConnected && mongoose.connection.readyState === 1) {
    console.log('Using existing MongoDB connection');
    return mongoose.connection;
  }

  try {
    const mongoUri = (process.env.MONGODB_URI || '').trim();

    if (!mongoUri) {
      throw new Error('MONGODB_URI is not set');
    }

    // Share one connection attempt between concurrent serverless requests.
    connectPromise = mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 20000,
      connectTimeoutMS: 20000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 0,
      family: 4,
    });

    const conn = await connectPromise;

    isConnected = true;
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    console.error(`Error details:`, error);
    isConnected = false;
    
    // Always throw the error so it can be handled properly
    throw new Error(`Database connection failed: ${error.message}`);
  } finally {
    connectPromise = null;
  }
};

module.exports = connectDB;
