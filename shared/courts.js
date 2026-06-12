// shared/courts.js — the global court roster (Street Fighter–style stages).
// Adding a court = adding an entry here. The server uses id/name for room
// allocation; the client court builder consumes the visual fields.
//
// Visual schema:
//   palette: floor/key/lines/apron hex colors for the procedural floor texture
//   sky:     vertical gradient stops [top, horizon] + optional night flag
//   light:   { ambient, ambientIntensity, sun, sunIntensity, sunPos, hemi }
//   fog:     { color, near, far } | null
//   backdrop: which procedural backdrop the builder draws (see courts/builder.js)
//   particles: ambient particle system id | null
//   props:   list of procedural prop ids the builder places
//   crowd:   crowd ring style id | null

export const COURTS = [
  {
    id: 'rucker',
    name: 'The Cage',
    location: 'New York City',
    flag: '🇺🇸',
    tagline: 'Chain-link legends. Win here and the city knows your name.',
    palette: { floor: '#6e6862', key: '#9c3c2e', lines: '#e8e4da', apron: '#55504b' },
    sky: { top: '#0e1430', horizon: '#d8722c', night: true },
    light: {
      ambient: '#42507a', ambientIntensity: 0.85,
      sun: '#ffd9a0', sunIntensity: 1.5, sunPos: [12, 18, 8],
      hemi: 0.35,
    },
    fog: { color: '#141a33', near: 38, far: 95 },
    backdrop: 'cityNight',
    particles: null,
    props: ['cageFence', 'streetLamps', 'graffitiWall'],
    crowd: 'fence',
  },
  {
    id: 'venice',
    name: 'Venice Beach',
    location: 'Los Angeles',
    flag: '🇺🇸',
    tagline: 'Sun, sand, and showboating. Golden hour never ends.',
    palette: { floor: '#2e8b9a', key: '#e8743c', lines: '#f5f0e0', apron: '#cbb27a' },
    sky: { top: '#3d9be0', horizon: '#ffd9a8' },
    light: {
      ambient: '#ffe9c4', ambientIntensity: 0.95,
      sun: '#fff3d6', sunIntensity: 1.9, sunPos: [-14, 14, 10],
      hemi: 0.55,
    },
    fog: { color: '#cfe7f5', near: 45, far: 110 },
    backdrop: 'beach',
    particles: 'gulls',
    props: ['palms', 'lifeguardTower', 'muscleBeachSign'],
    crowd: 'boardwalk',
  },
  {
    id: 'tokyo',
    name: 'Shibuya Rooftop',
    location: 'Tokyo',
    flag: '🇯🇵',
    tagline: 'Forty floors up. Neon below, nothing but net above.',
    palette: { floor: '#27262e', key: '#c2185b', lines: '#7df9ff', apron: '#1c1b22' },
    sky: { top: '#070918', horizon: '#3b1e5e', night: true },
    light: {
      ambient: '#5560a8', ambientIntensity: 0.8,
      sun: '#c4d4ff', sunIntensity: 1.0, sunPos: [8, 20, -6],
      hemi: 0.3,
    },
    fog: { color: '#101228', near: 40, far: 100 },
    backdrop: 'neonSkyline',
    particles: 'neonRain',
    props: ['neonSigns', 'rooftopRail', 'acUnits', 'vendingMachines'],
    crowd: null,
  },
  {
    id: 'rio',
    name: 'Favela Heights',
    location: 'Rio de Janeiro',
    flag: '🇧🇷',
    tagline: 'Painted concrete, steep hills, and the loudest crowd on Earth.',
    palette: { floor: '#3f7d4e', key: '#e8b23c', lines: '#fdf6e3', apron: '#8a5a3a' },
    sky: { top: '#2f86d6', horizon: '#ffe9b8' },
    light: {
      ambient: '#fff0d0', ambientIntensity: 1.0,
      sun: '#fff8e0', sunIntensity: 2.0, sunPos: [10, 16, 12],
      hemi: 0.6,
    },
    fog: { color: '#bcd9ee', near: 45, far: 115 },
    backdrop: 'favelaHill',
    particles: 'confetti',
    props: ['stringLights', 'muralWall', 'hillHouses'],
    crowd: 'hillside',
  },
  {
    id: 'paris',
    name: 'Le Toit',
    location: 'Paris',
    flag: '🇫🇷',
    tagline: 'A rooftop in the 7th. The Tower watches every possession.',
    palette: { floor: '#4a4e69', key: '#2a6f97', lines: '#f2e9e4', apron: '#3c3f57' },
    sky: { top: '#5a7bb5', horizon: '#f4c8a8' },
    light: {
      ambient: '#dfe4f5', ambientIntensity: 0.9,
      sun: '#ffe6c8', sunIntensity: 1.5, sunPos: [-10, 15, -8],
      hemi: 0.45,
    },
    fog: { color: '#c5cfe8', near: 42, far: 105 },
    backdrop: 'parisDusk',
    particles: null,
    props: ['mansardEdge', 'cafeChairs', 'planters'],
    crowd: null,
  },
  {
    id: 'tundra',
    name: 'Polar Run',
    location: 'Tromsø',
    flag: '🇳🇴',
    tagline: 'Sub-zero buckets under the aurora. Bring gloves.',
    palette: { floor: '#3a4a5e', key: '#6ea8c4', lines: '#eef4f8', apron: '#2c3a4a' },
    sky: { top: '#03070f', horizon: '#10243c', night: true },
    light: {
      ambient: '#4e6e8e', ambientIntensity: 0.85,
      sun: '#bfe8d8', sunIntensity: 1.1, sunPos: [6, 18, 4],
      hemi: 0.35,
    },
    fog: { color: '#0a1422', near: 35, far: 90 },
    backdrop: 'aurora',
    particles: 'snow',
    props: ['snowBanks', 'floodlights', 'pineTrees'],
    crowd: null,
  },
];

export const COURT_IDS = COURTS.map((c) => c.id);
export function getCourt(id) {
  return COURTS.find((c) => c.id === id) || COURTS[0];
}
