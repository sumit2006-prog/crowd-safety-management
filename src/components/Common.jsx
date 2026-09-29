import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Check, ChevronDown, Clock3, Copy, LocateFixed, MapPin, Navigation, Phone, ShieldCheck, X } from 'lucide-react';
import { Link } from '../router.jsx';

export function Button({ children, variant = 'primary', className = '', icon: Icon, ...props }) {
  return <button className={`button button-${variant} ${className}`} {...props}>{Icon && <Icon size={17} strokeWidth={2.2} />}{children}</button>;
}
export function Call112Button({ children = 'Call 112', className = '', variant = 'danger' }) {
  const [confirm, setConfirm] = useState(false);
  return <><Button type="button" variant={variant} className={className} icon={Phone} onClick={() => setConfirm(true)}>{children}</Button><Modal open={confirm} onClose={() => setConfirm(false)} title="Confirm emergency call"><p className="modal-copy">Call India’s official emergency number 112 now?</p><div className="modal-actions"><Button type="button" variant="outline" onClick={() => setConfirm(false)}>Cancel</Button><a className="button button-danger" href="tel:112" onClick={() => setConfirm(false)}><Phone size={16} />Call 112</a></div></Modal></>;
}
export function LinkButton({ to, children, variant = 'primary', className = '', icon: Icon }) {
  return <Link className={`button button-${variant} ${className}`} to={to}>{Icon && <Icon size={17} strokeWidth={2.2} />}{children}</Link>;
}
export function Panel({ children, className = '', title, description, action, icon: Icon }) {
  return <section className={`panel ${className}`}>{(title || action) && <div className="panel-heading"><div className="panel-title-wrap">{Icon && <span className="panel-icon"><Icon size={17} /></span>}<div>{title && <h2>{title}</h2>}{description && <p>{description}</p>}</div></div>{action}</div>}{children}</section>;
}
export function PageHeading({ eyebrow, title, description, actions }) {
  return <div className="page-heading"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="heading-actions">{actions}</div>}</div>;
}
export function StatusPill({ children, tone }) {
  const value = String(children || '').toUpperCase();
  const inferred = tone || (['VERIFIED', 'RESOLVED', 'OPEN', 'AVAILABLE', 'SAFE', 'SEARCHING'].includes(value) ? 'green' : ['UNVERIFIED', 'WARNING', 'CONGESTED', 'ASSIGNED', 'MODERATE'].includes(value) ? 'amber' : ['CRITICAL', 'BLOCKED', 'REJECTED', 'RESPONDING'].includes(value) ? 'red' : 'blue');
  return <span className={`status-pill status-${inferred}`}><span className="status-dot" />{children}</span>;
}
export function MetricCard({ label, value, detail, icon: Icon, tone = 'blue', trend }) {
  return <article className={`metric-card metric-${tone}`}><div className="metric-top"><span>{label}</span><span className="metric-icon">{Icon && <Icon size={18} />}</span></div><strong>{value}</strong><div className="metric-bottom">{trend && <span className={trend > 0 ? 'trend-up' : 'trend-down'}>{trend > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{Math.abs(trend)}%</span>}{detail && <span>{detail}</span>}</div></article>;
}
export function Modal({ open, onClose, title, children, wide = false }) {
  useEffect(() => { if (!open) return; const handler = e => e.key === 'Escape' && onClose?.(); window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); }, [open, onClose]);
  if (!open) return null;
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose?.()}><div role="dialog" aria-modal="true" aria-label={title} className={`modal-card ${wide ? 'modal-wide' : ''}`}><div className="modal-heading"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={20} /></button></div>{children}</div></div>;
}
export function Toasts({ items, onRemove }) {
  return <div className="toast-stack" aria-live="polite">{items.map(item => <div key={item.id} className={`toast toast-${item.tone || 'blue'}`}><span className="toast-icon">{item.tone === 'green' ? <Check size={17} /> : <AlertTriangle size={17} />}</span><span>{item.message}</span><button aria-label="Dismiss notification" onClick={() => onRemove(item.id)}><X size={15} /></button></div>)}</div>;
}
export function ServiceActions({ item, directions = true }) {
  const phone = item.phone || '080-5550-0101';
  const url = `https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}`;
  return <div className="service-actions"><span className="service-demo-label" title={`Illustrative demo number: ${phone}`}>DEMO CONTACT</span><a className="button button-small button-soft" href={`tel:${phone}`} aria-label={`Call demo contact for ${item.name}`}><Phone size={14} />Call</a>{directions && <a className="button button-small button-outline" href={url} target="_blank" rel="noreferrer"><Navigation size={14} />Directions</a>}</div>;
}
export function Field({ label, hint, children, className = '' }) {
  return <label className={`field ${className}`}><span className="field-label">{label}</span>{children}{hint && <span className="field-hint">{hint}</span>}</label>;
}
export function InlineNotice({ children, tone = 'blue', icon: Icon = ShieldCheck }) {
  return <div className={`inline-notice notice-${tone}`}><Icon size={17} /><span>{children}</span></div>;
}
export function TimeLabel({ value }) {
  const date = new Date(value); const distance = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  return <span className="time-label"><Clock3 size={13} />{distance < 1 ? 'Just now' : `${distance} min ago`}</span>;
}
export function CopyButton({ value, children = 'Copy link' }) {
  const [copied, setCopied] = useState(false);
  return <Button variant="outline" icon={copied ? Check : Copy} onClick={async () => { try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { window.prompt('Copy this link', value); } }}>{copied ? 'Copied' : children}</Button>;
}
export function LocationButton({ onClick, busy, children = 'Use my location' }) {
  return <Button variant="outline" icon={busy ? ChevronDown : LocateFixed} onClick={onClick} disabled={busy}>{busy ? 'Finding location…' : children}</Button>;
}
export function LocationNote({ fallback }) {
  return <span className="location-note"><MapPin size={13} />{fallback || 'Event location'}</span>;
}
