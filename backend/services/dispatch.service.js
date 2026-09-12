/**
 * K3K3 Dispatch Manager Service
 * 
 * Core real-time dispatch and matching engine for K3K3 tricycles:
 * - Maintains active in-memory online rider registry with coordinates & seat capacity
 * - Geospatial proximity matching via Haversine formula
 * - Tiered 20-second offer cascade with automatic failover to next closest rider
 * - Atomic ride acceptance and seat capacity allocation (1-3 seats)
 * - Real-time Socket.io event broadcasting and liveness heartbeat monitoring
 */

const { updateRideStatus, getRideById } = require('./supabase.service');

// Campus default coordinate center (KNUST / K3K3 operating zone)
const DEFAULT_CAMPUS_LAT = 6.6745;
const DEFAULT_CAMPUS_LNG = -1.5716;
const DEFAULT_DISPATCH_RADIUS_KM = 3.5; // Maximum radius to dispatch kekes
const OFFER_TTL_MS = 20000;            // 20-second countdown for each rider offer
const STALE_HEARTBEAT_MS = 45000;      // 45 seconds without GPS ping = mark offline
const KEKE_MAX_CAPACITY = 3;           // Standard K3K3 tricycle capacity

class DispatchService {
  constructor() {
    // Map of active online riders: riderId -> RiderState
    this.riders = new Map();
    // Map of socket ID to riderId: socketId -> riderId
    this.socketToRider = new Map();
    // Map of active trip cascades: tripId -> DispatchCascade
    this.activeCascades = new Map();
    // Reference to Socket.io server instance
    this.io = null;

    // Start periodic background sweep for stale GPS heartbeats (every 15s)
    this.sweepInterval = setInterval(() => this._sweepStaleRiders(), 15000);
  }

  /**
   * Set the Socket.io instance
   */
  setIO(ioInstance) {
    this.io = ioInstance;
  }

  /* ═══════════════════════════════════════════════════════════════
     RIDER POOL MANAGEMENT & HEARTBEATS
  ═══════════════════════════════════════════════════════════════ */

  /**
   * Register or update an online rider
   */
  registerRider(socketId, riderData) {
    if (!riderData || !riderData.riderId) {
      console.warn('[Dispatch] Missing riderId in registration');
      return null;
    }

    const riderId = String(riderData.riderId);
    const existing = this.riders.get(riderId);

    const riderState = {
      socketId,
      riderId,
      name: riderData.name || (existing ? existing.name : 'Keke Rider'),
      phone: riderData.phone || (existing ? existing.phone : ''),
      avatarUrl: riderData.avatarUrl || (existing ? existing.avatarUrl : null),
      vehicleType: riderData.vehicleType || 'tricycle',
      licensePlate: riderData.licensePlate || (existing ? existing.licensePlate : ''),
      capacity: KEKE_MAX_CAPACITY,
      availableSeats: existing ? existing.availableSeats : KEKE_MAX_CAPACITY,
      activeTrips: existing ? existing.activeTrips : [],
      lat: typeof riderData.lat === 'number' ? riderData.lat : (existing ? existing.lat : DEFAULT_CAMPUS_LAT),
      lng: typeof riderData.lng === 'number' ? riderData.lng : (existing ? existing.lng : DEFAULT_CAMPUS_LNG),
      heading: riderData.heading || 0,
      speed: riderData.speed || 0,
      status: 'available', // 'available' | 'busy' | 'offline'
      lastPing: Date.now()
    };

    this.riders.set(riderId, riderState);
    this.socketToRider.set(socketId, riderId);

    console.log(`[Dispatch] Rider ${riderId} (${riderState.name}) is ONLINE. (Total online: ${this.riders.size})`);

    // Broadcast updated online count to all connected clients & admin channel
    if (this.io) {
      this.io.emit('riders:pool_update', {
        onlineCount: this.getOnlineCount(),
        riders: this.getAvailableRidersSummary()
      });
      this.io.to('admin').emit('admin:fleet_update', {
        rider: riderState,
        onlineCount: this.getOnlineCount(),
        riders: this.getAvailableRidersSummary()
      });
    }

    return riderState;
  }

  /**
   * Update rider GPS position & heading
   */
  updateRiderLocation(socketIdOrRiderId, coords) {
    let rider = this.riders.get(String(socketIdOrRiderId));
    if (!rider) {
      const mappedId = this.socketToRider.get(socketIdOrRiderId);
      if (mappedId) rider = this.riders.get(mappedId);
    }

    if (!rider) return null;

    if (typeof coords.lat === 'number' && typeof coords.lng === 'number') {
      rider.lat = coords.lat;
      rider.lng = coords.lng;
    }
    if (coords.heading !== undefined) rider.heading = coords.heading;
    if (coords.speed !== undefined) rider.speed = coords.speed;
    rider.lastPing = Date.now();

    // If rider has active trips, stream location to those trip rooms for smooth map tracking
    if (this.io && rider.activeTrips && rider.activeTrips.length > 0) {
      rider.activeTrips.forEach(tripId => {
        this.io.to(`trip:${tripId}`).emit('trip:rider_location', {
          tripId,
          riderId: rider.riderId,
          lat: rider.lat,
          lng: rider.lng,
          heading: rider.heading,
          speed: rider.speed,
          timestamp: rider.lastPing
        });
      });
    }

    return rider;
  }

  /**
   * Handle rider disconnect or explicit offline toggle
   */
  unregisterRider(socketIdOrRiderId) {
    let riderId = String(socketIdOrRiderId);
    let socketId = null;

    if (this.socketToRider.has(socketIdOrRiderId)) {
      riderId = this.socketToRider.get(socketIdOrRiderId);
      socketId = socketIdOrRiderId;
    }

    const rider = this.riders.get(riderId);
    if (!rider) return false;

    // Clean up tracking maps
    this.riders.delete(riderId);
    if (socketId) this.socketToRider.delete(socketId);
    if (rider.socketId) this.socketToRider.delete(rider.socketId);

    console.log(`[Dispatch] Rider ${riderId} went OFFLINE. (Remaining online: ${this.riders.size})`);

    if (this.io) {
      this.io.emit('riders:pool_update', {
        onlineCount: this.getOnlineCount(),
        riders: this.getAvailableRidersSummary()
      });
      this.io.to('admin').emit('admin:fleet_update', {
        offlineRiderId: riderId,
        onlineCount: this.getOnlineCount(),
        riders: this.getAvailableRidersSummary()
      });
    }

    return true;
  }

  /**
   * Sweep stale riders who missed heartbeats
   */
  _sweepStaleRiders() {
    const now = Date.now();
    let swept = 0;

    for (const [riderId, rider] of this.riders.entries()) {
      if (now - rider.lastPing > STALE_HEARTBEAT_MS) {
        console.log(`[Dispatch] Auto-swept inactive rider ${riderId} (no ping for ${Math.round((now - rider.lastPing)/1000)}s)`);
        this.unregisterRider(riderId);
        swept++;
      }
    }

    if (swept > 0 && this.io) {
      this.io.emit('riders:pool_update', {
        onlineCount: this.getOnlineCount(),
        riders: this.getAvailableRidersSummary()
      });
    }
  }

  /**
   * Get total number of online riders
   */
  getOnlineCount() {
    return this.riders.size;
  }

  /**
   * Get public summary of available riders for map rendering
   */
  getAvailableRidersSummary() {
    const list = [];
    for (const rider of this.riders.values()) {
      list.push({
        riderId: rider.riderId,
        name: rider.name,
        phone: rider.phone,
        lat: rider.lat,
        lng: rider.lng,
        heading: rider.heading,
        availableSeats: rider.availableSeats,
        vehicleType: rider.vehicleType,
        status: rider.status
      });
    }
    return list;
  }

  /**
   * Get map of online riders with ID and normalized phone indexing
   */
  getOnlineRidersMap() {
    const map = new Map();
    for (const [id, r] of this.riders.entries()) {
      map.set(String(id), r);
      if (r.phone) {
        const norm = String(r.phone).replace(/\D/g, '').slice(-9);
        if (norm) map.set(norm, r);
      }
    }
    return map;
  }

  /* ═══════════════════════════════════════════════════════════════
     GEOSPATIAL DISTANCE & MATCHING
  ═══════════════════════════════════════════════════════════════ */

  /**
   * Haversine formula to compute distance in kilometers between two GPS coordinates
   */
  calculateDistanceKm(lat1, lon1, lat2, lon2) {
    if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) return 1.0;
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(2));
  }

  /**
   * Find eligible candidate riders near a pickup point
   */
  findNearbyEligibleRiders({ pickupLat, pickupLng, seatsNeeded = 1, maxRadiusKm = DEFAULT_DISPATCH_RADIUS_KM, rideType = 'shared' }) {
    const candidates = [];
    const pLat = parseFloat(pickupLat) || DEFAULT_CAMPUS_LAT;
    const pLng = parseFloat(pickupLng) || DEFAULT_CAMPUS_LNG;

    for (const rider of this.riders.values()) {
      // Must have enough seats available
      if (rideType === 'alone') {
        // Private ride requires ALL seats free
        if (rider.availableSeats < KEKE_MAX_CAPACITY) continue;
      } else {
        // Shared ride requires at least seatsNeeded free
        if (rider.availableSeats < seatsNeeded) continue;
      }

      if (rider.status === 'offline') continue;

      const distKm = this.calculateDistanceKm(pLat, pLng, rider.lat, rider.lng);

      if (distKm <= maxRadiusKm) {
        // Estimated travel time in minutes at 18 km/h average keke campus speed
        const etaMin = Math.max(1, Math.ceil((distKm / 18) * 60));
        candidates.push({
          rider,
          distanceKm: distKm,
          etaMinutes: etaMin
        });
      }
    }

    // Sort by proximity: closest first
    candidates.sort((a, b) => a.distanceKm - b.distanceKm);
    return candidates;
  }

  /* ═══════════════════════════════════════════════════════════════
     DISPATCH CASCADE ENGINE (OFFER RING & ATOMIC LOCK)
  ═══════════════════════════════════════════════════════════════ */

  /**
   * Dispatch a newly created ride request
   */
  async dispatchRide(ride) {
    if (!ride || !ride.id) {
      console.error('[Dispatch] Cannot dispatch invalid ride object');
      return { success: false, error: 'Invalid ride data' };
    }

    const tripId = ride.id;
    console.log(`[Dispatch] Starting dispatch for Trip ${tripId} (${ride.pickup_address} → ${ride.dropoff_address})`);

    // Seats required (shared = 1 seat, alone = all 3 seats)
    const seatsNeeded = ride.ride_type === 'alone' ? KEKE_MAX_CAPACITY : 1;
    const candidates = this.findNearbyEligibleRiders({
      pickupLat: ride.pickup_latitude,
      pickupLng: ride.pickup_longitude,
      seatsNeeded,
      maxRadiusKm: DEFAULT_DISPATCH_RADIUS_KM,
      rideType: ride.ride_type || 'shared'
    });

    if (candidates.length === 0) {
      console.log(`[Dispatch] No online eligible riders found within ${DEFAULT_DISPATCH_RADIUS_KM}km for Trip ${tripId}`);
      if (this.io) {
        this.io.to(`passenger:${ride.passenger_id}`).emit('trip:no_riders', {
          tripId,
          message: 'No kekes currently available near your location. We will keep retrying.'
        });
      }
      return { success: false, reason: 'no_riders_available' };
    }

    console.log(`[Dispatch] Found ${candidates.length} candidate rider(s) for Trip ${tripId}. Starting cascade.`);

    const cascade = {
      tripId,
      ride,
      seatsNeeded,
      candidates,
      currentIndex: 0,
      activeOfferRiderId: null,
      timer: null,
      status: 'offering' // 'offering' | 'accepted' | 'exhausted' | 'cancelled'
    };

    this.activeCascades.set(tripId, cascade);
    this._offerNextCandidate(cascade);

    return {
      success: true,
      candidateCount: candidates.length,
      firstCandidateRiderId: candidates[0].rider.riderId
    };
  }

  /**
   * Offer the trip to the current candidate in the cascade
   */
  _offerNextCandidate(cascade) {
    if (cascade.status !== 'offering') return;

    // Check if we exhausted all candidates
    if (cascade.currentIndex >= cascade.candidates.length) {
      console.log(`[Dispatch] Cascade exhausted for Trip ${cascade.tripId}. No riders accepted.`);
      cascade.status = 'exhausted';
      this.activeCascades.delete(cascade.tripId);

      if (this.io) {
        this.io.to(`passenger:${cascade.ride.passenger_id}`).emit('trip:no_riders', {
          tripId: cascade.tripId,
          message: 'All nearby riders were busy. Tap retry to contact more drivers.'
        });
      }
      return;
    }

    const currentCandidate = cascade.candidates[cascade.currentIndex];
    const candidateRider = currentCandidate.rider;
    cascade.activeOfferRiderId = candidateRider.riderId;

    const offerPayload = {
      trip_id: cascade.tripId,
      passenger_id: cascade.ride.passenger_id,
      passenger_name: cascade.ride.passenger_name || 'Passenger',
      passenger_rating: 4.9,
      pickup: cascade.ride.pickup_address,
      pickup_lat: cascade.ride.pickup_latitude,
      pickup_lng: cascade.ride.pickup_longitude,
      drop: cascade.ride.dropoff_address,
      dest_lat: cascade.ride.dropoff_latitude,
      dest_lng: cascade.ride.dropoff_longitude,
      fare_estimate: parseFloat(cascade.ride.estimated_fare || cascade.ride.fare_estimate || 5.0),
      ride_type: cascade.ride.ride_type || 'shared',
      seats_needed: cascade.seatsNeeded,
      distance_km: currentCandidate.distanceKm,
      eta_minutes: currentCandidate.etaMinutes,
      ttl_seconds: OFFER_TTL_MS / 1000
    };

    console.log(`[Dispatch] Ringing Rider ${candidateRider.riderId} (${candidateRider.name}) for Trip ${cascade.tripId} [TTL: ${OFFER_TTL_MS/1000}s]`);

    if (this.io) {
      // Ring specific rider's room
      this.io.to(`rider:${candidateRider.riderId}`).emit('trip:offer', offerPayload);
      // Also broadcast to riders:online room as fallback
      this.io.to('riders:online').emit('new_trip', offerPayload);
    }

    // Set 20-second countdown timer for this candidate
    cascade.timer = setTimeout(() => {
      console.log(`[Dispatch] Offer timed out for Rider ${candidateRider.riderId} on Trip ${cascade.tripId}. Cascading...`);
      
      // Dismiss offer card on this rider's screen
      if (this.io) {
        this.io.to(`rider:${candidateRider.riderId}`).emit('trip:offer_expired', {
          tripId: cascade.tripId
        });
      }

      // Advance to next rider
      cascade.currentIndex++;
      this._offerNextCandidate(cascade);
    }, OFFER_TTL_MS);
  }

  /**
   * Handle rider explicit decline
   */
  declineRide(tripId, riderId) {
    const cascade = this.activeCascades.get(tripId);
    if (!cascade || cascade.status !== 'offering') return false;

    console.log(`[Dispatch] Rider ${riderId} explicitly DECLINED Trip ${tripId}. Immediately advancing cascade.`);

    // If this rider is currently holding the active offer
    if (cascade.activeOfferRiderId === String(riderId)) {
      clearTimeout(cascade.timer);
      if (this.io) {
        this.io.to(`rider:${riderId}`).emit('trip:offer_expired', { tripId });
      }
      cascade.currentIndex++;
      this._offerNextCandidate(cascade);
      return true;
    }

    return false;
  }

  /**
   * Handle rider accepting the ride (Atomic Lock)
   */
  async acceptRide(tripId, riderId) {
    const cascade = this.activeCascades.get(tripId);
    const rider = this.riders.get(String(riderId));

    if (!rider) {
      console.warn(`[Dispatch] Accept failed: Rider ${riderId} is not online in memory pool`);
      return { success: false, error: 'Rider is not online' };
    }

    // Check if cascade exists and is still open
    if (!cascade || cascade.status !== 'offering') {
      // Check database directly as secondary validation
      try {
        const dbTrip = await getRideById(tripId);
        if (!dbTrip || dbTrip.status !== 'requested') {
          return { success: false, code: 409, error: 'This ride is no longer available or was already accepted.' };
        }
      } catch (dbErr) {
        console.warn('[Dispatch] DB check bypassed:', dbErr.message);
      }
    }

    // Clear cascade timer immediately
    if (cascade) {
      clearTimeout(cascade.timer);
      cascade.status = 'accepted';
      this.activeCascades.delete(tripId);
    }

    console.log(`[Dispatch] ATOMIC LOCK: Trip ${tripId} accepted by Rider ${riderId} (${rider.name})!`);

    // 1. Update Supabase database record (defensively caught)
    let updatedRide = null;
    try {
      updatedRide = await updateRideStatus(tripId, {
        status: 'accepted',
        rider_id: riderId
      });
    } catch (dbErr) {
      console.warn('[Dispatch] DB updateRideStatus warning:', dbErr.message);
    }

    // 2. Decrement seat capacity on rider state
    const seatsToDeduct = (cascade?.ride?.ride_type === 'alone') ? KEKE_MAX_CAPACITY : 1;
    rider.availableSeats = Math.max(0, rider.availableSeats - seatsToDeduct);
    if (!rider.activeTrips.includes(tripId)) {
      rider.activeTrips.push(tripId);
    }
    if (rider.availableSeats === 0) {
      rider.status = 'busy';
    }

    // Calculate real-time arrival ETA using Haversine formula
    const pLat = typeof updatedRide?.pickup_latitude === 'number' ? updatedRide.pickup_latitude : (typeof cascade?.ride?.pickup_latitude === 'number' ? cascade.ride.pickup_latitude : DEFAULT_CAMPUS_LAT);
    const pLng = typeof updatedRide?.pickup_longitude === 'number' ? updatedRide.pickup_longitude : (typeof cascade?.ride?.pickup_longitude === 'number' ? cascade.ride.pickup_longitude : DEFAULT_CAMPUS_LNG);
    const distKm = this.calculateDistanceKm(rider.lat, rider.lng, pLat, pLng);
    const etaMinutes = Math.max(1, Math.round((distKm / 20) * 60) + 1); // 20 km/h keke speed + 1 min prep
    const etaText = `~${etaMinutes} min`;

    // 3. Emit real-time updates via Socket.io
    if (this.io) {
      const passengerId = cascade?.ride?.passenger_id || updatedRide?.passenger_id;

      // Notify passenger that rider has been assigned with live arrival ETA
      const passengerPayload = {
        tripId,
        status: 'accepted',
        etaMinutes,
        etaText,
        distanceKm: Math.round(distKm * 10) / 10,
        rider: {
          riderId: rider.riderId,
          name: rider.name,
          phone: rider.phone,
          lat: rider.lat,
          lng: rider.lng,
          heading: rider.heading,
          vehicleType: rider.vehicleType,
          licensePlate: rider.licensePlate,
          rating: 4.9
        },
        pickup: updatedRide?.pickup_address || cascade?.ride?.pickup_address,
        drop: updatedRide?.dropoff_address || cascade?.ride?.dropoff_address,
        fare: updatedRide?.estimated_fare || cascade?.ride?.estimated_fare,
        rideType: updatedRide?.ride_type || cascade?.ride?.ride_type
      };

      if (passengerId) {
        this.io.to(`passenger:${passengerId}`).emit('trip:accepted', passengerPayload);
      }
      this.io.to(`trip:${tripId}`).emit('trip:status_change', {
        tripId,
        status: 'accepted',
        payload: passengerPayload
      });

      // Confirm to rider
      this.io.to(`rider:${riderId}`).emit('trip:assigned', {
        tripId,
        ride: updatedRide || cascade?.ride
      });

      // Dismiss card for any other riders
      this.io.to('riders:online').emit('trip:offer_taken', { tripId });

      // Notify admin system of live accepted trip
      this.io.to('admin').emit('admin:trip_update', {
        type: 'trip_accepted',
        tripId,
        status: 'accepted',
        rider: {
          riderId: rider.riderId,
          name: rider.name,
          phone: rider.phone
        },
        pickup: passengerPayload.pickup,
        drop: passengerPayload.drop,
        fare: passengerPayload.fare,
        etaText,
        acceptedAt: new Date().toISOString()
      });

      // Broadcast updated pool availability
      this.io.emit('riders:pool_update', {
        onlineCount: this.getOnlineCount(),
        riders: this.getAvailableRidersSummary()
      });
    }

    return {
      success: true,
      trip: updatedRide,
      rider: {
        riderId: rider.riderId,
        name: rider.name,
        availableSeats: rider.availableSeats
      }
    };
  }

  /**
   * Complete a ride and restore seats
   */
  async completeRide(tripId, riderId, actualFare = null) {
    const rider = this.riders.get(String(riderId));

    const updateData = { status: 'completed' };
    if (actualFare) updateData.actual_fare = parseFloat(actualFare);

    let updatedRide = null;
    try {
      updatedRide = await updateRideStatus(tripId, updateData);
    } catch (dbErr) {
      console.warn('[Dispatch] DB completeRide warning:', dbErr.message);
    }

    if (rider) {
      // Remove trip from rider's active list
      rider.activeTrips = rider.activeTrips.filter(id => id !== tripId);
      // Restore seat capacity
      const seatsToRestore = (updatedRide?.ride_type === 'alone') ? KEKE_MAX_CAPACITY : 1;
      rider.availableSeats = Math.min(KEKE_MAX_CAPACITY, rider.availableSeats + seatsToRestore);
      if (rider.availableSeats > 0) rider.status = 'available';
    }

    if (this.io) {
      this.io.to(`trip:${tripId}`).emit('trip:status_change', {
        tripId,
        status: 'completed',
        actualFare
      });

      // Notify admin system of completed trip & revenue update
      this.io.to('admin').emit('admin:trip_update', {
        type: 'trip_completed',
        tripId,
        status: 'completed',
        actualFare: actualFare || updatedRide?.actual_fare || updatedRide?.estimated_fare || 0,
        completedAt: new Date().toISOString()
      });

      if (rider) {
        this.io.emit('riders:pool_update', {
          onlineCount: this.getOnlineCount(),
          riders: this.getAvailableRidersSummary()
        });
      }
    }

    return { success: true, trip: updatedRide };
  }

  /**
   * Cancel an active or requested ride
   */
  async cancelRide(tripId, cancelledBy, cancellationReason = 'User cancelled') {
    // Clear cascade if still offering
    const cascade = this.activeCascades.get(tripId);
    if (cascade) {
      clearTimeout(cascade.timer);
      cascade.status = 'cancelled';
      this.activeCascades.delete(tripId);
    }

    let updatedRide = null;
    try {
      updatedRide = await updateRideStatus(tripId, {
        status: 'cancelled',
        cancelled_by: cancelledBy,
        cancellation_reason: cancellationReason
      });
    } catch (dbErr) {
      console.warn('[Dispatch] DB cancelRide warning:', dbErr.message);
    }

    // If a rider was already assigned, restore their seats
    if (updatedRide && updatedRide.rider_id) {
      const rider = this.riders.get(String(updatedRide.rider_id));
      if (rider) {
        rider.activeTrips = rider.activeTrips.filter(id => id !== tripId);
        const seatsToRestore = (updatedRide.ride_type === 'alone') ? KEKE_MAX_CAPACITY : 1;
        rider.availableSeats = Math.min(KEKE_MAX_CAPACITY, rider.availableSeats + seatsToRestore);
        if (rider.availableSeats > 0) rider.status = 'available';
      }
    }

    if (this.io) {
      this.io.to(`trip:${tripId}`).emit('trip:status_change', {
        tripId,
        status: 'cancelled',
        reason: cancellationReason
      });
      this.io.to('riders:online').emit('trip:offer_taken', { tripId });
    }

    return { success: true, trip: updatedRide };
  }
}

// Export singleton instance
const dispatchService = new DispatchService();
module.exports = dispatchService;
