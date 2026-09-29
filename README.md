# CROWD SAFE

Real-time safety and emergency coordination for large public gatherings.

CROWD SAFE is a full-stack MVP for a live event: a public safety dashboard and a role-protected organizer command center share event data through an Express API and Socket.IO. It includes interactive OpenStreetMap maps, incident review, event exits, crowd zones, responder coordination, family reunification, analytics, and a guided demonstration sequence.

## Run locally

Requirements: Node.js 20+ and npm. MongoDB is optional for local demonstration.

```bash
npm install
```

Copy `.env.example` to `.env` and set a private `JWT_SECRET`. Leave `MONGODB_URI` empty to run the in-memory demo store, or set it to a MongoDB connection string for persistent storage.

```bash
npm run dev
```

The web app runs at <http://localhost:5173>; the Express API and Socket.IO server run at <http://localhost:4000>. The Vite development server proxies API and Socket.IO requests. Demo event data is preloaded in either storage mode.

### Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Organizer | `organizer@crowdsafe.demo` | `demo123` |
| Admin | `admin@crowdsafe.demo` | `demo123` |

Use **Run Demo Mode** from the command center to play the crowd warning, blocked exit, medical/fire reports, verification, responder assignment, response and resolution sequence. Demo accounts and event contacts are illustrative. Change the demo password using `DEMO_PASSWORD` before sharing a deployed demo.

### MongoDB seed and production build

With `MONGODB_URI` configured, load/refresh the seeded event records and demo credentials:

```bash
npm run seed
```

Build the frontend and serve it from Express:

```bash
npm run build
```

Set `NODE_ENV=production` and run `npm start`. Set `CLIENT_ORIGIN` to the deployed frontend origin when using separate hosts.

## Working features

- Public event home, public event dashboard, live map, location-aware nearby services, verified alert feed, emergency options, incident and medical reporting, missing-person/found-person reporting, private expiring location shares, event information, and nearby service directory.
- Staff command center with overview, map, incident verification/rejection, responder assignment and status, crowd zone estimates, exit management, missing-person sightings and found status, alert authoring/removal, facility management, event settings, user/audit views, and Recharts analytics.
- Leaflet maps render OpenStreetMap tiles, venue facilities, exits, crowd density circles, verified incidents and (for authorized staff) responder locations. Map controls include nearby points, map layers, recentering, popups, and route links.
- Public reports begin `UNVERIFIED`; a recent matching category near the same coordinates is marked as a possible duplicate. Staff verification publishes an alert. Public users do not receive unverified report details, responder coordinates, missing-person contact/sighting details, or staff audit records.
- Browser location is requested only after a user action. Location share links are random, unlisted tokens with a 15-minute expiry and an explicit stop action. They are not broadcast over Socket.IO.
- JWT login, bcrypt password hashes, role-gated staff endpoints, input checks, rate limiting on public reports, and staff audit records are included. The local fallback mode persists demo changes in browser local storage and synchronizes open tabs.

## Project structure

```text
src/
  components/       Shared controls and Leaflet safety map
  data/             Seed event data used by frontend and backend
  pages/             Public pages and organizer command center
  services/          API client and browser-storage fallback
  App.jsx            Routes, auth/data providers, Socket.IO and emergency dialog
  styles.css         Responsive product UI and Tailwind layers
server/
  models.js          Mongoose collections
  store.js           Mongo persistence with in-memory seed fallback
  server.js          Express REST API, JWT roles and Socket.IO events
  seed.js            MongoDB demo seed command
```

## API overview

Authentication: `POST /api/auth/login`, `POST /api/auth/register`.

Event data: `GET/POST /api/events`, `PATCH /api/events/:id`, `GET /api/dashboard`, `GET/POST /api/facilities`, `GET /api/zones`, `PATCH /api/zones/:id`.

Coordination: `GET/POST /api/incidents`, `PATCH /api/incidents/:id`, `POST /api/incidents/:id/assign`, `GET/POST /api/reports`, `PATCH /api/reports/:id`, `GET/PATCH /api/exits`, `GET/PATCH /api/responders`, `GET/POST/PATCH /api/missing-persons`, `GET/POST/DELETE /api/alerts`.

Privacy and staff: `POST/GET/DELETE /api/location-shares`, `GET /api/users`, `GET /api/audit-logs`, `POST /api/demo/run`.

Socket.IO publishes `incident_created`, `incident_verified`, `incident_resolved`, `alert_created`, `alert_removed`, `exit_status_changed`, `responder_assigned`, `responder_status_changed`, `crowd_updated`, `missing_person_created`, and `missing_person_updated`. Private coordinates and personal report fields are not included in public socket payloads.

## Notes

- Map service contacts, venue locations and crowd/response analytics are explicitly illustrative demo data. The platform does not report live hospital beds, camera-derived occupancy, or real emergency dispatch. India’s official emergency number shown by the app is **112**.
- Location and optional photo fields use browser geolocation and a size-limited image data URL for the MVP. Production deployments should configure secure HTTPS, rotate secrets, use durable object storage, add retention policies, and connect verified event/venue services.
- Public/private boundaries are enforced at API routes as well as in the interface. Do not use demo data or the built-in demo accounts for live public safety operations.
