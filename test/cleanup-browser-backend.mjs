import mongoose from 'mongoose';
import { readFileSync } from 'node:fs';
process.loadEnvFile('.env');
const {database}=JSON.parse(readFileSync('FE/FE-hoiquy3d/output/playwright/live-backend.json','utf8'));
if(typeof database!=='string'||!/^regression_browser_[a-f0-9]{16}$/.test(database))throw new Error('Refusing unexpected cleanup target');
const connection=await mongoose.createConnection(process.env.MONGODB_URI||process.env.connection_string,{dbName:database,serverSelectionTimeoutMS:3000}).asPromise();
try{if(connection.name!==database)throw new Error('Database mismatch');await connection.dropDatabase();console.log('Isolated browser test database cleaned');}finally{await connection.close();}
