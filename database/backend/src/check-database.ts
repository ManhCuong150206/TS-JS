import 'dotenv/config';
import { connectToDatabase, disconnectFromDatabase } from './config/database.js';
import './models/index.js';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

try {
  const connection = await connectToDatabase();
  console.log(`Connected to MongoDB database: ${connection.name}`);
} catch (error: unknown) {
  console.error(`MongoDB connection failed: ${getErrorMessage(error)}`);
  process.exitCode = 1;
} finally {
  await disconnectFromDatabase();
}
