/**
 * K3K3 Backend — Trip Store Service
 * 
 * Provides persistent storage and retrieval for rides and ride history
 * with file-based persistence in backend/data/trips.json and optional Supabase sync.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const TRIPS_FILE = path.join(DATA_DIR, 'trips.json');

if (!fs.existsSync(DATA_DIR)) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}
}

class TripStoreService {
  constructor() {
    this.trips = this.loadTrips();
  }

  loadTrips() {
    try {
      if (fs.existsSync(TRIPS_FILE)) {
        const raw = fs.readFileSync(TRIPS_FILE, 'utf8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.warn('[TripStore] Could not read trips.json, initializing empty:', err.message);
    }
    return [];
  }

  saveTrips() {
    try {
      fs.writeFileSync(TRIPS_FILE, JSON.stringify(this.trips, null, 2), 'utf8');
    } catch (err) {
      console.error('[TripStore] Error writing trips.json:', err.message);
    }
  }

  getTripById(tripId) {
    if (!tripId) return null;
    return this.trips.find(t => t.id === tripId || t.tripId === tripId) || null;
  }

  saveTrip(tripData) {
    const existingIndex = this.trips.findIndex(t => t.id === tripData.id);
    const now = new Date().toISOString();

    const normalizedTrip = {
      id: tripData.id || ('trip_' + require('crypto').randomBytes(6).toString('hex')),
      passenger_id: tripData.passenger_id || tripData.passengerId || null,
      passenger_name: tripData.passenger_name || tripData.passengerName || 'Passenger',
      pickup_address: tripData.pickup_label || tripData.pickup_address || tripData.pickup || 'Pickup Location',
      pickup_latitude: parseFloat(tripData.pickup_latitude || tripData.pickup_lat || 6.6078),
      pickup_longitude: parseFloat(tripData.pickup_longitude || tripData.pickup_lng || 0.4651),
      dropoff_address: tripData.dest_label || tripData.dropoff_address || tripData.destination || 'Destination',
      dropoff_latitude: parseFloat(tripData.dropoff_latitude || tripData.dest_lat || 6.6005),
      dropoff_longitude: parseFloat(tripData.dropoff_longitude || tripData.dest_lng || 0.4715),
      estimated_fare: parseFloat(tripData.fare_estimate || tripData.estimated_fare || tripData.fare || 3.0),
      ride_type: tripData.ride_type || 'shared',
      payment_method: tripData.payment_method || 'cash',
      status: tripData.status || 'requested',
      rider_id: tripData.rider_id || tripData.riderId || null,
      rider: tripData.rider || null,
      created_at: tripData.created_at || now,
      requested_at: tripData.requested_at || now,
      updated_at: now
    };

    if (existingIndex >= 0) {
      this.trips[existingIndex] = { ...this.trips[existingIndex], ...normalizedTrip, updated_at: now };
    } else {
      this.trips.unshift(normalizedTrip);
    }

    this.saveTrips();
    return normalizedTrip;
  }

  updateTripStatus(tripId, status, details = {}) {
    const trip = this.getTripById(tripId);
    if (!trip) return null;

    trip.status = status;
    trip.updated_at = new Date().toISOString();
    if (details.rider) trip.rider = details.rider;
    if (details.rider_id) trip.rider_id = details.rider_id;
    if (details.cancel_reason) trip.cancel_reason = details.cancel_reason;
    if (status === 'completed') trip.completed_at = new Date().toISOString();

    this.saveTrips();
    return trip;
  }

  getPassengerTrips(passengerId, limit = 50) {
    if (!passengerId) return [];
    const cleanId = String(passengerId).trim();
    return this.trips.filter(t => 
      t.passenger_id === cleanId || 
      (t.passenger_name && cleanId.includes(t.passenger_name))
    ).slice(0, limit);
  }

  deletePassengerTrips(passengerId) {
    if (!passengerId) return 0;
    const cleanId = String(passengerId).trim();
    const initialLen = this.trips.length;
    this.trips = this.trips.filter(t => t.passenger_id !== cleanId);
    const count = initialLen - this.trips.length;
    if (count > 0) this.saveTrips();
    return count;
  }

  getAllTrips(limit = 100) {
    return this.trips.slice(0, limit);
  }
}

module.exports = new TripStoreService();
