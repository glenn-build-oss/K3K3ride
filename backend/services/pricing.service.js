/**
 * K3K3 Backend — Routes & Pricing Service
 * 
 * Manages locations, in/out campus zone classifications,
 * route-specific fare overrides, and global fare settings.
 * Persists to backend/data/pricing_config.json with optional Supabase sync.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const uuidv4 = () => crypto.randomUUID();

const DATA_DIR = path.join(__dirname, '..', 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'pricing_config.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error('[PricingService] Error creating data directory:', err.message);
  }
}

// ─── Default Initial Catalog (Ho, Volta Region) ───
const DEFAULT_LOCATIONS = [
  // ── In-Campus Locations (HTU, UHAS, Hostels) ──
  { id: 'loc_htu_main', name: 'Ho Technical University (HSTU)', zone_type: 'in', category: 'Campuses & Hostels', lat: 6.6276, lng: 0.4735, address: 'Sokode Estates, Ho', icon: 'fa-graduation-cap', is_active: true, is_popular: true },
  { id: 'loc_htu_gate', name: 'HSTU Main Gate', zone_type: 'in', category: 'Campuses & Hostels', lat: 6.6280, lng: 0.4730, address: 'Sokode, Ho', icon: 'fa-university', is_active: true, is_popular: true },
  { id: 'loc_htu_hostel', name: 'HSTU Student Hostel', zone_type: 'in', category: 'Campuses & Hostels', lat: 6.6270, lng: 0.4740, address: 'HSTU Campus, Sokode', icon: 'fa-bed', is_active: true, is_popular: true },
  { id: 'loc_htu_eng', name: 'HSTU Engineering Block', zone_type: 'in', category: 'Campuses & Hostels', lat: 6.6275, lng: 0.4738, address: 'HSTU Campus, Sokode', icon: 'fa-cogs', is_active: true, is_popular: false },
  { id: 'loc_sokode_hostel', name: 'Sokode Hostel', zone_type: 'in', category: 'Campuses & Hostels', lat: 6.6270, lng: 0.4740, address: 'Sokode, Ho', icon: 'fa-bed', is_active: true, is_popular: true },
  { id: 'loc_cedi_aud', name: 'Cedi Auditorium (UHAS)', zone_type: 'in', category: 'Campuses & Hostels', lat: 6.6090, lng: 0.4660, address: 'UHAS Main Campus, Ho', icon: 'fa-landmark', is_active: true, is_popular: true },
  { id: 'loc_uhas', name: 'University of Health & Allied Sciences (UHAS)', zone_type: 'in', category: 'Campuses & Hostels', lat: 6.6090, lng: 0.4660, address: 'UHAS Road, Ho', icon: 'fa-university', is_active: true, is_popular: true },
  { id: 'loc_hygiene', name: 'School of Hygiene', zone_type: 'in', category: 'Campuses & Hostels', lat: 6.6045, lng: 0.4695, address: 'Near Ho Teaching Hospital', icon: 'fa-school', is_active: true, is_popular: true },
  { id: 'loc_dave_campus', name: 'Dave (Southern Campus)', zone_type: 'in', category: 'Campuses & Hostels', lat: 6.5920, lng: 0.4610, address: 'Dave, Ho', icon: 'fa-university', is_active: true, is_popular: false },

  // ── Central & Commercial (Out-Campus / Town) ──
  { id: 'loc_ho_central', name: 'Ho Central', zone_type: 'out', category: 'Central & Commercial', lat: 6.6012, lng: 0.4688, address: 'Commercial High St, Ho', icon: 'fa-city', is_active: true, is_popular: true },
  { id: 'loc_ho_market', name: 'Ho Central Market', zone_type: 'out', category: 'Central & Commercial', lat: 6.6018, lng: 0.4685, address: 'Main Market Corridors, Ho', icon: 'fa-store', is_active: true, is_popular: true },
  { id: 'loc_bus_terminal', name: 'Ho Bus Terminal', zone_type: 'out', category: 'Central & Commercial', lat: 6.6010, lng: 0.4670, address: 'Main Lorry Station, Ho', icon: 'fa-bus', is_active: true, is_popular: true },
  { id: 'loc_town_centre', name: 'Ho Town Centre', zone_type: 'out', category: 'Central & Commercial', lat: 6.6005, lng: 0.4680, address: 'Town Centre, Ho', icon: 'fa-map-pin', is_active: true, is_popular: false },
  { id: 'loc_post_office', name: 'Ho Post Office', zone_type: 'out', category: 'Central & Commercial', lat: 6.6012, lng: 0.4688, address: 'Ho Central', icon: 'fa-envelope', is_active: true, is_popular: false },
  { id: 'loc_stadium', name: 'Ho Sports Stadium', zone_type: 'out', category: 'Central & Commercial', lat: 6.6040, lng: 0.4665, address: 'Stadium Road, Ho', icon: 'fa-trophy', is_active: true, is_popular: true },
  { id: 'loc_jubilee', name: 'Ho Jubilee Park', zone_type: 'out', category: 'Central & Commercial', lat: 6.6000, lng: 0.4660, address: 'Jubilee Park, Ho', icon: 'fa-tree', is_active: true, is_popular: false },

  // ── Hospitals & Healthcare (Out-Campus / Town) ──
  { id: 'loc_trafalgar', name: 'Trafalgar (Ho Teaching Hospital)', zone_type: 'out', category: 'Hospitals & Healthcare', lat: 6.6050, lng: 0.4700, address: 'Trafalgar, Ho', icon: 'fa-hospital', is_active: true, is_popular: true },
  { id: 'loc_volta_regional', name: 'Volta Regional Hospital', zone_type: 'out', category: 'Hospitals & Healthcare', lat: 6.6055, lng: 0.4705, address: 'Regional Road, Ho', icon: 'fa-clinic-medical', is_active: true, is_popular: false },
  { id: 'loc_municipal_hosp', name: 'Ho Municipal Hospital', zone_type: 'out', category: 'Hospitals & Healthcare', lat: 6.6048, lng: 0.4698, address: 'Hospital Rd, Ho', icon: 'fa-hospital-alt', is_active: true, is_popular: false },

  // ── Townships & Residential (Out-Campus / Town) ──
  { id: 'loc_ahoe', name: 'Ahoe', zone_type: 'out', category: 'Townships & Residential', lat: 6.6070, lng: 0.4730, address: 'Ahoe Suburb, Ho', icon: 'fa-home', is_active: true, is_popular: true },
  { id: 'loc_dome', name: 'Dome Area', zone_type: 'out', category: 'Townships & Residential', lat: 6.6100, lng: 0.4720, address: 'Dome, Ho', icon: 'fa-map-pin', is_active: true, is_popular: true },
  { id: 'loc_bankoe', name: 'Bankoe', zone_type: 'out', category: 'Townships & Residential', lat: 6.6130, lng: 0.4760, address: 'Bankoe, Ho', icon: 'fa-home', is_active: true, is_popular: false },
  { id: 'loc_kpehe', name: 'Kpehe', zone_type: 'out', category: 'Townships & Residential', lat: 6.5980, lng: 0.4640, address: 'Kpehe, Ho', icon: 'fa-home', is_active: true, is_popular: false },
  { id: 'loc_barracks', name: 'Volta Barracks', zone_type: 'out', category: 'Townships & Residential', lat: 6.6180, lng: 0.4820, address: 'Volta Barracks, Ho', icon: 'fa-shield-alt', is_active: true, is_popular: true },
  { id: 'loc_mawuli_est', name: 'Mawuli Estates', zone_type: 'out', category: 'Townships & Residential', lat: 6.6030, lng: 0.4750, address: 'Mawuli Estates, Ho', icon: 'fa-building', is_active: true, is_popular: true },
  { id: 'loc_mawuli_sch', name: 'Mawuli School', zone_type: 'out', category: 'Townships & Residential', lat: 6.6030, lng: 0.4705, address: 'Mawuli Road, Ho', icon: 'fa-school', is_active: true, is_popular: false },
  { id: 'loc_sokode_est', name: 'Sokode Estates', zone_type: 'out', category: 'Townships & Residential', lat: 6.6258, lng: 0.4710, address: 'Sokode, Ho', icon: 'fa-home', is_active: true, is_popular: false },
  { id: 'loc_sokode_junc', name: 'Sokode Junction', zone_type: 'out', category: 'Townships & Residential', lat: 6.6265, lng: 0.4718, address: 'Sokode Main Junction, Ho', icon: 'fa-road', is_active: true, is_popular: true },
  { id: 'loc_fiave', name: 'Fiave', zone_type: 'out', category: 'Townships & Residential', lat: 6.6150, lng: 0.4780, address: 'Fiave, Ho', icon: 'fa-home', is_active: true, is_popular: false },
  { id: 'loc_mirage', name: 'Mirage', zone_type: 'out', category: 'Townships & Residential', lat: 6.6025, lng: 0.4670, address: 'Mirage, Ho', icon: 'fa-map-pin', is_active: true, is_popular: true },
  { id: 'loc_guiness', name: 'Guiness', zone_type: 'out', category: 'Townships & Residential', lat: 6.6110, lng: 0.4710, address: 'Guiness Depot Area, Ho', icon: 'fa-warehouse', is_active: true, is_popular: false },
  { id: 'loc_lokoe', name: 'Lokoe', zone_type: 'out', category: 'Townships & Residential', lat: 6.5890, lng: 0.4580, address: 'Lokoe, Ho', icon: 'fa-home', is_active: true, is_popular: true }
];

// ─── Default Route Fare Matrix (Symmetric Overrides) ───
const DEFAULT_ROUTE_FARES = [
  { id: 'rf_1',  from: 'School of Hygiene', to: 'Trafalgar (Ho Teaching Hospital)', fare: 3.00, zone_type: 'in',  notes: 'Intra-health campus fixed fare' },
  { id: 'rf_2',  from: 'School of Hygiene', to: 'Guiness',                         fare: 3.00, zone_type: 'in',  notes: 'Campus corridor' },
  { id: 'rf_3',  from: 'Trafalgar (Ho Teaching Hospital)', to: 'Ahoe',              fare: 3.00, zone_type: 'in',  notes: 'Standard campus connection' },
  { id: 'rf_4',  from: 'Trafalgar (Ho Teaching Hospital)', to: 'Ho Sports Stadium', fare: 3.00, zone_type: 'in',  notes: 'Hospital to Stadium' },
  { id: 'rf_5',  from: 'Ahoe',              to: 'Ho Technical University (HSTU)',   fare: 3.00, zone_type: 'in',  notes: 'Ahoe to HTU' },
  { id: 'rf_6',  from: 'Ahoe',              to: 'Volta Barracks',                  fare: 3.50, zone_type: 'out', notes: 'Out-campus uphill route' },
  { id: 'rf_7',  from: 'Ahoe',              to: 'Ho Central Market',               fare: 3.00, zone_type: 'out', notes: 'Ahoe to Central Market' },
  { id: 'rf_8',  from: 'Ho Technical University (HSTU)', to: 'Mirage',              fare: 3.00, zone_type: 'out', notes: 'HTU to Mirage junction' },
  { id: 'rf_9',  from: 'Mirage',            to: 'Lokoe',                           fare: 3.40, zone_type: 'out', notes: 'Extended out-campus corridor' },
  { id: 'rf_10', from: 'Cedi Auditorium (UHAS)', to: 'Sokode Hostel',              fare: 3.00, zone_type: 'in',  notes: 'UHAS campus to hostel' },
  { id: 'rf_11', from: 'Cedi Auditorium (UHAS)', to: 'Trafalgar (Ho Teaching Hospital)', fare: 3.00, zone_type: 'in',  notes: 'UHAS to Teaching Hospital' },
  { id: 'rf_12', from: 'Cedi Auditorium (UHAS)', to: 'School of Hygiene',          fare: 3.00, zone_type: 'in',  notes: 'UHAS to Hygiene' },
  { id: 'rf_13', from: 'Dave (Southern Campus)', to: 'Trafalgar (Ho Teaching Hospital)', fare: 3.00, zone_type: 'in',  notes: 'Dave campus to hospital' },
  { id: 'rf_14', from: 'Dave (Southern Campus)', to: 'Ahoe',                       fare: 3.00, zone_type: 'in',  notes: 'Dave campus to Ahoe' },
  { id: 'rf_15', from: 'Dave (Southern Campus)', to: 'Ho Central Market',          fare: 3.00, zone_type: 'out', notes: 'Dave campus to Central Market' },
  { id: 'rf_16', from: 'Mawuli Estates',    to: 'Trafalgar (Ho Teaching Hospital)', fare: 3.00, zone_type: 'out', notes: 'Mawuli Estates to hospital' },
  { id: 'rf_17', from: 'Mawuli Estates',    to: 'Ahoe',                            fare: 3.00, zone_type: 'out', notes: 'Mawuli Estates to Ahoe' },
  { id: 'rf_18', from: 'Sokode Hostel',     to: 'Trafalgar (Ho Teaching Hospital)', fare: 3.00, zone_type: 'in',  notes: 'Sokode hostel to hospital' },
  { id: 'rf_19', from: 'Sokode Hostel',     to: 'Ahoe',                            fare: 3.00, zone_type: 'in',  notes: 'Sokode hostel to Ahoe' },
  { id: 'rf_20', from: 'Ho Technical University (HSTU)', to: 'Ho Central Market',   fare: 4.00, zone_type: 'out', notes: 'Main HTU campus to Ho Central Market' },
  { id: 'rf_21', from: 'HSTU Main Gate',    to: 'Ho Central Market',               fare: 4.00, zone_type: 'out', notes: 'HTU Gate to Ho Central Market' }
];

// ─── Default Global Pricing Settings ───
const DEFAULT_SETTINGS = {
  in_campus_base_fare: 3.00,
  out_campus_base_fare: 4.00,
  alone_multiplier: 3.0,
  minimum_fare: 3.00,
  per_km_rate: 1.80,
  mapbox_public_token: process.env.MAPBOX_PUBLIC_TOKEN || '',
  currency_symbol: '₵',
  currency_code: 'GHS',
  updated_at: new Date().toISOString()
};

let _cache = null;

/**
 * Load configuration from disk or initialize with defaults
 */
function loadConfig() {
  if (_cache) return _cache;

  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
      _cache = JSON.parse(raw);
      // Ensure expected root keys exist
      if (!_cache.locations || !Array.isArray(_cache.locations)) _cache.locations = DEFAULT_LOCATIONS;
      if (!_cache.routes || !Array.isArray(_cache.routes)) _cache.routes = DEFAULT_ROUTE_FARES;
      if (!_cache.settings || typeof _cache.settings !== 'object') _cache.settings = DEFAULT_SETTINGS;
      return _cache;
    }
  } catch (err) {
    console.error('[PricingService] Error reading pricing_config.json:', err.message);
  }

  // Fallback to defaults and persist
  _cache = {
    locations: DEFAULT_LOCATIONS,
    routes: DEFAULT_ROUTE_FARES,
    settings: DEFAULT_SETTINGS,
    version: '1.0.0'
  };
  saveConfig(_cache);
  return _cache;
}

/**
 * Persist config to disk
 */
function saveConfig(cfg) {
  try {
    cfg.settings.updated_at = new Date().toISOString();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
    _cache = cfg;
    return true;
  } catch (err) {
    console.error('[PricingService] Error saving pricing_config.json:', err.message);
    return false;
  }
}

/**
 * Normalizes place name for robust matching
 */
function normalizeName(str) {
  if (!str) return '';
  return String(str).trim().toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '')
    .replace(/\s+/g, ' ');
}

// ─── Public API Methods ───

/**
 * Retrieve full pricing configuration
 */
function getPricingConfig() {
  const cfg = loadConfig();
  return {
    success: true,
    locations: cfg.locations,
    routes: cfg.routes,
    settings: cfg.settings
  };
}

/**
 * Find location by ID or name
 */
function findLocation(query) {
  if (!query) return null;
  const cfg = loadConfig();
  const qNorm = normalizeName(query);

  return cfg.locations.find(loc => {
    if (loc.id === query) return true;
    const nameNorm = normalizeName(loc.name);
    return nameNorm === qNorm || nameNorm.includes(qNorm) || qNorm.includes(nameNorm);
  }) || null;
}

/**
 * Calculate fare between two locations with In/Out classification
 */
function calculateFare(from, to) {
  const cfg = loadConfig();
  const settings = cfg.settings || DEFAULT_SETTINGS;

  if (!from || !to) {
    return {
      success: false,
      fare: settings.in_campus_base_fare,
      shared_fare: settings.in_campus_base_fare,
      alone_fare: +(settings.in_campus_base_fare * settings.alone_multiplier).toFixed(2),
      zone_type: 'in',
      is_override: false,
      label: 'Standard In-Campus Fare'
    };
  }

  const fromNorm = normalizeName(from);
  const toNorm = normalizeName(to);

  if (fromNorm === toNorm) {
    return {
      success: false,
      error: 'Pickup and destination are identical',
      fare: 0,
      shared_fare: 0,
      alone_fare: 0,
      zone_type: 'same'
    };
  }

  // 1. Check for explicit route fare override
  const routeMatch = (cfg.routes || []).find(r => {
    const rfFrom = normalizeName(r.from);
    const rfTo = normalizeName(r.to);
    return (
      (rfFrom === fromNorm && rfTo === toNorm) ||
      (rfFrom === toNorm && rfTo === fromNorm) ||
      (fromNorm.includes(rfFrom) && toNorm.includes(rfTo)) ||
      (toNorm.includes(rfFrom) && fromNorm.includes(rfTo))
    );
  });

  if (routeMatch && typeof routeMatch.fare === 'number') {
    const sharedFare = +routeMatch.fare.toFixed(2);
    const aloneFare = +(sharedFare * settings.alone_multiplier).toFixed(2);
    return {
      success: true,
      fare: sharedFare,
      shared_fare: sharedFare,
      alone_fare: aloneFare,
      zone_type: routeMatch.zone_type || 'out',
      is_override: true,
      route_id: routeMatch.id,
      notes: routeMatch.notes || 'Configured Route Rate',
      label: `${routeMatch.zone_type === 'in' ? 'In-Campus Route' : 'Out-Campus Route'} (Override)`
    };
  }

  // 2. Classify based on location zone types
  const fromLoc = findLocation(from);
  const toLoc = findLocation(to);

  const fromZone = fromLoc ? fromLoc.zone_type : 'out';
  const toZone = toLoc ? toLoc.zone_type : 'out';

  // Both endpoints in campus -> In-Campus Base
  if (fromZone === 'in' && toZone === 'in') {
    const sharedFare = +settings.in_campus_base_fare.toFixed(2);
    const aloneFare = +(sharedFare * settings.alone_multiplier).toFixed(2);
    return {
      success: true,
      fare: sharedFare,
      shared_fare: sharedFare,
      alone_fare: aloneFare,
      zone_type: 'in',
      is_override: false,
      label: 'Standard In-Campus Route'
    };
  }

  // One or both endpoints out -> Out-Campus Base
  const sharedFare = +settings.out_campus_base_fare.toFixed(2);
  const aloneFare = +(sharedFare * settings.alone_multiplier).toFixed(2);
  return {
    success: true,
    fare: sharedFare,
    shared_fare: sharedFare,
    alone_fare: aloneFare,
    zone_type: 'out',
    is_override: false,
    label: 'Standard Out-Campus Route'
  };
}

// ─── Locations CRUD ───

function createLocation(data) {
  if (!data || !data.name) throw new Error('Location name is required');
  const cfg = loadConfig();

  const newLoc = {
    id: data.id || `loc_${uuidv4().slice(0, 8)}`,
    name: String(data.name).trim(),
    zone_type: data.zone_type === 'in' ? 'in' : 'out',
    category: data.category || (data.zone_type === 'in' ? 'Campuses & Hostels' : 'Central & Commercial'),
    lat: typeof data.lat === 'number' ? data.lat : (parseFloat(data.lat) || 6.6012),
    lng: typeof data.lng === 'number' ? data.lng : (parseFloat(data.lng) || 0.4688),
    address: data.address || `${data.name}, Ho`,
    icon: data.icon || (data.zone_type === 'in' ? 'fa-graduation-cap' : 'fa-map-pin'),
    is_active: data.is_active !== false,
    is_popular: Boolean(data.is_popular)
  };

  // Prevent duplicate names
  const existing = cfg.locations.find(l => normalizeName(l.name) === normalizeName(newLoc.name));
  if (existing) {
    throw new Error(`A location with the name "${newLoc.name}" already exists.`);
  }

  cfg.locations.push(newLoc);
  saveConfig(cfg);
  return newLoc;
}

function updateLocation(id, data) {
  if (!id) throw new Error('Location ID is required');
  const cfg = loadConfig();
  const index = cfg.locations.findIndex(l => l.id === id);
  if (index === -1) throw new Error('Location not found');

  const curr = cfg.locations[index];
  const updated = {
    ...curr,
    name: data.name !== undefined ? String(data.name).trim() : curr.name,
    zone_type: data.zone_type !== undefined ? (data.zone_type === 'in' ? 'in' : 'out') : curr.zone_type,
    category: data.category !== undefined ? data.category : curr.category,
    lat: data.lat !== undefined ? (typeof data.lat === 'number' ? data.lat : parseFloat(data.lat)) : curr.lat,
    lng: data.lng !== undefined ? (typeof data.lng === 'number' ? data.lng : parseFloat(data.lng)) : curr.lng,
    address: data.address !== undefined ? data.address : curr.address,
    icon: data.icon !== undefined ? data.icon : curr.icon,
    is_active: data.is_active !== undefined ? Boolean(data.is_active) : curr.is_active,
    is_popular: data.is_popular !== undefined ? Boolean(data.is_popular) : curr.is_popular
  };

  cfg.locations[index] = updated;
  saveConfig(cfg);
  return updated;
}

function deleteLocation(id) {
  if (!id) throw new Error('Location ID is required');
  const cfg = loadConfig();
  const initialLen = cfg.locations.length;
  cfg.locations = cfg.locations.filter(l => l.id !== id);

  if (cfg.locations.length === initialLen) {
    throw new Error('Location not found');
  }

  // Also clean up any route fares referencing this deleted location name
  saveConfig(cfg);
  return { success: true, deleted_id: id };
}

// ─── Route Fares CRUD ───

function createRouteFare(data) {
  if (!data || !data.from || !data.to) throw new Error('Origin (from) and Destination (to) are required');
  if (typeof data.fare !== 'number' && isNaN(parseFloat(data.fare))) {
    throw new Error('Valid fare amount is required');
  }

  const cfg = loadConfig();
  const newRoute = {
    id: data.id || `rf_${uuidv4().slice(0, 8)}`,
    from: String(data.from).trim(),
    to: String(data.to).trim(),
    fare: +(parseFloat(data.fare).toFixed(2)),
    zone_type: data.zone_type === 'in' ? 'in' : 'out',
    notes: data.notes || 'Configured Route Override'
  };

  // Check if identical pair exists
  const existingIdx = cfg.routes.findIndex(r => 
    (normalizeName(r.from) === normalizeName(newRoute.from) && normalizeName(r.to) === normalizeName(newRoute.to)) ||
    (normalizeName(r.from) === normalizeName(newRoute.to) && normalizeName(r.to) === normalizeName(newRoute.from))
  );

  if (existingIdx !== -1) {
    // Update existing rather than creating duplicate
    cfg.routes[existingIdx] = { ...cfg.routes[existingIdx], ...newRoute };
  } else {
    cfg.routes.push(newRoute);
  }

  saveConfig(cfg);
  return newRoute;
}

function updateRouteFare(id, data) {
  if (!id) throw new Error('Route Fare ID is required');
  const cfg = loadConfig();
  const index = cfg.routes.findIndex(r => r.id === id);
  if (index === -1) throw new Error('Route fare not found');

  const curr = cfg.routes[index];
  const updated = {
    ...curr,
    from: data.from !== undefined ? String(data.from).trim() : curr.from,
    to: data.to !== undefined ? String(data.to).trim() : curr.to,
    fare: data.fare !== undefined ? +(parseFloat(data.fare).toFixed(2)) : curr.fare,
    zone_type: data.zone_type !== undefined ? (data.zone_type === 'in' ? 'in' : 'out') : curr.zone_type,
    notes: data.notes !== undefined ? data.notes : curr.notes
  };

  cfg.routes[index] = updated;
  saveConfig(cfg);
  return updated;
}

function deleteRouteFare(id) {
  if (!id) throw new Error('Route Fare ID is required');
  const cfg = loadConfig();
  const initialLen = cfg.routes.length;
  cfg.routes = cfg.routes.filter(r => r.id !== id);

  if (cfg.routes.length === initialLen) {
    throw new Error('Route fare override not found');
  }

  saveConfig(cfg);
  return { success: true, deleted_id: id };
}

// ─── Settings Update ───

function updateSettings(data) {
  if (!data || typeof data !== 'object') throw new Error('Settings object is required');
  const cfg = loadConfig();

  cfg.settings = {
    ...cfg.settings,
    in_campus_base_fare: data.in_campus_base_fare !== undefined ? +(parseFloat(data.in_campus_base_fare).toFixed(2)) : cfg.settings.in_campus_base_fare,
    out_campus_base_fare: data.out_campus_base_fare !== undefined ? +(parseFloat(data.out_campus_base_fare).toFixed(2)) : cfg.settings.out_campus_base_fare,
    alone_multiplier: data.alone_multiplier !== undefined ? +(parseFloat(data.alone_multiplier).toFixed(2)) : cfg.settings.alone_multiplier,
    per_km_rate: data.per_km_rate !== undefined ? +(parseFloat(data.per_km_rate).toFixed(2)) : cfg.settings.per_km_rate,
    minimum_fare: data.minimum_fare !== undefined ? +(parseFloat(data.minimum_fare).toFixed(2)) : cfg.settings.minimum_fare,
    mapbox_public_token: data.mapbox_public_token !== undefined ? String(data.mapbox_public_token).trim() : cfg.settings.mapbox_public_token
  };

  saveConfig(cfg);
  return cfg.settings;
}

module.exports = {
  getPricingConfig,
  findLocation,
  calculateFare,
  createLocation,
  updateLocation,
  deleteLocation,
  createRouteFare,
  updateRouteFare,
  deleteRouteFare,
  updateSettings,
  DEFAULT_LOCATIONS,
  DEFAULT_ROUTE_FARES,
  DEFAULT_SETTINGS
};
