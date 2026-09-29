import mongoose from 'mongoose';
import { event, zones, facilities, incidents, responders, missingPersons, alerts, exits, demoUsers } from '../src/data/demoData.js';
import { Models } from './models.js';

const clone = value => structuredClone(value);
export const state = {
  events: [clone(event)], zones: clone(zones), facilities: clone(facilities), incidents: clone(incidents), responders: clone(responders),
  missingPersons: clone(missingPersons), alerts: clone(alerts), exits: clone(exits), reports: [], users: [], locationShares: [], auditLogs: []
};

export async function connectDatabase(uri) {
  if (!uri) { console.info('MongoDB not configured — using in-memory demo data.'); return false; }
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 3500 });
    for (const key of Object.keys(state)) {
      if (!Models[key]) continue;
      const docs = await Models[key].find().lean();
      if (docs.length) state[key] = docs.map(({ __v, ...doc }) => doc);
      else if (state[key].length) await Models[key].insertMany(state[key].map(item => ({ ...item, _id: String(item._id) })), { ordered: false });
    }
    console.info('MongoDB connected; demo data is available for Central Festival 2026.');
    return true;
  } catch (error) {
    console.warn(`MongoDB unavailable (${error.message}). Continuing with in-memory demo data.`);
    if (mongoose.connection.readyState) await mongoose.disconnect();
    return false;
  }
}

export function persist(collection, doc) {
  if (mongoose.connection.readyState !== 1 || !Models[collection]) return;
  Models[collection].findOneAndUpdate({ _id: String(doc._id) }, { $set: doc }, { upsert: true, new: true }).catch(error => console.error('Mongo write failed:', error.message));
}
export function removePersisted(collection, id) {
  if (mongoose.connection.readyState === 1 && Models[collection]) Models[collection].deleteOne({ _id: String(id) }).catch(error => console.error(error.message));
}
