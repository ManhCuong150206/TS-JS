import mongoose from 'mongoose';

const email = process.argv[2]?.trim().toLowerCase();
const apply = process.argv.includes('--apply');
if (!email || email.startsWith('--'))
  throw new Error(
    'Usage: npm run migrate-anonymous -- admin@example.com [--apply]',
  );
const uri = process.env.MONGODB_URI || process.env.connection_string;
if (!uri) throw new Error('Thiếu MONGODB_URI hoặc connection_string');

try {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const admin = await db
    .collection('users')
    .findOne({ email, role: 'admin', status: 'active' });
  if (!admin) throw new Error('Email phải thuộc một admin đang active');
  const ownerId = admin._id.toString();
  for (const name of ['datasets', 'experiments', 'trainingRuns']) {
    const collection = db.collection(name);
    if (apply) {
      const result = await collection.updateMany(
        { ownerId: 'anonymous_user' },
        {
          $set: { ownerId, updatedAt: new Date() },
          $inc: { syncVersion: 1 },
        },
      );
      console.log(`${name}: migrated ${result.modifiedCount}`);
    } else {
      console.log(
        `${name}: ${await collection.countDocuments({ ownerId: 'anonymous_user' })} records (dry run)`,
      );
    }
  }
} finally {
  await mongoose.disconnect();
}
