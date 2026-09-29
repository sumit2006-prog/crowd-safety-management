import mongoose from 'mongoose';

// Flexible schemas let event operators extend the record without a migration for every map field.
const schema = new mongoose.Schema({ _id: { type: String, required: true }, createdAt: { type: Date, default: Date.now } }, { strict: false, timestamps: true, versionKey: false });
const model = (name, collection) => mongoose.models[name] || mongoose.model(name, schema, collection);

export const Models = {
  users: model('User', 'users'), events: model('Event', 'events'), zones: model('Zone', 'zones'), facilities: model('Facility', 'facilities'),
  incidents: model('Incident', 'incidents'), responders: model('Responder', 'responders'), missingPersons: model('MissingPerson', 'missingPersons'),
  alerts: model('Alert', 'alerts'), reports: model('Report', 'reports'), exits: model('Exit', 'exits'), locationShares: model('LocationShare', 'locationShares'), auditLogs: model('AuditLog', 'auditLogs')
};
