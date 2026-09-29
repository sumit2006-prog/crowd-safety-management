import { Component, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Link, NavLink, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useParams } from './router.jsx';
import { io } from 'socket.io-client';
import { Activity, AlertTriangle, Bell, Check, ChevronDown, Compass, Crosshair, HeartPulse, Home, LocateFixed, LockKeyhole, LogIn, Map, MapPin, Menu, MessageSquareWarning, Phone, Radio, Search, Share2, Shield, Siren, Users, X } from 'lucide-react';
import { alerts as seedAlerts } from './data/demoData.js';
import { currentUser, getDashboard, subscribeLocal, createShare, login, register } from './services/api.js';
import { Button, LinkButton, Modal, Toasts } from './components/Common.jsx';
import { HomePage, LiveMapPage, NearMePage, ReportPage, MedicalPage, MissingPage, AlertsPage, ServicesPage, SharePage, EventInfoPage, EmergencyPage, PublicDashboardPage } from './pages/PublicPages.jsx';
import AdminPages from './pages/AdminPages.jsx';

const DataContext = createContext(null);
const ToastContext = createContext(null);
const AuthContext = createContext(null);
const seedData = { event: { name: 'Central Festival 2026', status: 'LIVE', peopleInEvent: 12540, expectedCrowd: 20000, venue: 'Palace Grounds, Bengaluru', center: [13.0098, 77.5925] }, zones: [], facilities: [], incidents: [], responders: [], missingPersons: [], alerts: seedAlerts, exits: [] };
export const useData = () => useContext(DataContext);
export const useToast = () => useContext(ToastContext);
export const useAuth = () => useContext(AuthContext);

function DataProvider({ children }) {
  const { user } = useAuth();
  const [data, setData] = useState(seedData);
  const [lastUpdated, setLastUpdated] = useState(Date.now());
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const refresh = async () => { try { const next = await getDashboard(); setData(next); setLastUpdated(Date.now()); } catch (error) { console.warn('Could not refresh event data:', error.message); } };
  useEffect(() => {
    refresh();
    const localUnsubscribe = subscribeLocal(refresh);
    const socket = io({ path: '/socket.io', reconnectionAttempts: 3, timeout: 1800 });
    socket.on('connect', () => setRealtimeConnected(true));
    socket.on('disconnect', () => setRealtimeConnected(false));
    socket.on('connect_error', () => setRealtimeConnected(false));
    const liveEvents = ['incident_created', 'incident_verified', 'incident_resolved', 'alert_created', 'alert_removed', 'exit_status_changed', 'responder_assigned', 'responder_status_changed', 'crowd_updated', 'missing_person_created', 'missing_person_updated'];
    liveEvents.forEach(eventName => socket.on(eventName, payload => {
      if (eventName === 'alert_created') window.dispatchEvent(new CustomEvent('crowdsafe:alert_created', { detail: payload }));
      refresh();
    }));
    // Polling keeps read-only views fresh during intermittent WebSocket connectivity.
    const poll = window.setInterval(refresh, 15000);
    return () => { localUnsubscribe(); window.clearInterval(poll); socket.disconnect(); };
  }, [user?.role]);
  const value = useMemo(() => ({ data, refresh, lastUpdated, realtimeConnected }), [data, lastUpdated, realtimeConnected]);
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const remove = id => setItems(existing => existing.filter(item => item.id !== id));
  const push = (message, tone = 'blue') => { const id = Math.random().toString(36).slice(2); setItems(existing => [...existing, { id, message, tone }]); setTimeout(() => remove(id), 5200); };
  useEffect(() => {
    const onAlert = event => push(event.detail?.title || 'A new safety alert has been published.', event.detail?.level === 'RED' ? 'red' : 'amber');
    const onCreated = () => push('Your update is now visible to the event safety team.', 'green');
    window.addEventListener('crowdsafe:alert_created', onAlert); window.addEventListener('crowdsafe:incident_created', onCreated);
    return () => { window.removeEventListener('crowdsafe:alert_created', onAlert); window.removeEventListener('crowdsafe:incident_created', onCreated); };
  }, []);
  return <ToastContext.Provider value={push}>{children}<Toasts items={items} onRemove={remove} /></ToastContext.Provider>;
}
function AuthProvider({ children }) {
  const [user, setUser] = useState(currentUser());
  useEffect(() => { const sync = () => setUser(currentUser()); window.addEventListener('storage', sync); window.addEventListener('crowdsafe:auth', sync); return () => { window.removeEventListener('storage', sync); window.removeEventListener('crowdsafe:auth', sync); }; }, []);
  const value = useMemo(() => ({ user, setUser: next => { setUser(next); window.dispatchEvent(new Event('crowdsafe:auth')); } }), [user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

const publicLinks = [
  ['Home', '/', Home], ['Live Map', '/map', Map], ['Near Me', '/near-me', LocateFixed], ['Emergency', '/emergency', Siren], ['Report', '/report', MessageSquareWarning], ['Missing Person', '/missing', Search], ['Safety Alerts', '/alerts', Bell], ['About', '/event', Shield]
];
class PublicRouteBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() { return this.state.error ? <div role="alert" className="inline-notice notice-red">This page is temporarily unavailable. <Link to="/">Return home</Link> or reload the page.</div> : this.props.children; }
}
function PublicLayout() {
  const { data } = useData(); const { user } = useAuth(); const push = useToast(); const [emergencyOpen, setEmergencyOpen] = useState(false); const [mobileMenu, setMobileMenu] = useState(false); const location = useLocation();
  useEffect(() => { setMobileMenu(false); }, [location.pathname]);
  return <div className="public-app">
    <header className="public-header"><Link to="/" className="brand"><span className="brand-mark"><Shield size={20} fill="currentColor" /></span><span>CROWD<span className="brand-light">SAFE</span><small>EVENT SAFETY NETWORK</small></span></Link>
      <nav className="desktop-nav" aria-label="Main navigation">{publicLinks.map(([label, to]) => <NavLink end={to === '/'} key={to} to={to} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>{label}</NavLink>)}</nav>
      <div className="header-actions"><button className="language-button" aria-label="Language selector" title="English is the available interface language" onClick={() => push('English is the available interface language in this demo.', 'blue')}>EN <ChevronDown size={13} /></button><button className="header-emergency" onClick={() => setEmergencyOpen(true)}><Siren size={16} />Emergency</button>{user ? <Link className="login-link" to={user.role === 'Organizer' || user.role === 'Admin' ? '/admin' : '/dashboard'}><Users size={16} />{user.name?.split(' ')[0] || 'Account'}</Link> : <Link className="login-link" to="/login"><LogIn size={16} />Login</Link>}<button className="mobile-menu-toggle" aria-label="Toggle menu" onClick={() => setMobileMenu(!mobileMenu)}>{mobileMenu ? <X size={21} /> : <Menu size={21} />}</button></div>
    </header>
    {mobileMenu && <nav className="mobile-menu">{publicLinks.map(([label, to, Icon]) => <NavLink key={to} to={to}><Icon size={16} />{label}</NavLink>)}<NavLink to="/login"><LogIn size={16} />Login / Staff access</NavLink></nav>}
    <main className="public-main"><PublicRouteBoundary><Outlet /></PublicRouteBoundary></main>
    <nav className="mobile-bottom-nav" aria-label="Quick navigation">{[['Home', '/', Home], ['Map', '/map', Map], ['Near me', '/near-me', LocateFixed], ['Report', '/report', MessageSquareWarning], ['Emergency', '/emergency', Siren]].map(([label, to, Icon]) => <NavLink key={label} to={to} className={({ isActive }) => `${isActive ? 'active' : ''} ${label === 'Emergency' ? 'mobile-danger' : ''}`}><Icon size={19} /><span>{label}</span></NavLink>)}</nav>
    <button className="floating-emergency" aria-label="Open emergency options" onClick={() => setEmergencyOpen(true)}><span className="pulse-dot" /><Siren size={19} /><span>EMERGENCY</span></button>
    <EmergencyModal open={emergencyOpen} onClose={() => setEmergencyOpen(false)} />
    <footer className="public-footer"><div className="footer-brand"><span className="brand-mark"><Shield size={18} /></span><span>CROWD<span className="brand-light">SAFE</span></span><span className="footer-tag">Stay informed. Find help. Stay safe.</span></div><span>Central Festival 2026 · Demo safety network</span><Link to="/admin">Organizer command center <span aria-hidden="true">↗</span></Link><span className="footer-live"><i /> Live event feed</span></footer>
  </div>;
}
function EmergencyModal({ open, onClose }) {
  const navigate = useNavigate(); const push = useToast(); const [confirm, setConfirm] = useState(''); const [share, setShare] = useState(null); const [busy, setBusy] = useState(false);
  const action = key => { setConfirm(key); };
  const confirmAction = async () => {
    const selected = confirm; setConfirm('');
    if (selected === '112') { onClose(); window.location.href = 'tel:112'; return; }
    if (selected === 'share') {
      setBusy(true);
      try { if (!navigator.geolocation) throw new Error('This browser cannot share location.'); const position = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, () => reject(new Error('Location permission was not granted.')), { enableHighAccuracy: true, timeout: 10000 })); const result = await createShare({ lat: position.coords.latitude, lng: position.coords.longitude }); setShare(result); }
      catch (error) { push(error.message || 'Could not create a location link.', 'amber'); }
      finally { setBusy(false); }
      return;
    }
    onClose(); navigate(selected === 'medical' ? '/medical' : `/report?category=${encodeURIComponent(selected === 'fire' ? 'Fire' : 'Security Issue')}`);
  };
  return <Modal open={open} onClose={() => { onClose(); setConfirm(''); setShare(null); }} title={confirm ? 'Confirm emergency action' : share ? 'Private location link' : 'Emergency options'}>
    {confirm ? <div className="confirm-content"><div className="confirm-icon"><AlertTriangle size={26} /></div><p>{confirm === '112' ? 'Call India’s official emergency number 112 now?' : confirm === 'share' ? 'Share your current location for 15 minutes using a private link?' : `Open the ${confirm === 'medical' ? 'medical emergency' : confirm.toLowerCase()} report form?`}</p><div className="modal-actions"><Button variant="outline" onClick={() => setConfirm('')}>Go back</Button><Button variant="danger" onClick={confirmAction}>{confirm === '112' ? 'Call 112' : confirm === 'share' ? 'Continue' : 'Open form'}</Button></div></div> : share ? <div className="share-result"><div className="share-url">{share.url}</div><div className="modal-actions"><Button variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(share.url); push('Private link copied.', 'green'); } catch { window.prompt('Copy this link', share.url); } }}>Copy private link</Button><Button onClick={() => { setShare(null); onClose(); }}>Done</Button></div><p className="field-hint">Expires in 15 minutes. Stop sharing sooner from Share Location.</p></div> : <>
      <div className="emergency-intro"><span className="emergency-pulse"><Siren size={24} /></span><div><b>Need help right now?</b><span>Choose an option. For life-threatening danger call 112.</span></div></div>
      <div className="emergency-options"><button className="emergency-option emergency-call" onClick={() => action('112')}><Phone size={20} /><span><b>CALL 112</b><small>Official India emergency number</small></span><ChevronDown size={16} /></button><button className="emergency-option" onClick={() => action('medical')}><HeartPulse size={20} /><span><b>Medical</b><small>Request medical response at the event</small></span><ChevronDown size={16} /></button><button className="emergency-option" onClick={() => action('fire')}><AlertTriangle size={20} /><span><b>Fire</b><small>Report smoke or fire to event staff</small></span><ChevronDown size={16} /></button><button className="emergency-option" onClick={() => action('security')}><Shield size={20} /><span><b>Security</b><small>Request security support</small></span><ChevronDown size={16} /></button><button className="emergency-option share-option" disabled={busy} onClick={() => action('share')}><Share2 size={20} /><span><b>{busy ? 'Getting location…' : 'Share my location'}</b><small>Private link that expires in 15 minutes</small></span><ChevronDown size={16} /></button></div>
    </>}
  </Modal>;
}

function LoginPage() {
  const { setUser } = useAuth(); const navigate = useNavigate(); const push = useToast(); const [form, setForm] = useState({ email: 'organizer@crowdsafe.demo', password: 'demo123' }); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [showRegister, setShowRegister] = useState(false);
  const submit = async e => { e.preventDefault(); setBusy(true); setError(''); try { const result = showRegister ? await register({ ...form, name: form.name }) : await login(form.email, form.password); localStorage.setItem('crowd-safe-token', result.token); localStorage.setItem('crowd-safe-user', JSON.stringify(result.user)); setUser(result.user); push('You are signed in.', 'green'); navigate(result.user.role === 'Organizer' || result.user.role === 'Admin' ? '/admin' : '/dashboard'); } catch (err) { setError(err.message); } finally { setBusy(false); } };
  return <div className="login-screen"><div className="login-visual"><div className="login-visual-content"><span className="eyebrow">CENTRAL FESTIVAL 2026 · LIVE</span><h1>Prepared for every moment.</h1><p>One connected safety network for guests, organizers and response teams.</p><div className="login-visual-stats"><span><i className="green-dot" />All systems operational</span><span><Users size={16} />18 responders on duty</span></div></div><div className="login-grid-art"><div /><div /><div /><div /><span>13.0098° N<br />77.5925° E</span></div></div>
    <form className="login-card" onSubmit={submit}><Link to="/" className="login-brand"><span className="brand-mark"><Shield size={19} fill="currentColor" /></span><b>CROWD<span>SAFE</span></b></Link><span className="eyebrow">{showRegister ? 'GUEST ACCESS' : 'STAFF PORTAL'}</span><h2>{showRegister ? 'Create your account' : 'Welcome back'}</h2><p>{showRegister ? 'Create a visitor account to stay connected.' : 'Sign in to your event safety workspace.'}</p>{error && <div className="form-error" role="alert">{error}</div>}{showRegister && <label className="field"><span className="field-label">Your name</span><input required minLength={2} value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Name" /></label>}<label className="field"><span className="field-label">Email address</span><input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label><label className="field"><span className="field-label">Password</span><input required minLength={showRegister ? 8 : 1} type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></label><Button className="login-submit" disabled={busy}>{busy ? 'Signing in…' : showRegister ? 'Create account' : 'Sign in securely'}</Button><div className="demo-credentials"><LockKeyhole size={16} /><div><b>Demo staff access</b><span>organizer@crowdsafe.demo · demo123</span><span>admin@crowdsafe.demo · demo123</span></div></div><div className="login-switch">{showRegister ? 'Already registered?' : 'Attending the festival?'} <button type="button" onClick={() => { setShowRegister(!showRegister); setError(''); }}>{showRegister ? 'Sign in' : 'Create guest account'}</button></div></form>
  </div>;
}

function GuardedAdmin() { const { user } = useAuth(); if (!user || !['Organizer', 'Admin', 'Security', 'Medical Responder', 'Fire Responder'].includes(user.role)) return <Navigate to="/login" replace />; return <AdminPages />; }
function SharedLocationPage() {
  const { token } = useParams(); const { data } = useData(); const [point, setPoint] = useState(null); const [error, setError] = useState('');
  useEffect(() => { let alive = true; fetch(`/api/location-shares/${token}`).then(r => r.ok ? r.json() : Promise.reject(new Error('This location link has expired or was stopped.'))).then(value => alive && setPoint(value)).catch(() => { const demo = JSON.parse(localStorage.getItem('crowd-safe-demo-v1') || '{}').shares || []; const found = demo.find(row => row._id === token && new Date(row.expiresAt) > new Date()); if (alive && found) setPoint(found); else if (alive) setError('This location link has expired or was stopped.'); }); return () => { alive = false; }; }, [token]);
  return <div className="simple-page"><div className="simple-card"><span className="eyebrow">PRIVATE LOCATION SHARE</span><h1>Shared location</h1>{error ? <p>{error}</p> : point ? <><p>Someone shared their location with you temporarily.</p><div className="shared-map"><a href={`https://www.openstreetmap.org/?mlat=${point.lat}&mlon=${point.lng}#map=17/${point.lat}/${point.lng}`} target="_blank" rel="noreferrer">Open location on OpenStreetMap ↗</a></div><p className="field-hint">This link expires at {new Date(point.expiresAt).toLocaleTimeString()}.</p></> : <p>Loading private location…</p>}<LinkButton to="/">Return to CROWD SAFE</LinkButton></div></div>;
}

function RouterContent() {
  const location = useLocation(); const noPublicLayout = ['/login'].includes(location.pathname) || location.pathname.startsWith('/admin') || location.pathname.startsWith('/share/');
  if (location.pathname.startsWith('/admin')) return <GuardedAdmin />;
  if (location.pathname === '/login') return <LoginPage />;
  if (location.pathname.startsWith('/share/')) return <SharedLocationPage />;
  return <PublicLayout />;
}
function AppRoutes() {
  return <Routes><Route element={<PublicLayout />}>
    <Route path="/" element={<HomePage />} /><Route path="/dashboard" element={<PublicDashboardPage />} /><Route path="/map" element={<LiveMapPage />} /><Route path="/near-me" element={<NearMePage />} /><Route path="/emergency" element={<EmergencyPage />} />
    <Route path="/medical" element={<MedicalPage />} /><Route path="/report" element={<ReportPage />} /><Route path="/missing" element={<MissingPage />} /><Route path="/alerts" element={<AlertsPage />} /><Route path="/services" element={<ServicesPage />} /><Route path="/share-location" element={<SharePage />} /><Route path="/event" element={<EventInfoPage />} />
  </Route><Route path="/login" element={<LoginPage />} /><Route path="/admin/*" element={<GuardedAdmin />} /><Route path="/share/:token" element={<SharedLocationPage />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes>;
}

export default function App() {
  return <BrowserRouter><AuthProvider><DataProvider><ToastProvider><AppRoutes /></ToastProvider></DataProvider></AuthProvider></BrowserRouter>;
}
