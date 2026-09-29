import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'node:http';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Server as SocketServer } from 'socket.io';
import { rateLimit } from 'express-rate-limit';
import { connectDatabase, state, persist, removePersisted } from './store.js';
import { demoUsers, event as demoEvent } from '../src/data/demoData.js';

const app = express();
const server = http.createServer(app);
const io = new SocketServer(server, { cors: { origin: process.env.CLIENT_ORIGIN || '*', methods: ['GET', 'POST', 'PATCH'] } });
const PORT = Number(process.env.PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET || 'crowd-safe-local-demo-secret-change-me';
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) throw new Error('JWT_SECRET must be set in production.');
const now = () => new Date().toISOString();
const id = prefix => `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
const emit = (eventName, payload) => io.emit(eventName, payload);
const publicIncident = item => ({ _id: item._id, category: item.category, title: `Verified ${item.category} report`, zone: safeZone(item.zone), lat: item.lat, lng: item.lng, severity: item.severity, status: item.status, createdAt: item.createdAt, updatedAt: item.updatedAt });
const publicMissingPerson = row => ({ _id: row._id, status: row.status, createdAt: row.createdAt, updatedAt: row.updatedAt });
const publicDuplicate = row => row ? ({ _id: row._id, category: row.category, status: row.status, createdAt: row.createdAt }) : null;
const allowedCategories = new Set(['Fire', 'Medical', 'Blocked Exit', 'Crowd Problem', 'Missing Person', 'Security Issue', 'Lighting Problem', 'Water Problem', 'Facility Problem', 'Lost Item']);
const safeZone = value => state.zones.find(zone => zone.name === String(value || '').slice(0, 160))?.name || 'Event grounds';
function publicAlertMessage(category, zone) {
  const messages = {
    Fire: 'Event staff have verified a fire safety alert. Keep access lanes clear and follow official directions.',
    Medical: 'Medical support has been coordinated. Give responders clear access and follow staff guidance.',
    'Blocked Exit': 'A route issue has been verified. Use an open route and follow signs and event staff directions.',
    'Crowd Problem': 'Crowd conditions need attention. Keep walkways clear and follow event staff guidance.',
    'Security Issue': 'A security response is active. Avoid the immediate area and follow staff instructions.'
  };
  return `${messages[category] || `A ${category.toLowerCase()} safety report has been reviewed by event staff.`} Area: ${zone}.`;
}
const publicAlert = alert => {
  if (alert.category === 'Missing Person') return null;
  if (!allowedCategories.has(alert.category)) return alert;
  return { ...alert, title: `${alert.category} — ${safeZone(alert.zone)}`, message: publicAlertMessage(alert.category, safeZone(alert.zone)) };
};
const safeImage = value => typeof value === 'string' && /^data:image\/(?:png|jpeg|webp);base64,/.test(value) && value.length <= 4_200_000 ? value : undefined;
const imageIsInvalid = value => value != null && value !== '' && !safeImage(value);
function findPossibleDuplicate(category, lat, lng, omitId) {
  const normalized = String(category).trim().toLowerCase();
  return [...state.incidents, ...state.reports].find(row => String(row._id) !== String(omitId || '') &&
    String(row.category).trim().toLowerCase() === normalized &&
    Date.now() - new Date(row.createdAt).getTime() < 15 * 60_000 &&
    Number.isFinite(Number(row.lat)) && Number.isFinite(Number(row.lng)) &&
    Math.hypot(Number(row.lat) - Number(lat), Number(row.lng) - Number(lng)) < 0.0018);
}

app.use(cors({ origin: process.env.CLIENT_ORIGIN || true }));
app.use(express.json({ limit: '5mb' }));
const authRateLimit = rateLimit({ windowMs: 15 * 60_000, limit: 12, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many sign-in attempts. Please try again later.' } });
const publicReportLimit = rateLimit({ windowMs: 60_000, limit: 8, standardHeaders: 'draft-7', legacyHeaders: false, skip: req => req.method !== 'POST', message: { error: 'Please wait a moment before sending another report.' } });
app.use('/api/auth', authRateLimit);
app.use(['/api/reports', '/api/incidents', '/api/missing-persons'], publicReportLimit);

function auth(required = true) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) return required ? res.status(401).json({ error: 'Sign in to continue.' }) : next();
    try { req.user = jwt.verify(header.slice(7), JWT_SECRET); next(); }
    catch { return res.status(401).json({ error: 'Your session expired. Please sign in again.' }); }
  };
}
function roles(...allowed) {
  return (req, res, next) => allowed.includes(req.user?.role) ? next() : res.status(403).json({ error: 'This action is restricted to event staff.' });
}
function audit(req, action, target) {
  const record = { _id: id('log'), actor: req.user?.email || 'Public visitor', action, target, createdAt: now() };
  state.auditLogs.unshift(record); persist('auditLogs', record);
}
function add(collection, document, socketEvent) {
  state[collection].unshift(document); persist(collection, document);
  // Never fan out private report details, responder coordinates or location tokens to public sockets.
  if (socketEvent === 'incident_created') emit(socketEvent, { _id: document._id, category: document.category, status: document.status, createdAt: document.createdAt });
  else if (socketEvent === 'missing_person_created') emit(socketEvent, { _id: document._id, status: document.status, createdAt: document.createdAt });
  else if (socketEvent) emit(socketEvent, document);
  return document;
}
function update(collection, itemId, patch, socketEvent) {
  const item = state[collection].find(row => String(row._id) === String(itemId));
  if (!item) return null;
  Object.assign(item, patch, { updatedAt: now() }); persist(collection, item);
  if (socketEvent === 'responder_assigned' || socketEvent === 'responder_status_changed') emit(socketEvent, { _id: item._id, status: item.status, updatedAt: item.updatedAt });
  else if (socketEvent === 'missing_person_updated') emit(socketEvent, { _id: item._id, status: item.status, updatedAt: item.updatedAt });
  else if (socketEvent === 'incident_verified' || socketEvent === 'incident_resolved') emit(socketEvent, publicIncident(item));
  else if (socketEvent) emit(socketEvent, item);
  return item;
}
function resolveLinkedAlert(item) {
  const alert = item.alertId && state.alerts.find(row => String(row._id) === String(item.alertId));
  if (!alert || alert.status !== 'ACTIVE') return;
  Object.assign(alert, { status: 'RESOLVED', updatedAt: now() }); persist('alerts', alert); emit('alert_removed', { _id: alert._id });
}
const cleanUser = user => ({ _id: user._id, name: user.name, email: user.email, role: user.role });
const tokenFor = user => jwt.sign({ sub: user._id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '12h' });

app.get('/api/health', (_req, res) => res.json({ ok: true, mode: process.env.MONGODB_URI ? 'mongo-or-demo-fallback' : 'demo', event: demoEvent.name, mongo: process.env.MONGODB_URI ? 'configured' : 'not-configured' }));
app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (email.length > 160 || password.length > 128) return res.status(400).json({ error: 'Invalid credentials.' });
  const demo = email === 'organizer@crowdsafe.demo' || email === 'admin@crowdsafe.demo';
  let user = state.users.find(row => row.email.toLowerCase() === email);
  if (!user && demo && password === (process.env.DEMO_PASSWORD || 'demo123')) {
    const seed = demoUsers.find(row => row.email === email);
    user = { ...seed, passwordHash: await bcrypt.hash(password, 10) };
    state.users.push(user); persist('users', user);
  }
  if (!user || !(await bcrypt.compare(password, user.passwordHash || ''))) return res.status(401).json({ error: 'Email or password is incorrect.' });
  return res.json({ token: tokenFor(user), user: cleanUser(user) });
});
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (typeof name !== 'string' || name.trim().length < 2 || name.length > 80 || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email) || typeof password !== 'string' || password.length < 8 || password.length > 128) return res.status(400).json({ error: 'Enter a name, valid email, and password with at least 8 characters.' });
  if (state.users.some(user => user.email.toLowerCase() === email.toLowerCase())) return res.status(409).json({ error: 'An account with this email already exists.' });
  const user = { _id: id('user'), name: name.trim(), email: email.trim().toLowerCase(), role: 'Visitor', passwordHash: await bcrypt.hash(password, 12), createdAt: now() };
  state.users.push(user); persist('users', user);
  res.status(201).json({ token: tokenFor(user), user: cleanUser(user) });
});

app.get('/api/events', (_req, res) => res.json(state.events));
app.post('/api/events', auth(), roles('Organizer', 'Admin'), (req, res) => {
  const body = req.body || {};
  if (!body.name?.trim() || !body.venue?.trim()) return res.status(400).json({ error: 'Event name and venue are required.' });
  const record = { _id: id('event'), ...body, updatedAt: now() };
  add('events', record); audit(req, 'created event', record.name); res.status(201).json(record);
});
app.patch('/api/events/:id', auth(), roles('Organizer', 'Admin'), (req, res) => {
  const updated = update('events', req.params.id, req.body); if (!updated) return res.status(404).json({ error: 'Event not found.' });
  audit(req, 'updated event settings', updated.name); res.json(updated);
});

app.get('/api/dashboard', auth(false), (req, res) => {
  const staff = ['Organizer', 'Admin', 'Security', 'Medical Responder', 'Fire Responder'].includes(req.user?.role);
  const missingStaff = ['Organizer', 'Admin', 'Security'].includes(req.user?.role);
  const incidents = staff ? state.incidents : state.incidents.filter(i => !['UNVERIFIED', 'REJECTED'].includes(i.status) && i.category !== 'Missing Person').map(publicIncident);
  // Public dashboards may show that reunification support is active, never who is missing or where they were last seen.
  const missingPersons = missingStaff ? state.missingPersons : state.missingPersons.map(publicMissingPerson);
  res.json({ event: state.events[0] || demoEvent, zones: state.zones, facilities: state.facilities, incidents, responders: staff ? state.responders : [], missingPersons, alerts: state.alerts.map(publicAlert).filter(Boolean), exits: state.exits });
});
app.get('/api/facilities', (req, res) => res.json(req.query.category ? state.facilities.filter(f => f.category.toLowerCase() === String(req.query.category).toLowerCase()) : state.facilities));
app.post('/api/facilities', auth(), roles('Organizer', 'Admin'), (req, res) => { const item = add('facilities', { _id: id('facility'), ...req.body, createdAt: now() }); audit(req, 'created facility', item.name); res.status(201).json(item); });
app.get('/api/zones', (_req, res) => res.json(state.zones));
app.patch('/api/zones/:id', auth(), roles('Organizer', 'Admin'), (req, res) => { const item = update('zones', req.params.id, req.body, 'crowd_updated'); if (!item) return res.status(404).json({ error: 'Zone not found.' }); audit(req, 'updated zone', item.name); res.json(item); });

app.get('/api/incidents', auth(false), (req, res) => {
  const staff = ['Organizer', 'Admin', 'Security', 'Medical Responder', 'Fire Responder'].includes(req.user?.role);
  const visible = staff ? state.incidents : state.incidents.filter(i => !['UNVERIFIED', 'REJECTED'].includes(i.status) && i.category !== 'Missing Person').map(publicIncident);
  res.json(req.query.status ? visible.filter(i => i.status === req.query.status) : visible);
});
app.post('/api/incidents', (req, res) => {
  const { category, description, lat, lng } = req.body || {};
  const safeCategory = [...allowedCategories].find(value => value.toLowerCase() === String(category || '').trim().toLowerCase());
  if (safeCategory === 'Missing Person') return res.status(400).json({ error: 'Missing-person reports use the private family-reunification workflow.' });
  if (!safeCategory || typeof category !== 'string' || category.length > 60 || !Number.isFinite(Number(lat)) || Math.abs(Number(lat)) > 90 || !Number.isFinite(Number(lng)) || Math.abs(Number(lng)) > 180 || !description || String(description).trim().length < 4 || String(description).length > 1500 || imageIsInvalid(req.body.image)) return res.status(400).json({ error: 'Choose a supported category, valid location and short description. Images must be PNG, JPEG or WebP under 3 MB.' });
  const duplicate = findPossibleDuplicate(safeCategory, lat, lng);
  const record = { _id: id('inc'), category: safeCategory, title: String(req.body.title || `${safeCategory} report`).slice(0, 140), description: String(description).trim(), lat: Number(lat), lng: Number(lng), zone: safeZone(req.body.zone), severity: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(req.body.severity) ? req.body.severity : 'MEDIUM', image: safeImage(req.body.image), status: 'UNVERIFIED', duplicateOf: duplicate?._id || null, createdAt: now(), timeline: [{ status: 'REPORTED', at: now() }] };
  add('incidents', record, 'incident_created');
  if (duplicate) emit('possible_duplicate', { incident: publicDuplicate(record), duplicate: publicDuplicate(duplicate) });
  res.status(201).json({ ...record, possibleDuplicate: Boolean(duplicate) });
});
app.patch('/api/incidents/:id', auth(), roles('Security', 'Medical Responder', 'Fire Responder', 'Organizer', 'Admin'), (req, res) => {
  const before = state.incidents.find(i => i._id === req.params.id); if (!before) return res.status(404).json({ error: 'Incident not found.' });
  const responderCategory = { 'Medical Responder': 'Medical', 'Fire Responder': 'Fire' }[req.user.role];
  if (responderCategory && before.category !== responderCategory) return res.status(403).json({ error: `This responder role can only update ${responderCategory.toLowerCase()} incidents.` });
  const nextStatus = String(req.body.status || before.status).toUpperCase();
  const valid = ['UNVERIFIED', 'VERIFIED', 'REJECTED', 'ASSIGNED', 'RESPONDING', 'ARRIVED', 'RESOLVED'];
  if (!valid.includes(nextStatus)) return res.status(400).json({ error: 'Unknown incident status.' });
  const timeline = [...(before.timeline || []), { status: nextStatus, at: now(), by: req.user.email }];
  const item = update('incidents', req.params.id, { status: nextStatus, timeline }, nextStatus === 'VERIFIED' ? 'incident_verified' : nextStatus === 'RESOLVED' ? 'incident_resolved' : null);
  if (nextStatus === 'VERIFIED') {
    const level = item.severity === 'CRITICAL' || item.category === 'Fire' ? 'RED' : item.category === 'Medical' ? 'ORANGE' : 'YELLOW';
    const alert = add('alerts', { _id: id('alert'), title: `${item.category} — ${item.zone}`, message: publicAlertMessage(item.category, item.zone), category: item.category, level, status: 'ACTIVE', zone: item.zone, lat: item.lat, lng: item.lng, incidentId: item._id, createdAt: now() }, 'alert_created');
    item.alertId = alert._id; persist('incidents', item);
  }
  if (nextStatus === 'RESOLVED') resolveLinkedAlert(item);
  audit(req, `incident ${nextStatus.toLowerCase()}`, item._id); res.json(item);
});

app.get('/api/reports', auth(), roles('Organizer', 'Admin', 'Security'), (_req, res) => res.json(state.reports));
app.post('/api/reports', (req, res) => {
  const { category, description, lat, lng } = req.body || {};
  const safeCategory = [...allowedCategories].find(value => value.toLowerCase() === String(category || '').trim().toLowerCase());
  if (safeCategory === 'Missing Person') return res.status(400).json({ error: 'Missing-person reports use the private family-reunification workflow.' });
  if (!safeCategory || typeof category !== 'string' || category.length > 60 || !description || String(description).trim().length < 4 || String(description).length > 1500 || !Number.isFinite(Number(lat)) || Math.abs(Number(lat)) > 90 || !Number.isFinite(Number(lng)) || Math.abs(Number(lng)) > 180 || imageIsInvalid(req.body.image)) return res.status(400).json({ error: 'Choose a supported category, valid location and short description. Images must be PNG, JPEG or WebP under 3 MB.' });
  const duplicate = findPossibleDuplicate(safeCategory, lat, lng);
  const record = { _id: id('report'), category: safeCategory, title: String(req.body.title || `${safeCategory} report`).slice(0, 140), description: String(description).trim(), lat: Number(lat), lng: Number(lng), zone: safeZone(req.body.zone), severity: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(req.body.severity) ? req.body.severity : 'MEDIUM', image: safeImage(req.body.image), status: 'UNVERIFIED', duplicateOf: duplicate?._id || null, createdAt: now(), timeline: [{ status: 'REPORTED', at: now() }] };
  add('reports', record, 'incident_created'); if (duplicate) emit('possible_duplicate', { incident: publicDuplicate(record), duplicate: publicDuplicate(duplicate) });
  res.status(201).json({ ...record, possibleDuplicate: Boolean(duplicate) });
});
app.patch('/api/reports/:id', auth(), roles('Organizer', 'Admin', 'Security'), (req, res) => {
  const previous = state.reports.find(row => String(row._id) === String(req.params.id));
  if (!previous) return res.status(404).json({ error: 'Report not found.' });
  const nextStatus = String(req.body.status || previous.status).toUpperCase();
  if (!['UNVERIFIED', 'VERIFIED', 'REJECTED', 'ASSIGNED', 'RESPONDING', 'ARRIVED', 'RESOLVED'].includes(nextStatus)) return res.status(400).json({ error: 'Unknown report status.' });
  if (req.user.role === 'Security' && !['VERIFIED', 'REJECTED'].includes(nextStatus)) return res.status(403).json({ error: 'Security staff can verify or reject reports. Organizers assign teams and resolve reports.' });
  const item = update('reports', req.params.id, { status: nextStatus, timeline: [...(previous.timeline || []), { status: nextStatus, at: now(), by: req.user.email }] }, nextStatus === 'VERIFIED' ? 'incident_verified' : nextStatus === 'RESOLVED' ? 'incident_resolved' : null);
  if (!item) return res.status(404).json({ error: 'Report not found.' });
  if (item.status === 'VERIFIED') {
    const level = item.severity === 'CRITICAL' || item.category === 'Fire' ? 'RED' : item.category === 'Medical' ? 'ORANGE' : 'YELLOW';
    const alert = add('alerts', { _id: id('alert'), title: `${item.category} — ${item.zone || 'event grounds'}`, message: publicAlertMessage(item.category, item.zone || 'event grounds'), level, status: 'ACTIVE', category: item.category, zone: item.zone, lat: item.lat, lng: item.lng, incidentId: item._id, createdAt: now() }, 'alert_created');
    item.alertId = alert._id; persist('reports', item);
  }
  if (nextStatus === 'RESOLVED') resolveLinkedAlert(item);
  audit(req, `report ${item.status.toLowerCase()}`, item._id); res.json(item);
});

app.get('/api/responders', auth(), roles('Organizer', 'Admin', 'Security', 'Medical Responder', 'Fire Responder'), (_req, res) => res.json(state.responders));
app.patch('/api/responders/:id', auth(), roles('Organizer', 'Admin', 'Security', 'Medical Responder', 'Fire Responder'), (req, res) => {
  if (!['AVAILABLE', 'ASSIGNED', 'RESPONDING', 'BUSY'].includes(String(req.body.status || '').toUpperCase())) return res.status(400).json({ error: 'Choose a valid responder status.' });
  const previous = state.responders.find(row => String(row._id) === String(req.params.id));
  if (!previous) return res.status(404).json({ error: 'Responder not found.' });
  const responderType = { 'Medical Responder': 'Medical', 'Fire Responder': 'Fire', Security: 'Security' }[req.user.role];
  if (responderType && previous.type !== responderType) return res.status(403).json({ error: `This role can only update ${responderType.toLowerCase()} responders.` });
  const status = String(req.body.status).toUpperCase();
  const item = update('responders', req.params.id, { status, ...(status === 'AVAILABLE' ? { assignment: null, incidentId: null } : {}) }, 'responder_status_changed');
  audit(req, `responder ${req.body.status || 'updated'}`, item.name); res.json(item);
});
app.post('/api/incidents/:id/assign', auth(), roles('Organizer', 'Admin'), (req, res) => {
  const collection = state.incidents.some(row => String(row._id) === String(req.params.id)) ? 'incidents' : 'reports';
  const incident = state[collection].find(i => String(i._id) === String(req.params.id)); const responder = state.responders.find(r => String(r._id) === String(req.body.responderId));
  if (!incident || !responder) return res.status(404).json({ error: 'Incident or responder not found.' });
  if (responder.status !== 'AVAILABLE') return res.status(409).json({ error: 'Choose an available responder.' });
  update('responders', responder._id, { status: 'ASSIGNED', assignment: incident.title, incidentId: incident._id }, 'responder_assigned');
  const item = update(collection, incident._id, { status: 'ASSIGNED', assignedResponder: responder.name, responderId: responder._id, timeline: [...(incident.timeline || []), { status: 'ASSIGNED', at: now(), by: req.user.email }] }, 'responder_assigned');
  audit(req, 'assigned responder', `${responder.name} → ${incident._id}`); res.json(item);
});

app.get('/api/exits', (_req, res) => res.json(state.exits));
app.patch('/api/exits/:id', auth(), roles('Organizer', 'Admin'), (req, res) => {
  if (!['OPEN', 'CONGESTED', 'BLOCKED'].includes(req.body.status)) return res.status(400).json({ error: 'Exit status must be OPEN, CONGESTED or BLOCKED.' });
  const item = update('exits', req.params.id, { status: req.body.status }, 'exit_status_changed');
  const facilityItem = state.facilities.find(row => row._id === req.params.id); if (facilityItem) { Object.assign(facilityItem, { status: req.body.status }); persist('facilities', facilityItem); }
  if (!item) return res.status(404).json({ error: 'Exit not found.' });
  if (item.status === 'BLOCKED') add('alerts', { _id: id('alert'), title: `${item.name} is blocked`, message: 'Please use another exit and follow event staff directions.', category: 'Exit', level: 'YELLOW', status: 'ACTIVE', zone: item.name, createdAt: now() }, 'alert_created');
  audit(req, `exit set ${item.status.toLowerCase()}`, item.name); res.json(item);
});

app.get('/api/missing-persons', auth(false), (req, res) => {
  const privileged = req.user && ['Organizer', 'Admin', 'Security'].includes(req.user.role);
  const safe = privileged ? state.missingPersons : state.missingPersons.map(publicMissingPerson);
  res.json(safe);
});
app.post('/api/missing-persons', (req, res) => {
  const { name, age, description, clothing, lastSeen, lat, lng } = req.body || {};
  if (typeof name !== 'string' || name.trim().length < 2 || name.length > 80 || typeof description !== 'string' || description.trim().length < 3 || description.length > 700 || !clothing || String(clothing).trim().length < 2 || String(clothing).length > 240 || !lastSeen || String(lastSeen).trim().length < 2 || !Number.isFinite(Number(lat)) || Math.abs(Number(lat)) > 90 || !Number.isFinite(Number(lng)) || Math.abs(Number(lng)) > 180 || imageIsInvalid(req.body.image) || (age && (!Number.isFinite(Number(age)) || Number(age) < 0 || Number(age) > 120))) return res.status(400).json({ error: 'Add valid identifying details, last-seen location and map pin. Images must be PNG, JPEG or WebP under 3 MB.' });
  const item = add('missingPersons', { _id: id('missing'), name: name.trim(), age: Number(age) || null, gender: String(req.body.gender || '').slice(0, 30), description: String(description).trim(), clothing: String(clothing).slice(0, 240), lastSeen: String(lastSeen).slice(0, 160), lastSeenAt: now(), lat: Number(lat), lng: Number(lng), contact: String(req.body.contact || 'Contact through Festival Help Desk').slice(0, 100), image: safeImage(req.body.image), status: 'SEARCHING', sightings: [], createdAt: now() }, 'missing_person_created');
  res.status(201).json(item);
});
app.patch('/api/missing-persons/:id', auth(), roles('Organizer', 'Admin', 'Security'), (req, res) => {
  const previous = state.missingPersons.find(m => m._id === req.params.id); if (!previous) return res.status(404).json({ error: 'Record not found.' });
  const status = String(req.body.status || previous.status).toUpperCase();
  if (!['SEARCHING', 'FOUND'].includes(status)) return res.status(400).json({ error: 'Missing-person status must be SEARCHING or FOUND.' });
  const sightings = req.body.sighting ? [...(previous.sightings || []), { note: String(req.body.sighting).slice(0, 500), at: now(), by: req.user.email }] : previous.sightings;
  const item = update('missingPersons', req.params.id, { status, sightings }, 'missing_person_updated');
  audit(req, `missing person ${item.status.toLowerCase()}`, item._id); res.json(item);
});

app.get('/api/alerts', (_req, res) => res.json(state.alerts.map(publicAlert).filter(Boolean)));
app.post('/api/alerts', auth(), roles('Organizer', 'Admin'), (req, res) => {
  const { title, message } = req.body || {}; if (!title?.trim() || !message?.trim()) return res.status(400).json({ error: 'Alert title and message are required.' });
  const item = add('alerts', { _id: id('alert'), title: String(title).slice(0, 140), message: String(message).slice(0, 800), level: ['GREEN', 'YELLOW', 'ORANGE', 'RED'].includes(req.body.level) ? req.body.level : 'BLUE', status: 'ACTIVE', category: 'Organizer notice', zone: req.body.zone || 'All event zones', createdAt: now() }, 'alert_created');
  audit(req, 'created alert', item.title); res.status(201).json(item);
});
app.delete('/api/alerts/:id', auth(), roles('Organizer', 'Admin'), (req, res) => {
  const index = state.alerts.findIndex(a => a._id === req.params.id); if (index < 0) return res.status(404).json({ error: 'Alert not found.' });
  const [item] = state.alerts.splice(index, 1); removePersisted('alerts', item._id); emit('alert_removed', { _id: item._id }); audit(req, 'removed alert', item.title); res.json({ ok: true });
});

app.post('/api/location-shares', (req, res) => {
  const { lat, lng } = req.body || {}; if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return res.status(400).json({ error: 'A valid location is required.' });
  const share = { _id: crypto.randomBytes(20).toString('hex'), lat: Number(lat), lng: Number(lng), expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(), createdAt: now() };
  // Do not broadcast coordinates: the random token is the sole access mechanism.
  add('locationShares', share);
  res.status(201).json({ token: share._id, expiresAt: share.expiresAt, url: `${req.protocol}://${req.get('host')}/share/${share._id}` });
});
app.delete('/api/location-shares/:token', (req, res) => { const i = state.locationShares.findIndex(s => s._id === req.params.token); if (i >= 0) state.locationShares.splice(i, 1); removePersisted('locationShares', req.params.token); res.json({ ok: true }); });
app.get('/api/location-shares/:token', (req, res) => {
  const share = state.locationShares.find(s => s._id === req.params.token && new Date(s.expiresAt) > new Date());
  if (!share) return res.status(404).json({ error: 'This private location link has expired or was stopped.' }); res.set('Cache-Control', 'no-store'); res.json(share);
});

app.get('/api/users', auth(), roles('Organizer', 'Admin'), (_req, res) => res.json(state.users.map(({ passwordHash, ...user }) => user)));
app.post('/api/users', auth(), roles('Organizer', 'Admin'), async (req, res) => {
  const { name, email, password, role } = req.body || {};
  const allowedRoles = ['Visitor', 'Security', 'Medical Responder', 'Fire Responder', 'Organizer', 'Admin'];
  if (typeof name !== 'string' || name.trim().length < 2 || name.length > 80 || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email) || typeof password !== 'string' || password.length < 8 || password.length > 128 || !allowedRoles.includes(role)) return res.status(400).json({ error: 'Enter a name, valid email, password (8–128 characters) and supported role.' });
  if (state.users.some(user => user.email.toLowerCase() === email.trim().toLowerCase())) return res.status(409).json({ error: 'An account with this email already exists.' });
  const user = { _id: id('user'), name: name.trim(), email: email.trim().toLowerCase(), role, passwordHash: await bcrypt.hash(password, 12), createdAt: now() };
  state.users.push(user); persist('users', user); audit(req, 'created user account', `${user.email} (${role})`);
  res.status(201).json(cleanUser(user));
});
app.get('/api/audit-logs', auth(), roles('Organizer', 'Admin'), (_req, res) => res.json(state.auditLogs.slice(0, 100)));

app.post('/api/demo/run', auth(), roles('Organizer', 'Admin'), async (_req, res) => {
  res.json({ started: true, message: 'Demo sequence started' });
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  await wait(900);
  const zone = state.zones.find(z => z._id === 'zb'); update('zones', 'zb', { people: zone.people + 480, density: Math.min(zone.density + 8, 99), trend: 'increasing', risk: 'WARNING' }, 'crowd_updated');
  add('alerts', { _id: id('alert'), title: 'Crowd warning — Zone B', message: 'Occupancy is increasing in the East Lawn. Keep walkways clear and follow event staff guidance.', category: 'Crowd Problem', level: 'ORANGE', status: 'ACTIVE', zone: zone.name, lat: zone.lat, lng: zone.lng, createdAt: now() }, 'alert_created');
  await wait(1100);
  const exit = state.exits.find(e => e._id === 'x3'); update('exits', 'x3', { status: 'BLOCKED' }, 'exit_status_changed'); const exitFacility = state.facilities.find(f => f._id === 'x3'); Object.assign(exitFacility, { status: 'BLOCKED' }); persist('facilities', exitFacility);
  add('alerts', { _id: id('alert'), title: 'Gate C exit blocked', message: 'Use Gate B or Gate D. Follow event staff directions.', category: 'Exit', level: 'YELLOW', status: 'ACTIVE', zone: exit.name, createdAt: now() }, 'alert_created');
  await wait(1200);
  const medical = add('incidents', { _id: id('inc'), category: 'Medical', title: 'Medical assistance requested', description: 'Demo incident near the East Lawn.', zone: 'Zone B · East Lawn', lat: 13.0088, lng: 77.5945, severity: 'HIGH', status: 'UNVERIFIED', createdAt: now(), timeline: [{ status: 'REPORTED', at: now() }] }, 'incident_created');
  await wait(1000);
  const fire = add('incidents', { _id: id('inc'), category: 'Fire', title: 'Smoke reported near vendor row', description: 'Demo smoke report near the food court. Keep access lane clear.', zone: 'Zone C · Food Court', lat: 13.0114, lng: 77.5912, severity: 'CRITICAL', status: 'UNVERIFIED', createdAt: now(), timeline: [{ status: 'REPORTED', at: now() }] }, 'incident_created');
  await wait(1100);
  const fireItem = update('incidents', fire._id, { status: 'VERIFIED', timeline: [...fire.timeline, { status: 'VERIFIED', at: now(), by: 'Demo simulation' }] }, 'incident_verified');
  const fireAlert = add('alerts', { _id: id('alert'), title: 'Fire reported — Zone C', message: fireItem.description, category: 'Fire', level: 'RED', status: 'ACTIVE', zone: fire.zone, lat: fire.lat, lng: fire.lng, incidentId: fire._id, createdAt: now() }, 'alert_created');
  fireItem.alertId = fireAlert._id; persist('incidents', fireItem);
  await wait(1000);
  const responder = state.responders.find(r => r._id === 'r6');
  if (responder) { update('responders', responder._id, { status: 'ASSIGNED', assignment: fire.title, incidentId: fire._id }, 'responder_assigned'); update('incidents', fire._id, { status: 'ASSIGNED', assignedResponder: responder.name, responderId: responder._id }); }
  await wait(900);
  if (responder) update('responders', responder._id, { status: 'RESPONDING' }, 'responder_status_changed');
  update('incidents', fire._id, { status: 'RESPONDING', timeline: [...fireItem.timeline, { status: 'RESPONDING', at: now() }] });
  await wait(2200);
  const resolved = update('incidents', fire._id, { status: 'RESOLVED', timeline: [...fireItem.timeline, { status: 'VERIFIED', at: now() }, { status: 'ASSIGNED', at: now() }, { status: 'RESPONDING', at: now() }, { status: 'RESOLVED', at: now(), by: 'Demo simulation' }] }, 'incident_resolved');
  resolveLinkedAlert(resolved);
  if (responder) update('responders', responder._id, { status: 'AVAILABLE', assignment: null, incidentId: null }, 'responder_status_changed');
  const medicalItem = update('incidents', medical._id, { status: 'VERIFIED', timeline: [...medical.timeline, { status: 'VERIFIED', at: now(), by: 'Demo simulation' }] }, 'incident_verified');
  const medicalAlert = add('alerts', { _id: id('alert'), title: 'Medical assistance — Zone B', message: medicalItem.description, category: 'Medical', level: 'ORANGE', status: 'ACTIVE', zone: medical.zone, lat: medical.lat, lng: medical.lng, incidentId: medical._id, createdAt: now() }, 'alert_created');
  medicalItem.alertId = medicalAlert._id; persist('incidents', medicalItem);
  add('alerts', { _id: id('alert'), title: 'Fire response resolved', message: `${resolved.assignedResponder || 'Fire response team'} resolved the demo incident.`, category: 'Fire', level: 'GREEN', status: 'ACTIVE', zone: fire.zone, createdAt: now() }, 'alert_created');
});

io.on('connection', socket => {
  socket.emit('connected', { message: 'Live event updates connected', at: now() });
});

const clientBuild = new URL('../dist/', import.meta.url);
if (process.env.NODE_ENV === 'production') {
  const { fileURLToPath } = await import('node:url');
  app.use(express.static(fileURLToPath(clientBuild)));
  app.get('*', (_req, res) => res.sendFile(fileURLToPath(new URL('../dist/index.html', import.meta.url))));
}

await connectDatabase(process.env.MONGODB_URI);
server.listen(PORT, () => console.info(`CROWD SAFE API listening on http://localhost:${PORT}`));
