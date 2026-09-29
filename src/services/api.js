import { event, zones as seedZones, facilities as seedFacilities, incidents as seedIncidents, responders as seedResponders, missingPersons as seedMissing, alerts as seedAlerts, exits as seedExits } from '../data/demoData.js';

const STORAGE_KEY = 'crowd-safe-demo-v1';
const readStore = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
};
const writeStore = value => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent('crowdsafe:changed'));
  try { window.crowdSafeChannel?.postMessage('changed'); } catch { /* BroadcastChannel is an optional cross-tab enhancement. */ }
};
const getStore = () => {
  const saved = readStore();
  return { event: saved.event || event, zones: saved.zones || seedZones, facilities: saved.facilities || seedFacilities,
    incidents: saved.incidents || seedIncidents, responders: saved.responders || seedResponders, missingPersons: saved.missingPersons || seedMissing,
    alerts: saved.alerts || seedAlerts, exits: saved.exits || seedExits, reports: saved.reports || [], users: saved.users || [], shares: saved.shares || [] };
};
const token = () => localStorage.getItem('crowd-safe-token');
async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token()) headers.Authorization = `Bearer ${token()}`;
  return fetch(path.startsWith('/api') ? path : `/api${path}`, { ...options, headers, body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body })
    .then(async response => {
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        // A stale local/demo token must not leave the shell pretending to be an authenticated staff user.
        if (response.status === 401 && token()) {
          localStorage.removeItem('crowd-safe-token'); localStorage.removeItem('crowd-safe-user');
          window.dispatchEvent(new Event('crowdsafe:auth'));
        }
        throw Object.assign(new Error(body.error || 'Request failed.'), { status: response.status });
      }
      return body;
    });
}
const shouldFallback = error => !error.status || error.status >= 500;
const notify = (eventName, payload) => {
  window.dispatchEvent(new CustomEvent(`crowdsafe:${eventName}`, { detail: payload }));
  try { window.crowdSafeChannel?.postMessage(eventName); } catch { /* optional */ }
};
const setField = (key, value) => { const s = getStore(); s[key] = value; writeStore(s); };
const patchItem = (key, id, patch) => { const s = getStore(); const item = s[key].find(row => String(row._id) === String(id)); if (!item) throw new Error('Record not found.'); Object.assign(item, patch, { updatedAt: new Date().toISOString() }); setField(key, s[key]); return item; };
const makeId = prefix => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
const localAccountsKey = 'crowd-safe-local-accounts-v1';
const hex = bytes => Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
async function passwordDigest(password, salt) {
  if (!globalThis.crypto?.subtle) throw new Error('Secure local sign-in is unavailable in this browser. Start the API service to authenticate.');
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: encoder.encode(salt), iterations: 120000, hash: 'SHA-256' }, key, 256);
  return hex(bits);
}
const localAccounts = () => { try { return JSON.parse(localStorage.getItem(localAccountsKey) || '[]'); } catch { return []; } };
const duplicateFor = (rows, category, lat, lng) => rows.find(row => String(row.category).trim().toLowerCase() === String(category).trim().toLowerCase() && Date.now() - new Date(row.createdAt).getTime() < 900000 && Number.isFinite(Number(row.lat)) && Number.isFinite(Number(row.lng)) && Math.hypot(Number(row.lat) - Number(lat), Number(row.lng) - Number(lng)) < 0.0018);
const isStaff = user => ['Organizer', 'Admin', 'Security', 'Medical Responder', 'Fire Responder'].includes(user?.role);
const privateMissing = user => ['Organizer', 'Admin', 'Security'].includes(user?.role);
const managerRole = user => ['Organizer', 'Admin'].includes(user?.role);
const publicIncidentRow = row => ({ _id: row._id, category: row.category, title: `Verified ${row.category} report`, zone: row.zone || 'Event grounds', lat: row.lat, lng: row.lng, severity: row.severity, status: row.status, createdAt: row.createdAt, updatedAt: row.updatedAt });
const publicAlertCopy = category => ({ Fire: 'A fire safety alert has been verified. Keep access lanes clear and follow event staff directions.', Medical: 'Medical support has been coordinated. Give responders clear access and follow staff guidance.', 'Blocked Exit': 'A route issue has been verified. Use an open route and follow event staff directions.', 'Crowd Problem': 'Crowd conditions need attention. Keep walkways clear and follow event staff guidance.', 'Security Issue': 'A security response is active. Avoid the immediate area and follow staff instructions.' }[category] || `A ${String(category).toLowerCase()} safety report has been reviewed by event staff.`);

export async function getDashboard() {
  try { return await request('/dashboard'); } catch (error) {
    if (!shouldFallback(error)) throw error;
    const store = getStore(); const user = currentUser(); const staff = isStaff(user);
    return { ...store, incidents: staff ? store.incidents : store.incidents.filter(row => !['UNVERIFIED', 'REJECTED'].includes(row.status) && row.category !== 'Missing Person').map(publicIncidentRow), responders: staff ? store.responders : [], missingPersons: privateMissing(user) ? store.missingPersons : store.missingPersons.map(row => ({ _id: row._id, status: row.status, createdAt: row.createdAt, updatedAt: row.updatedAt })) };
  }
}
export async function getCollection(name) {
  try { return await request(`/${name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`); }
  catch (error) {
    if (!shouldFallback(error)) throw error;
    const key = ({ 'missing-persons': 'missingPersons' })[name] || name;
    const rows = getStore()[key] || [];
    if (key === 'missingPersons' && !privateMissing(currentUser())) return rows.map(row => ({ _id: row._id, status: row.status, createdAt: row.createdAt, updatedAt: row.updatedAt }));
    if (key === 'incidents' && !isStaff(currentUser())) return rows.filter(row => !['UNVERIFIED', 'REJECTED'].includes(row.status) && row.category !== 'Missing Person').map(publicIncidentRow);
    if (['reports', 'responders'].includes(name) && !isStaff(currentUser())) throw new Error('Sign in with an authorized staff account to view these records.');
    if (['users', 'audit-logs'].includes(name) && !managerRole(currentUser())) throw new Error('Sign in as an organizer or admin to view these records.');
    return rows;
  }
}
export async function login(email, password) {
  try { return await request('/auth/login', { method: 'POST', body: { email, password } }); }
  catch (error) {
    if (!shouldFallback(error)) throw error;
    const normalizedEmail = String(email).trim().toLowerCase();
    const localAccount = localAccounts().find(row => row.email === normalizedEmail);
    if (localAccount) {
      const digest = await passwordDigest(password, localAccount.salt);
      if (digest !== localAccount.passwordHash) throw new Error('Email or password is incorrect.');
      const user = localAccount.user;
      localStorage.setItem('crowd-safe-token', `demo.${btoa(JSON.stringify(user))}`);
      localStorage.setItem('crowd-safe-user', JSON.stringify(user));
      return { token: token(), user };
    }
    const demoRoles = { 'admin@crowdsafe.demo': 'Admin', 'organizer@crowdsafe.demo': 'Organizer' };
    const role = demoRoles[normalizedEmail];
    if (!role || password !== 'demo123') throw new Error('Sign in is unavailable while the API is offline. Use an account created in Demo Mode or reconnect the service.');
    const user = { _id: makeId('u'), email: normalizedEmail, name: normalizedEmail.split('@')[0], role };
    localStorage.setItem('crowd-safe-token', `demo.${btoa(JSON.stringify(user))}`);
    localStorage.setItem('crowd-safe-user', JSON.stringify(user));
    return { token: token(), user };
  }
}
export async function register(body) {
  try { return await request('/auth/register', { method: 'POST', body }); }
  catch (error) {
    if (!shouldFallback(error)) throw error;
    if (typeof body.name !== 'string' || body.name.trim().length < 2 || typeof body.email !== 'string' || !/^\S+@\S+\.\S+$/.test(body.email) || typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128) throw new Error('Enter a name, valid email, and password with at least 8 characters.');
    const accounts = localAccounts(); const email = body.email.trim().toLowerCase();
    if (accounts.some(row => row.email === email)) throw new Error('An account with this email already exists.');
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
    const passwordHash = await passwordDigest(body.password, salt);
    const user = { _id: makeId('u'), name: body.name.trim(), email, role: 'Visitor' };
    accounts.push({ email, salt, passwordHash, user }); localStorage.setItem(localAccountsKey, JSON.stringify(accounts));
    localStorage.setItem('crowd-safe-token', `demo.${btoa(JSON.stringify(user))}`); localStorage.setItem('crowd-safe-user', JSON.stringify(user)); return { token: token(), user };
  }
}
export function currentUser() { try { return JSON.parse(localStorage.getItem('crowd-safe-user')); } catch { return null; } }
export function logout() { localStorage.removeItem('crowd-safe-token'); localStorage.removeItem('crowd-safe-user'); }

export async function createIncident(body, generic = false) {
  try { return await request(generic ? '/reports' : '/incidents', { method: 'POST', body }); }
  catch (error) {
    if (!shouldFallback(error)) throw error;
    const s = getStore(); const target = generic ? 'reports' : 'incidents'; const duplicate = duplicateFor([...s.incidents, ...s.reports], body.category, body.lat, body.lng);
    const row = { _id: makeId(generic ? 'report' : 'inc'), ...body, status: 'UNVERIFIED', duplicateOf: duplicate?._id || null, createdAt: new Date().toISOString(), timeline: [{ status: 'REPORTED', at: new Date().toISOString() }] };
    s[target].unshift(row); writeStore(s); notify('incident_created', row); return { ...row, possibleDuplicate: Boolean(duplicate) };
  }
}
export async function moderateItem(id, status, collection = 'incidents') {
  try { return await request(`/${collection}/${id}`, { method: 'PATCH', body: { status } }); }
  catch (error) {
    if (!shouldFallback(error)) throw error;
    const s = getStore(); const row = patchItem(collection, id, { status, timeline: [...(s[collection].find(i => i._id === id)?.timeline || []), { status, at: new Date().toISOString() }] });
    if (status === 'VERIFIED') { const alert = { _id: makeId('alert'), title: `${row.category} — ${row.zone || 'event grounds'}`, message: publicAlertCopy(row.category), category: row.category, level: row.category === 'Fire' || row.severity === 'CRITICAL' ? 'RED' : row.category === 'Medical' ? 'ORANGE' : 'YELLOW', status: 'ACTIVE', zone: row.zone, lat: row.lat, lng: row.lng, incidentId: row._id, createdAt: new Date().toISOString() }; row.alertId = alert._id; s[collection] = s[collection].map(item => item._id === row._id ? row : item); s.alerts.unshift(alert); writeStore(s); notify('alert_created', alert); notify('incident_verified', row); }
    if (status === 'RESOLVED') { const linked = s.alerts.find(alert => alert.incidentId === row._id && alert.status === 'ACTIVE'); if (linked) { linked.status = 'RESOLVED'; writeStore(s); notify('alert_removed', { _id: linked._id }); } }
    return row;
  }
}
export async function updateExit(id, status) {
  try { return await request(`/exits/${id}`, { method: 'PATCH', body: { status } }); }
  catch (error) { if (!shouldFallback(error)) throw error; const s = getStore(); const row = patchItem('exits', id, { status }); const f = s.facilities.find(i => i._id === id); if (f) f.status = status; setField('facilities', s.facilities); notify('exit_status_changed', row); if (status === 'BLOCKED') { const a = { _id: makeId('alert'), title: `${row.name} is blocked`, message: 'Use another exit and follow event staff directions.', level: 'YELLOW', status: 'ACTIVE', category: 'Exit', createdAt: new Date().toISOString() }; s.alerts.unshift(a); setField('alerts', s.alerts); notify('alert_created', a); } return row; }
}
export async function updateRecord(collection, id, patch) {
  try { return await request(`/${collection}/${id}`, { method: 'PATCH', body: patch }); }
  catch (error) { if (!shouldFallback(error)) throw error; const row = patchItem(collection, id, patch); notify(collection === 'zones' ? 'crowd_updated' : collection === 'responders' ? 'responder_status_changed' : collection === 'missing-persons' ? 'missing_person_updated' : 'updated', row); return row; }
}
export async function createAlert(body) {
  try { return await request('/alerts', { method: 'POST', body }); }
  catch (error) { if (!shouldFallback(error)) throw error; const s = getStore(); const row = { _id: makeId('alert'), ...body, status: 'ACTIVE', createdAt: new Date().toISOString() }; s.alerts.unshift(row); writeStore(s); notify('alert_created', row); return row; }
}
export async function removeAlert(id) {
  try { return await request(`/alerts/${id}`, { method: 'DELETE' }); }
  catch (error) { if (!shouldFallback(error)) throw error; const s = getStore(); s.alerts = s.alerts.filter(a => a._id !== id); writeStore(s); notify('alert_removed', { _id: id }); return { ok: true }; }
}
export async function createMissingPerson(body) {
  try { return await request('/missing-persons', { method: 'POST', body }); }
  catch (error) { if (!shouldFallback(error)) throw error; const s = getStore(); const row = { _id: makeId('missing'), ...body, status: 'SEARCHING', createdAt: new Date().toISOString(), sightings: [] }; s.missingPersons.unshift(row); writeStore(s); notify('missing_person_created', row); return row; }
}
export async function createFacility(body) {
  try { return await request('/facilities', { method: 'POST', body }); }
  catch (error) { if (!shouldFallback(error)) throw error; const s = getStore(); const row = { _id: makeId('facility'), ...body }; s.facilities.unshift(row); writeStore(s); return row; }
}
export async function createUser(body) {
  try { return await request('/users', { method: 'POST', body }); }
  catch (error) {
    if (!shouldFallback(error)) throw error;
    if (!managerRole(currentUser())) throw new Error('Only organizers and admins can create accounts.');
    const allowedRoles = ['Visitor', 'Security', 'Medical Responder', 'Fire Responder', 'Organizer', 'Admin'];
    const email = String(body.email || '').trim().toLowerCase();
    if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.length > 80 || !/^\S+@\S+\.\S+$/.test(email) || typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128 || !allowedRoles.includes(body.role)) throw new Error('Enter a name, valid email, password (8–128 characters) and supported role.');
    const store = getStore(); const accounts = localAccounts();
    if (store.users.some(row => row.email === email) || accounts.some(row => row.email === email)) throw new Error('An account with this email already exists.');
    const user = { _id: makeId('u'), name: body.name.trim(), email, role: body.role, createdAt: new Date().toISOString() };
    const salt = hex(crypto.getRandomValues(new Uint8Array(16))); const passwordHash = await passwordDigest(body.password, salt);
    accounts.push({ email, salt, passwordHash, user }); localStorage.setItem(localAccountsKey, JSON.stringify(accounts));
    store.users.unshift(user); writeStore(store); return user;
  }
}
export async function createShare({ lat, lng }) {
  let result;
  try { result = await request('/location-shares', { method: 'POST', body: { lat, lng } }); }
  catch (error) { if (!shouldFallback(error)) throw error; const s = getStore(); const record = { _id: makeId('share'), lat, lng, expiresAt: new Date(Date.now() + 15 * 60000).toISOString() }; s.shares.push(record); setField('shares', s.shares); result = { token: record._id, expiresAt: record.expiresAt, url: `${location.origin}/share/${record._id}` }; }
  sessionStorage.setItem('crowd-safe-active-share', JSON.stringify({ ...result, location: { lat, lng } }));
  return result;
}
export async function stopShare(tokenValue) {
  let result;
  try { result = await request(`/location-shares/${tokenValue}`, { method: 'DELETE' }); }
  catch (error) { if (!shouldFallback(error)) throw error; const s = getStore(); s.shares = s.shares.filter(share => share._id !== tokenValue); setField('shares', s.shares); result = { ok: true }; }
  try { const current = JSON.parse(sessionStorage.getItem('crowd-safe-active-share') || 'null'); if (!current || current.token === tokenValue) sessionStorage.removeItem('crowd-safe-active-share'); } catch { sessionStorage.removeItem('crowd-safe-active-share'); }
  return result;
}
export async function updateEvent(body) {
  const existing = (await getDashboard()).event;
  try { return await request(`/events/${existing._id}`, { method: 'PATCH', body }); }
  catch (error) { if (!shouldFallback(error)) throw error; const s = getStore(); s.event = { ...s.event, ...body }; setField('event', s.event); return s.event; }
}
export async function assignResponder(incidentId, responderId) {
  try { return await request(`/incidents/${incidentId}/assign`, { method: 'POST', body: { responderId } }); }
  catch (error) {
    if (!shouldFallback(error)) throw error;
    const s = getStore(); const incident = [...s.incidents, ...s.reports].find(row => row._id === incidentId); const responder = s.responders.find(row => row._id === responderId);
    if (!incident || !responder) throw new Error('Incident or responder not found.');
    if (responder.status !== 'AVAILABLE') throw new Error('Choose an available responder.');
    responder.status = 'ASSIGNED'; responder.assignment = incident.title; responder.incidentId = incidentId; incident.status = 'ASSIGNED'; incident.assignedResponder = responder.name; incident.responderId = responder._id; incident.timeline = [...(incident.timeline || []), { status: 'ASSIGNED', at: new Date().toISOString() }];
    writeStore(s); notify('responder_assigned', responder); return incident;
  }
}
export async function runDemo() {
  try { return await request('/demo/run', { method: 'POST', body: {} }); }
  catch (error) {
    if (!shouldFallback(error)) throw error;
    const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
    const s = getStore(); const zone = s.zones.find(row => row._id === 'zb'); Object.assign(zone, { people: zone.people + 480, density: Math.min(zone.density + 8, 99), risk: 'WARNING', trend: 'increasing' }); setField('zones', s.zones); notify('crowd_updated', zone);
    await pause(900); const exit = s.exits.find(row => row._id === 'x3'); await updateExit(exit._id, 'BLOCKED');
    await pause(900); const medical = await createIncident({ category: 'Medical', title: 'Medical assistance requested', description: 'Demo incident near the East Lawn.', lat: 13.0088, lng: 77.5945, zone: 'Zone B · East Lawn', severity: 'HIGH' });
    await pause(900); const fire = await createIncident({ category: 'Fire', title: 'Smoke reported near vendor row', description: 'Demo smoke report near the food court. Keep access lane clear.', lat: 13.0114, lng: 77.5912, zone: 'Zone C · Food Court', severity: 'CRITICAL' });
    await pause(900); await moderateItem(fire._id, 'VERIFIED');
    await pause(900); const responder = getStore().responders.find(row => row._id === 'r6'); await assignResponder(fire._id, responder._id);
    await pause(1000); await updateRecord('responders', responder._id, { status: 'RESPONDING' }); await updateRecord('incidents', fire._id, { status: 'RESPONDING' });
    await pause(1800); await updateRecord('incidents', fire._id, { status: 'RESOLVED' }); await updateRecord('responders', responder._id, { status: 'AVAILABLE', assignment: null, incidentId: null });
    await moderateItem(medical._id, 'VERIFIED'); return { started: true };
  }
}
export function subscribeLocal(handler) {
  const onChange = () => handler(); window.addEventListener('crowdsafe:changed', onChange);
  if ('BroadcastChannel' in window) { window.crowdSafeChannel ||= new BroadcastChannel('crowd-safe'); window.crowdSafeChannel.addEventListener('message', onChange); }
  return () => { window.removeEventListener('crowdsafe:changed', onChange); window.crowdSafeChannel?.removeEventListener('message', onChange); };
}
