import { createContext, createElement, useContext, useEffect, useMemo, useState } from 'react';

const NavigationContext = createContext(null);
const MatchContext = createContext({ base: '', params: {}, outlet: null });
function readLocation() { return { pathname: window.location.pathname || '/', search: window.location.search, hash: window.location.hash, state: window.history.state }; }

export function BrowserRouter({ children }) {
  const [location, setLocation] = useState(readLocation);
  useEffect(() => { const onPop = () => setLocation(readLocation()); window.addEventListener('popstate', onPop); return () => window.removeEventListener('popstate', onPop); }, []);
  const navigate = (to, options = {}) => {
    const url = new URL(to, window.location.href);
    if (options.replace) window.history.replaceState(options.state || null, '', url);
    else window.history.pushState(options.state || null, '', url);
    setLocation(readLocation());
    if (options.scroll !== false) window.scrollTo({ top: 0, behavior: 'auto' });
  };
  const value = useMemo(() => ({ location, navigate }), [location]);
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigate() { return useContext(NavigationContext).navigate; }
export function useLocation() { return useContext(NavigationContext).location; }
export function useParams() { return useContext(MatchContext).params; }
export function useSearchParams() {
  const { location, navigate } = useContext(NavigationContext);
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const setParams = (next, options) => { const value = next instanceof URLSearchParams ? next : new URLSearchParams(next); navigate(`${location.pathname}?${value.toString()}`, options); };
  return [params, setParams];
}

export function Link({ to, replace, state, onClick, target, children, ...props }) {
  const navigate = useNavigate();
  return <a href={to} target={target} onClick={event => { onClick?.(event); if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || target === '_blank') return; event.preventDefault(); navigate(to, { replace, state }); }} {...props}>{children}</a>;
}
export function NavLink({ to, end = false, className = '', children, ...props }) {
  const { location } = useContext(NavigationContext);
  const active = end ? location.pathname === to : to === '/' ? location.pathname === '/' : location.pathname === to || location.pathname.startsWith(`${to}/`);
  return <Link to={to} className={typeof className === 'function' ? className({ isActive: active, isPending: false }) : `${className}${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined} {...props}>{typeof children === 'function' ? children({ isActive: active, isPending: false }) : children}</Link>;
}
export function Navigate({ to, replace = false, state }) { const navigate = useNavigate(); useEffect(() => navigate(to, { replace, state }), [to, replace]); return null; }
export function Route() { return null; }
export function Outlet() { return useContext(MatchContext).outlet; }

function matchPath(pattern, pathname, base) {
  if (pattern === undefined || pattern === null) return { matched: true, base, params: {} };
  if (pattern === '*') return { matched: true, base, params: {} };
  const wildcard = pattern.endsWith('/*');
  const rawPath = pattern.startsWith('/') ? pattern.slice(1) : `${base}/${pattern}`.replace(/^\/+/, '');
  const routeSegments = rawPath.split('/').filter(Boolean);
  const actualSegments = pathname.split('/').filter(Boolean);
  const max = wildcard ? routeSegments.length - 1 : routeSegments.length;
  if (wildcard ? actualSegments.length < max : actualSegments.length !== max) return { matched: false };
  const params = {};
  for (let i = 0; i < max; i++) {
    const expected = routeSegments[i]; const actual = actualSegments[i];
    if (expected?.startsWith(':')) params[expected.slice(1)] = decodeURIComponent(actual || '');
    else if (expected !== actual) return { matched: false };
  }
  const nextBase = `/${routeSegments.slice(0, max).join('/')}` || '/';
  return { matched: true, base: nextBase === '/' ? '' : nextBase, params };
}

function resolveRoutes(children, pathname, base, inheritedParams = {}) {
  for (const route of children || []) {
    if (!route || route.type !== Route) continue;
    const props = route.props;
    let result;
    if (props.index) result = { matched: pathname === (base || '/') || pathname === `${base}/`, base, params: {} };
    else result = matchPath(props.path, pathname, base);
    if (!result.matched) continue;
    const params = { ...inheritedParams, ...result.params };
    const nextBase = result.base ?? base;
    const nested = props.children ? resolveRoutes(props.children, pathname, nextBase, params) : null;
    if (props.children && !nested) continue;
    if (!props.element) { if (nested) return nested; continue; }
    return <MatchContext.Provider key={`${props.path || 'layout'}:${pathname}`} value={{ base: nextBase, params, outlet: nested }}>{props.element}</MatchContext.Provider>;
  }
  return null;
}

export function Routes({ children }) {
  const { location } = useContext(NavigationContext);
  const { base, params } = useContext(MatchContext);
  const routes = useMemo(() => resolveRoutes(children, location.pathname, base, params), [children, location.pathname, base, params]);
  return routes;
}
