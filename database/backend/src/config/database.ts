import mongoose from 'mongoose';

let connectionPromise: Promise<typeof mongoose.connection> | undefined;

/** Connect once and reuse the MongoDB connection across the application. */
export async function connectToDatabase(
  uri: string | undefined = process.env.MONGODB_URI
): Promise<typeof mongoose.connection> {
  if (!uri) {
    throw new Error('MONGODB_URI is not set. Copy .env.example to .env and configure it.');
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(uri, {
      dbName: process.env.MONGODB_DB_NAME || 'regression_lab',
      serverSelectionTimeoutMS: 5000
    }).then(() => mongoose.connection).catch((error: unknown) => {
      connectionPromise = undefined;
      throw error;
    });
  }

  return connectionPromise;
}

export async function disconnectFromDatabase(): Promise<void> {
  connectionPromise = undefined;
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

export { mongoose };
