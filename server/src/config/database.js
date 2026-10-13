const mongoose = require('mongoose');

/**
 * Connect to MongoDB if URI is provided.
 * Fails gracefully so server continues operating in in-memory mode if DB is unavailable.
 */
const connectDB = async () => {
  const mongoURI = process.env.MONGODB_URI;

  if (!mongoURI) {
    console.log('[Database] No MONGODB_URI provided. Running in in-memory mode only.');
    return;
  }

  try {
    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[Database] MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.warn(`[Database] MongoDB connection warning: ${error.message}`);
    console.warn('[Database] Continuing in in-memory mode without persistent database.');
  }

  mongoose.connection.on('error', (err) => {
    console.error(`[Database] MongoDB runtime error: ${err.message}`);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[Database] MongoDB disconnected.');
  });
};

module.exports = { connectDB };
