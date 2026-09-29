import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { Models } from './models.js';
import { event, zones, facilities, incidents, responders, missingPersons, alerts, exits, demoUsers } from '../src/data/demoData.js';

if (!process.env.MONGODB_URI) {
  console.error('Set MONGODB_URI in .env before running the database seed.');
  process.exit(1);
}
await mongoose.connect(process.env.MONGODB_URI);
const demoPassword = process.env.DEMO_PASSWORD || 'demo123';
const data = { events: [event], zones, facilities, incidents, responders, missingPersons, alerts, exits,
  users: await Promise.all(demoUsers.map(async user => ({ ...user, passwordHash: await bcrypt.hash(demoPassword, 10) }))) };
for (const [collection, rows] of Object.entries(data)) {
  for (const row of rows) await Models[collection].findOneAndUpdate({ _id: String(row._id) }, { $set: row }, { upsert: true, new: true });
  console.info(`Seeded ${rows.length} ${collection}`);
}
await mongoose.disconnect();
console.info('Demo event seeded.');
