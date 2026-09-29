export const event = {
  _id: 'central-festival-2026', name: 'Central Festival 2026', date: '2026-09-28', venue: 'Palace Grounds, Bengaluru',
  status: 'LIVE', expectedCrowd: 20000, peopleInEvent: 12540, center: [13.0098, 77.5925],
  description: 'A three-day celebration of music, food and community. Our safety teams are on site and ready to help.'
};

export const zones = [
  { _id: 'za', name: 'Zone A · Main Stage', lat: 13.0108, lng: 77.5931, people: 2120, density: 35, trend: 'steady', risk: 'SAFE' },
  { _id: 'zb', name: 'Zone B · East Lawn', lat: 13.0088, lng: 77.5945, people: 4380, density: 67, trend: 'increasing', risk: 'WARNING' },
  { _id: 'zc', name: 'Zone C · Food Court', lat: 13.0118, lng: 77.5915, people: 6250, density: 91, trend: 'increasing', risk: 'CRITICAL' },
  { _id: 'zd', name: 'Zone D · Garden', lat: 13.0077, lng: 77.5905, people: 1780, density: 52, trend: 'steady', risk: 'MODERATE' },
  { _id: 'ze', name: 'Zone E · West Gate', lat: 13.0092, lng: 77.5888, people: 840, density: 28, trend: 'decreasing', risk: 'SAFE' },
  { _id: 'zf', name: 'Zone F · Arena', lat: 13.0125, lng: 77.5942, people: 3060, density: 74, trend: 'increasing', risk: 'WARNING' },
  { _id: 'zg', name: 'Zone G · River Walk', lat: 13.0069, lng: 77.5934, people: 930, density: 42, trend: 'steady', risk: 'MODERATE' },
  { _id: 'zh', name: 'Zone H · Parking', lat: 13.0061, lng: 77.5897, people: 1180, density: 31, trend: 'decreasing', risk: 'SAFE' }
];

const facility = (id, name, category, lat, lng, options = {}) => ({ _id: id, name, category, lat, lng, status: 'AVAILABLE', phone: '080-5550-0101', address: 'Palace Grounds, Bengaluru', ...options });
export const facilities = [
  facility('h1', 'Bengaluru City Hospital', 'Hospital', 13.0165, 77.5891, { phone: '080-5550-0112', distance: '1.2 km', emergency: true }),
  facility('h2', 'Northside Medical Centre', 'Hospital', 13.0032, 77.6011, { phone: '080-5550-0113', distance: '2.1 km', emergency: true }),
  facility('h3', 'Cunningham Road Clinic', 'Hospital', 13.0159, 77.5988, { phone: '080-5550-0114', distance: '2.4 km', emergency: false }),
  facility('fs1', 'Fire Station · Vyalikaval', 'Fire Station', 13.0154, 77.5835, { phone: '080-5550-0115', distance: '1.8 km' }),
  facility('fs2', 'Fire Station · Malleshwaram', 'Fire Station', 13.0025, 77.5704, { phone: '080-5550-0116', distance: '3.4 km' }),
  facility('amb1', 'Ambulance · North Medical', 'Ambulance', 13.0122, 77.5901, { phone: '080-5550-0117', distance: '250 m' }),
  facility('amb2', 'Ambulance · East Lawn', 'Ambulance', 13.0082, 77.5952, { phone: '080-5550-0118', distance: '400 m' }),
  facility('m1', 'First Aid Booth · Main Stage', 'First Aid', 13.0104, 77.5928, { phone: '080-5550-0120', distance: '150 m' }),
  facility('m2', 'First Aid Booth · East Lawn', 'First Aid', 13.0089, 77.5942, { phone: '080-5550-0121', distance: '350 m' }),
  facility('m3', 'Medical Tent · Food Court', 'First Aid', 13.0111, 77.5908, { phone: '080-5550-0122', distance: '420 m' }),
  facility('m4', 'First Aid Booth · West Gate', 'First Aid', 13.0091, 77.589, { phone: '080-5550-0123', distance: '500 m' }),
  facility('s1', 'Security Point 01', 'Security', 13.0102, 77.5916, { team: 5, distance: '250 m' }),
  facility('s2', 'Security Point 02', 'Security', 13.0082, 77.5938, { status: 'BUSY', team: 3, distance: '600 m' }),
  facility('s3', 'Security Point 03', 'Security', 13.012, 77.5924, { team: 4, distance: '300 m' }),
  facility('s4', 'Security Point 04', 'Security', 13.0074, 77.5919, { team: 3, distance: '750 m' }),
  facility('s5', 'Security Point 05', 'Security', 13.0105, 77.5955, { team: 3, distance: '450 m' }),
  facility('police1', 'Police Help Desk', 'Police', 13.0096, 77.5889, { phone: '080-5550-0124', distance: '900 m' }),
  ...[
    ['g1', 'North Entry', 13.0128, 77.5908, 'Entry'], ['g2', 'East Entry', 13.0091, 77.5962, 'Entry'], ['g3', 'South Entry', 13.0067, 77.5924, 'Entry'],
    ['g4', 'West Entry', 13.0092, 77.5878, 'Entry'], ['g5', 'VIP Entry', 13.0134, 77.5935, 'Entry'], ['g6', 'Staff Entry', 13.0078, 77.5871, 'Entry'],
    ['x1', 'Gate A · North Exit', 13.013, 77.5914, 'Exit'], ['x2', 'Gate B · East Exit', 13.0095, 77.596, 'Exit'], ['x3', 'Gate C · South Exit', 13.0064, 77.5921, 'Exit'], ['x4', 'Gate D · West Exit', 13.0091, 77.5879, 'Exit']
  ].map(([id, name, lat, lng, category]) => facility(id, name, category, lat, lng, { capacity: 3000, crowd: id === 'x1' ? 78 : id === 'x2' ? 32 : id === 'x3' ? 0 : 49, status: id === 'x3' ? 'BLOCKED' : id === 'x1' ? 'CONGESTED' : 'OPEN' })),
  facility('stage1', 'Central Stage', 'Stage', 13.0109, 77.5935),
  facility('water1', 'Water Point · Garden', 'Water', 13.0076, 77.5902),
  facility('toilet1', 'Restrooms · East Lawn', 'Toilets', 13.0087, 77.5954),
  facility('help1', 'Festival Help Desk', 'Help Desk', 13.0097, 77.5912),
  facility('park1', 'North Parking', 'Parking', 13.0059, 77.5894)
];

export const incidents = [
  { _id: 'i1', category: 'Fire', title: 'Smoke reported near vendor row', description: 'Small smoke plume reported by a guest. Please keep the access lane clear.', zone: 'Zone C · Food Court', lat: 13.0114, lng: 77.5912, status: 'VERIFIED', severity: 'CRITICAL', createdAt: new Date(Date.now() - 8 * 60000).toISOString(), assignedResponder: 'Fire Team 01' },
  { _id: 'i2', category: 'Medical', title: 'Medical assistance requested', description: 'Guest with a minor injury near the east lawn.', zone: 'Zone B · East Lawn', lat: 13.0089, lng: 77.5943, status: 'RESPONDING', severity: 'HIGH', createdAt: new Date(Date.now() - 5 * 60000).toISOString(), assignedResponder: 'Medical Team 02' },
  { _id: 'i3', category: 'Crowd Problem', title: 'Crowd building at north entry', description: 'Please use alternate entry points.', zone: 'Zone A · Main Stage', lat: 13.0121, lng: 77.591, status: 'UNVERIFIED', severity: 'MEDIUM', createdAt: new Date(Date.now() - 3 * 60000).toISOString() },
  { _id: 'i4', category: 'Security Issue', title: 'Guest assistance requested', description: 'Security team requested at the garden path.', zone: 'Zone D · Garden', lat: 13.0079, lng: 77.5908, status: 'VERIFIED', severity: 'MEDIUM', createdAt: new Date(Date.now() - 14 * 60000).toISOString() },
  { _id: 'i5', category: 'Medical', title: 'Guest feeling unwell', description: 'First aid requested near west gate.', zone: 'Zone E · West Gate', lat: 13.009, lng: 77.589, status: 'RESOLVED', severity: 'LOW', createdAt: new Date(Date.now() - 38 * 60000).toISOString(), assignedResponder: 'Medical Team 01' }
];

export const alerts = [
  { _id: 'a1', title: 'Fire reported — Zone C', message: 'Verified report. Response team dispatched. Keep access lane clear.', level: 'RED', status: 'ACTIVE', category: 'Fire', createdAt: new Date(Date.now() - 8 * 60000).toISOString(), zone: 'Zone C · Food Court' },
  { _id: 'a2', title: 'Medical emergency — Zone B', message: 'Medical team responding near the East Lawn.', level: 'ORANGE', status: 'ACTIVE', category: 'Medical', createdAt: new Date(Date.now() - 5 * 60000).toISOString(), zone: 'Zone B · East Lawn' },
  { _id: 'a3', title: 'Gate C exit blocked', message: 'Use Gate B or Gate D. Follow staff directions.', level: 'YELLOW', status: 'ACTIVE', category: 'Exit', createdAt: new Date(Date.now() - 12 * 60000).toISOString(), zone: 'South Exit' },
  { _id: 'a4', title: 'Medical incident resolved', message: 'Guest assisted by event medical staff.', level: 'GREEN', status: 'ACTIVE', category: 'Medical', createdAt: new Date(Date.now() - 24 * 60000).toISOString(), zone: 'Zone E · West Gate' },
  { _id: 'a5', title: 'Gate A is congested', message: 'Please use Gate B or the West Entry while the north entry clears.', level: 'YELLOW', status: 'ACTIVE', category: 'Exit', createdAt: new Date(Date.now() - 19 * 60000).toISOString(), zone: 'North Exit' },
  { _id: 'a6', title: 'High crowd density — Zone F', message: 'Use the marked paths and avoid stopping near the Arena entrance.', level: 'ORANGE', status: 'ACTIVE', category: 'Crowd Problem', createdAt: new Date(Date.now() - 31 * 60000).toISOString(), zone: 'Zone F · Arena' },
  { _id: 'a7', title: 'Water point replenished', message: 'Water stations are available at the Garden and East Lawn.', level: 'GREEN', status: 'RESOLVED', category: 'Information', createdAt: new Date(Date.now() - 43 * 60000).toISOString(), zone: 'Zone D · Garden' },
  { _id: 'a8', title: 'Keep response lane clear', message: 'Emergency access lane beside the food court must remain unobstructed.', level: 'YELLOW', status: 'ACTIVE', category: 'Safety notice', createdAt: new Date(Date.now() - 49 * 60000).toISOString(), zone: 'Zone C · Food Court' }
];

export const responders = [
  ['r1', 'Medical Team 01', 'Medical', 'AVAILABLE', 13.0101, 77.5904], ['r2', 'Medical Team 02', 'Medical', 'RESPONDING', 13.009, 77.594],
  ['r3', 'Medical Team 03', 'Medical', 'AVAILABLE', 13.0117, 77.592], ['r4', 'Medical Team 04', 'Medical', 'BUSY', 13.0078, 77.593],
  ['r5', 'Fire Team 01', 'Fire', 'RESPONDING', 13.0112, 77.5915], ['r6', 'Fire Team 02', 'Fire', 'AVAILABLE', 13.013, 77.588],
  ['r7', 'Security Team 05', 'Security', 'BUSY', 13.008, 77.591], ['r8', 'Security Team 06', 'Security', 'AVAILABLE', 13.0095, 77.592],
  ['r9', 'Security Team 07', 'Security', 'AVAILABLE', 13.0125, 77.595], ['r10', 'Medical Team 05', 'Medical', 'AVAILABLE', 13.0068, 77.590]
].map(([id, name, team, status, lat, lng]) => ({ _id: id, name, team, type: team, status, lat, lng, assignment: status === 'RESPONDING' ? 'Incident response' : null }));

export const exits = facilities.filter(f => f.category === 'Exit');
export const missingPersons = [
  { _id: 'mp1', name: 'Aarav (family report)', age: 9, gender: 'Boy', description: 'Child separated from family', clothing: 'Yellow t-shirt, blue shorts', lastSeen: 'East Lawn', lastSeenAt: new Date(Date.now() - 19 * 60000).toISOString(), contact: 'Contact through Festival Help Desk', status: 'SEARCHING', lat: 13.0089, lng: 77.5942 },
  { _id: 'mp2', name: 'Meera (family report)', age: 67, gender: 'Woman', description: 'Senior adult separated from companion', clothing: 'Green shawl, glasses', lastSeen: 'North Entry', lastSeenAt: new Date(Date.now() - 34 * 60000).toISOString(), contact: 'Contact through Festival Help Desk', status: 'SEARCHING', lat: 13.0127, lng: 77.5907 }
];

export const demoUsers = [
  { _id: 'u1', name: 'Event Organizer', email: 'organizer@crowdsafe.demo', role: 'Organizer' },
  { _id: 'u2', name: 'Safety Admin', email: 'admin@crowdsafe.demo', role: 'Admin' }
];
