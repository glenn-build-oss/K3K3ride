/**
 * K3K3 Backend — Service Area & Regional Expansion Service
 * 
 * Manages operational service areas across Ghana's 16 administrative regions.
 * Dynamically determines whether ride requests fall into activated zones (e.g. Ho, Volta Region)
 * or pending expansion zones (Accra, Kumasi, etc.), captures launch interest waitlists,
 * and configures regional fares.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const supabaseService = require('./supabase.service');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SERVICE_AREAS_FILE = path.join(DATA_DIR, 'service_areas.json');
const LAUNCH_INTERESTS_FILE = path.join(DATA_DIR, 'launch_interests.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error('[ServiceAreaService] Error creating data directory:', err.message);
  }
}

class ServiceAreaService {
  constructor() {
    this.config = this.loadConfig();
    this.launchInterests = this.loadLaunchInterests();
    // Synchronize from Supabase admin_settings on startup in background
    this.syncFromSupabase().catch(err => {
      console.warn('[ServiceAreaService] Initial Supabase sync:', err.message);
    });
  }

  loadConfig() {
    try {
      if (fs.existsSync(SERVICE_AREAS_FILE)) {
        const raw = fs.readFileSync(SERVICE_AREAS_FILE, 'utf8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('[ServiceAreaService] Error reading service_areas.json:', err.message);
    }
    return { regions: [] };
  }

  async syncFromSupabase() {
    try {
      const remote = await supabaseService.getAdminSetting('ghana_service_areas');
      if (remote && remote.value) {
        const parsed = typeof remote.value === 'string' ? JSON.parse(remote.value) : remote.value;
        if (parsed && Array.isArray(parsed.regions) && parsed.regions.length > 0) {
          // Compare timestamps: don't overwrite if local config has a newer updated_at timestamp
          if (this.config && this.config.updated_at && parsed.updated_at) {
            if (new Date(this.config.updated_at).getTime() > new Date(parsed.updated_at).getTime()) {
              return false;
            }
          }
          this.config = parsed;
          try {
            fs.writeFileSync(SERVICE_AREAS_FILE, JSON.stringify(this.config, null, 2), 'utf8');
          } catch (_) {}
          return true;
        }
      }
    } catch (err) {
      console.warn('[ServiceAreaService] syncFromSupabase warning:', err.message);
    }
    return false;
  }

  async syncToSupabase() {
    if (this._syncPromise) {
      await this._syncPromise.catch(() => {});
    }
    const configSnapshot = JSON.parse(JSON.stringify(this.config));
    this._syncPromise = (async () => {
      try {
        await supabaseService.setAdminSetting(
          'ghana_service_areas',
          configSnapshot,
          'Ghana 16 administrative regions operational status, pricing and geofences'
        );
        return true;
      } catch (err) {
        console.warn('[ServiceAreaService] syncToSupabase warning:', err.message);
        return false;
      }
    })();
    return this._syncPromise;
  }

  saveConfig() {
    try {
      this.config.updated_at = new Date().toISOString();
      // 1. Save to local disk if writable
      try {
        fs.writeFileSync(SERVICE_AREAS_FILE, JSON.stringify(this.config, null, 2), 'utf8');
      } catch (e) {
        // Ephemeral or read-only filesystem (e.g. Vercel)
        console.warn('[ServiceAreaService] Disk write skipped (ephemeral/read-only):', e.message);
      }

      // 2. Persist to Supabase admin_settings table
      this.syncToSupabase().catch(err => {
        console.warn('[ServiceAreaService] Background Supabase sync deferred:', err.message);
      });

      return true;
    } catch (err) {
      console.error('[ServiceAreaService] Error saving service_areas.json:', err.message);
      return false;
    }
  }


  loadLaunchInterests() {
    try {
      if (fs.existsSync(LAUNCH_INTERESTS_FILE)) {
        const raw = fs.readFileSync(LAUNCH_INTERESTS_FILE, 'utf8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('[ServiceAreaService] Error reading launch_interests.json:', err.message);
    }
    return [];
  }

  saveLaunchInterests() {
    try {
      fs.writeFileSync(LAUNCH_INTERESTS_FILE, JSON.stringify(this.launchInterests, null, 2), 'utf8');
      return true;
    } catch (err) {
      console.error('[ServiceAreaService] Error saving launch_interests.json:', err.message);
      return false;
    }
  }

  /**
   * Return all 16 regions with cities and status
   */
  getAllRegions() {
    return this.config.regions || [];
  }

  /**
   * Return active operational cities/regions
   */
  getActiveServiceAreas() {
    return (this.config.regions || [])
      .filter(r => r.active)
      .map(r => ({
        ...r,
        cities: (r.cities || []).filter(c => c.active)
      }));
  }

  /**
   * Resolve a location (query string and/or coordinates) to a region and town.
   * Checks whether the matched location is inside an activated operating zone.
   */
  evaluateLocation(locationName = '', lat = null, lng = null) {
    const query = (locationName || '').toLowerCase().trim();
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const hasCoordinates = !isNaN(latitude) && !isNaN(longitude);

    let matchedRegion = null;
    let matchedCity = null;

    // 1. Precise Coordinate Geofence Match (Ho, Volta Region)
    for (const region of this.config.regions || []) {
      for (const city of region.cities || []) {
        if (city.bounds && hasCoordinates) {
          const { min_lat, max_lat, min_lng, max_lng } = city.bounds;
          if (latitude >= min_lat && latitude <= max_lat && longitude >= min_lng && longitude <= max_lng) {
            matchedRegion = region;
            matchedCity = city;
            break;
          }
        }
        // Radius check (within 35km of city center)
        if (city.center && hasCoordinates) {
          const dLat = (latitude - city.center.lat) * 111;
          const dLng = (longitude - city.center.lng) * 111 * Math.cos(city.center.lat * Math.PI / 180);
          const distKm = Math.sqrt(dLat * dLat + dLng * dLng);
          if (distKm <= 35.0) {
            matchedRegion = region;
            matchedCity = city;
            break;
          }
        }
      }
      if (matchedRegion) break;
    }

    // 2. Text / Landmark / Alias Match
    if (!matchedRegion && query) {
      for (const region of this.config.regions || []) {
        // Match region name
        if (query.includes(region.name.toLowerCase()) || query.includes(region.code.toLowerCase())) {
          matchedRegion = region;
        }
        for (const city of region.cities || []) {
          const aliases = city.aliases || [city.name.toLowerCase()];
          const hasAliasMatch = aliases.some(alias => query.includes(alias.toLowerCase()));
          if (hasAliasMatch) {
            matchedRegion = region;
            matchedCity = city;
            break;
          }
        }
        if (matchedCity) break;
      }
    }

    // Default to Ho / Volta if location matches known Ho stops, or if unresolvable default to Ho
    if (!matchedRegion) {
      const voltaRegion = (this.config.regions || []).find(r => r.id === 'volta');
      const hoCity = voltaRegion ? voltaRegion.cities.find(c => c.id === 'ho') : null;
      // If query mentions other major cities specifically, flag them even if not in aliases
      const inactiveNames = [
        { key: 'accra', reg: 'greater_accra', city: 'accra' },
        { key: 'tema', reg: 'greater_accra', city: 'tema' },
        { key: 'kumasi', reg: 'ashanti', city: 'kumasi' },
        { key: 'tamale', reg: 'northern', city: 'tamale' },
        { key: 'takoradi', reg: 'western', city: 'takoradi' },
        { key: 'cape coast', reg: 'central', city: 'cape_coast' },
        { key: 'koforidua', reg: 'eastern', city: 'koforidua' },
        { key: 'sunyani', reg: 'bono', city: 'sunyani' }
      ];
      for (const item of inactiveNames) {
        if (query.includes(item.key)) {
          matchedRegion = (this.config.regions || []).find(r => r.id === item.reg);
          if (matchedRegion) {
            matchedCity = matchedRegion.cities.find(c => c.id === item.city);
            break;
          }
        }
      }

      if (!matchedRegion) {
        // Fallback default: Ho (Volta Region)
        matchedRegion = voltaRegion;
        matchedCity = hoCity;
      }
    }

    const isRegionActive = Boolean(matchedRegion && matchedRegion.active);
    const isCityActive = Boolean(matchedCity ? matchedCity.active : isRegionActive);
    const isOperable = isRegionActive && isCityActive;

    return {
      allowed: isOperable,
      region_id: matchedRegion ? matchedRegion.id : null,
      region_name: matchedRegion ? matchedRegion.name : 'Unknown Region',
      city_id: matchedCity ? matchedCity.id : null,
      city_name: matchedCity ? matchedCity.name : 'Unknown City',
      base_fare_shared: matchedRegion ? (matchedRegion.base_fare_shared || 3.00) : 3.00,
      base_fare_alone: matchedRegion ? (matchedRegion.base_fare_alone || 6.00) : 6.00,
      per_km_rate: matchedRegion ? (matchedRegion.per_km_rate || 1.20) : 1.20,
      status: isOperable ? 'ACTIVE' : 'COMING_SOON',
      message: isOperable
        ? `Service is active in ${matchedCity ? matchedCity.name : matchedRegion.name}`
        : `We're coming to your region! K3K3ride isn't available in ${matchedCity ? matchedCity.name : matchedRegion.name} yet. We're working to bring affordable rides to your region soon.`
    };
  }

  /**
   * Save a passenger's interest notification subscription
   */
  saveLaunchInterest(data) {
    const entry = {
      id: 'waitlist_' + crypto.randomBytes(6).toString('hex'),
      contact: data.contact || data.email || data.phone || '',
      region_id: data.region_id || '',
      region_name: data.region_name || '',
      city_id: data.city_id || '',
      city_name: data.city_name || '',
      pickup_requested: data.pickup_location || '',
      created_at: new Date().toISOString()
    };
    this.launchInterests.unshift(entry);
    this.saveLaunchInterests();
    return entry;
  }

  getLaunchInterests() {
    return this.launchInterests;
  }

  /**
   * Toggle region or city active status
   */
  toggleAreaStatus(regionId, cityId = null, active = true) {
    const cleanId = String(regionId || '').trim().toLowerCase();
    const cleanCode = String(regionId || '').trim().toUpperCase();
    const region = (this.config.regions || []).find(r => r.id === cleanId || r.code === cleanCode || r.id === regionId);
    if (!region) return { success: false, error: 'Region not found' };

    if (cityId) {
      const city = (region.cities || []).find(c => c.id === cityId);
      if (!city) return { success: false, error: 'City not found' };
      city.active = Boolean(active);
      city.is_operational = Boolean(active);
      // If at least one city in the region is active, ensure region is marked active
      if (city.active) region.active = true;
    } else {
      region.active = Boolean(active);
      if (Array.isArray(region.cities)) {
        region.cities.forEach(c => {
          c.active = Boolean(active);
          c.is_operational = Boolean(active);
        });
      }
    }

    this.saveConfig();

    if (active) {
      setTimeout(() => {
        this._notifyWaitlistSubscribers(region, cityId).catch(err => {
          console.warn('[ServiceAreaService] Waitlist notification error:', err.message);
        });
      }, 100);
    }

    return { success: true, region };
  }

  /**
   * Dispatches launch notifications via email and SMS to waitlisted passengers when a region is activated
   */
  async _notifyWaitlistSubscribers(region, cityId = null) {
    if (!region || !this.launchInterests || !this.launchInterests.length) return;

    let resendService = null;
    let moolreSendSMS = null;
    try { resendService = require('./resend.service'); } catch (_) {}
    try { moolreSendSMS = require('./moolre.service').sendSMS; } catch (_) {}

    const regionName = region.name || 'Your Region';
    const activeCities = (region.cities || []).filter(c => c.active).map(c => c.name);
    const cityNames = activeCities.length ? activeCities.join(', ') : regionName;

    let updatedAny = false;
    for (const item of this.launchInterests) {
      const matchRegion = (item.region_id && item.region_id === region.id) ||
                          (item.region_name && item.region_name.toLowerCase().includes(region.name.toLowerCase()));
      const matchCity = !cityId || (item.city_id && item.city_id === cityId);

      if (matchRegion && matchCity && !item.notified) {
        const contact = String(item.contact || item.email || item.phone || '').trim();
        if (!contact) continue;

        if (contact.includes('@') && resendService) {
          // Send official company email from K3K3
          resendService.sendRegionalLaunchNotification({
            to: contact,
            regionName: region.name,
            cityNames: cityNames,
            baseFareShared: region.base_fare_shared,
            baseFareAlone: region.base_fare_alone
          }).then(res => {
            console.log(`[Regional Expansion] Launch email sent to ${contact} for ${region.name}: ${res?.success ? 'Delivered' : (res?.error || 'Simulated')}`);
          }).catch(err => {
            console.warn(`[Regional Expansion] Launch email error for ${contact}:`, err.message);
          });
        } else if (moolreSendSMS) {
          // Send SMS via Moolre
          const cleanPhone = contact.replace(/\D/g, '');
          if (cleanPhone.length >= 9) {
            const smsText = `Good news! K3K3ride is officially live in ${region.name}. Shared rides from GH₵${Number(region.base_fare_shared || 3).toFixed(2)}. Open your app to ride! - Team K3K3`;
            moolreSendSMS(contact, smsText).then(res => {
              console.log(`[Regional Expansion] Launch SMS sent to ${contact} for ${region.name}: ${res?.success ? 'Delivered' : res?.error}`);
            }).catch(err => {
              console.warn(`[Regional Expansion] Launch SMS error for ${contact}:`, err.message);
            });
          }
        }

        item.notified = true;
        item.notified_at = new Date().toISOString();
        updatedAny = true;
      }
    }

    if (updatedAny) {
      this.saveLaunchInterests();
    }
  }

  /**
   * Update regional base pricing
   */
  updateRegionPricing(regionId, pricingData = {}) {
    const region = (this.config.regions || []).find(r => r.id === regionId);
    if (!region) return { success: false, error: 'Region not found' };

    if (pricingData.base_fare_shared !== undefined) {
      region.base_fare_shared = parseFloat(pricingData.base_fare_shared);
    }
    if (pricingData.base_fare_alone !== undefined) {
      region.base_fare_alone = parseFloat(pricingData.base_fare_alone);
    }
    if (pricingData.per_km_rate !== undefined) {
      region.per_km_rate = parseFloat(pricingData.per_km_rate);
    }

    this.saveConfig();
    return { success: true, region };
  }
}

module.exports = new ServiceAreaService();
