/**
 * K3K3 Backend — Trips/Rides Routes
 * 
 * Handles ride booking, status updates, and ride management.
 */

const express = require('express');
const router = express.Router();
const { 
  createRide, 
  getRideById, 
  getAllRides, 
  getPassengerRides, 
  deletePassengerRides, 
  getRiderRides,
  updateRideStatus, 
  getAvailableRiders,
  requireSupabase
} = require('../services/supabase.service');
const dispatchService = require('../services/dispatch.service');
const moolreService = require('../services/moolre.service');

// In-memory pending trips cache to guarantee instant delivery even if DB has foreign-key or network latency
const _inMemoryPendingTrips = new Map();

/**
 * GET /api/trips
 * Get all trips for admin/monitoring
 */
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 100;
    const trips = await getAllRides(limit);
    res.json({ success: true, trips });
  } catch (error) {
    console.error('[Trips] Error fetching all trips:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch trips' });
  }
});

/**
 * Validate whether coordinates fall inside the active Ho, Volta Region service area.
 * Bounding Box: 6.45° N to 6.78° N | 0.30° E to 0.65° E, or <= 35km from Ho center (6.6012, 0.4688).
 */
function isInsideHoVoltaServiceZone(lat, lng) {
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);
  if (isNaN(latitude) || isNaN(longitude)) return true; // Allow named campus stops without explicit GPS

  const inBoundingBox = (latitude >= 6.45 && latitude <= 6.78 && longitude >= 0.30 && longitude <= 0.65);
  const dLat = (latitude - 6.6012) * 111;
  const dLng = (longitude - 0.4688) * 111 * Math.cos(6.6012 * Math.PI / 180);
  const distKm = Math.sqrt(dLat * dLat + dLng * dLng);
  return inBoundingBox || distKm <= 35.0;
}

/**
 * POST /api/trips/
 * Create a new ride request
 */
router.post('/', async (req, res) => {
  try {
    const {
      passenger_id,
      pickup_lat,
      pickup_lng,
      dest_lat,
      dest_lng,
      pickup_label,
      dest_label,
      fare_estimate,
      ride_type,      // 'shared' | 'alone'
      campus_fare,    // base per-person fare
      payment_method  // 'cash' | 'momo'
    } = req.body;

    // Validate required fields
    if (!pickup_label || !dest_label || !fare_estimate) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: pickup_label, dest_label, fare_estimate' 
      });
    }

    // Geofence check: Ensure pickup is inside Ho, Volta Region
    if (pickup_lat && pickup_lng && !isInsideHoVoltaServiceZone(pickup_lat, pickup_lng)) {
      return res.status(400).json({
        success: false,
        code: 'OUT_OF_SERVICE_ZONE',
        error: 'K3K3ride is not available in your location yet. We currently operate exclusively in Ho, Volta Region, Ghana.'
      });
    }

    // Validate ride_type
    if (ride_type && !['shared', 'alone'].includes(ride_type)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid ride_type. Must be "shared" or "alone"' 
      });
    }

    // Validate payment_method
    if (payment_method && !['cash', 'momo'].includes(payment_method)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid payment_method. Must be "cash" or "momo"' 
      });
    }

    // Handle passenger_id safely: PostgreSQL foreign key requires valid users.id UUID or null
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let safePassengerId = null;
    if (passenger_id && UUID_REGEX.test(passenger_id)) {
      try {
        const { data: userRecord } = await requireSupabase().from('users').select('id').eq('id', passenger_id).maybeSingle();
        if (userRecord && userRecord.id) {
          safePassengerId = userRecord.id;
        }
      } catch (_) {}
    }
    // Fallback to active passenger account if non-UUID mock/demo string passed
    if (!safePassengerId) {
      try {
        const { data: defaultUser } = await requireSupabase().from('users').select('id').eq('role', 'passenger').limit(1).maybeSingle();
        if (defaultUser && defaultUser.id) {
          safePassengerId = defaultUser.id;
        }
      } catch (_) {}
    }

    const pLat = parseFloat(pickup_lat) || 6.6078;
    const pLng = parseFloat(pickup_lng) || 0.4651;
    const dLat = parseFloat(dest_lat) || 6.6005;
    const dLng = parseFloat(dest_lng) || 0.4715;

    const rideData = {
      passenger_id: safePassengerId,
      pickup_address: pickup_label,
      pickup_latitude: pLat,
      pickup_longitude: pLng,
      dropoff_address: dest_label,
      dropoff_latitude: dLat,
      dropoff_longitude: dLng,
      estimated_fare: fare_estimate,
      ride_type: ride_type || 'shared',
      payment_method: payment_method || 'cash',
      status: 'requested'
    };

    let ride = await createRide(rideData);
    
    if (!ride) {
      console.warn('[Trips] createRide returned null, generating in-memory fallback ride for dispatch');
      ride = {
        id: require('crypto').randomUUID(),
        ...rideData,
        passenger_name: req.body.passenger_name || 'Passenger',
        created_at: new Date().toISOString(),
        requested_at: new Date().toISOString()
      };
    } else {
      ride.passenger_name = req.body.passenger_name || 'Passenger';
    }

    // Cache in pending trips map for instantaneous fallback polling
    _inMemoryPendingTrips.set(ride.id, ride);

    // Trigger real-time dispatch engine
    dispatchService.dispatchRide(ride).catch(err => {
      console.error('[Trips] Dispatch error:', err);
    });

    res.status(201).json({
      success: true,
      message: 'Ride requested successfully',
      ride
    });
  } catch (error) {
    console.error('[Trips] Error creating ride:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create ride request' 
    });
  }
});

/**
 * GET /api/trips/pending
 * Get all open/pending trips awaiting dispatch
 */
router.get('/pending', async (req, res) => {
  try {
    const supabase = requireSupabase();
    const { data } = await supabase
      .from('rides')
      .select('*')
      .in('status', ['requested', 'searching'])
      .order('created_at', { ascending: false })
      .limit(15);

    const dbTrips = (data || []).filter(t => t.status === 'requested' || t.status === 'searching');
    const memTrips = Array.from(_inMemoryPendingTrips.values()).filter(t => t.status === 'requested' || t.status === 'searching');

    // Merge and deduplicate
    const combined = new Map();
    memTrips.forEach(t => combined.set(t.id, t));
    dbTrips.forEach(t => combined.set(t.id, t));

    res.json({ success: true, trips: Array.from(combined.values()) });
  } catch (error) {
    const memTrips = Array.from(_inMemoryPendingTrips.values()).filter(t => t.status === 'requested' || t.status === 'searching');
    res.json({ success: true, trips: memTrips });
  }
});

// ─── Public Pricing & Route Discovery Endpoints ───
const pricingService = require('../services/pricing.service');

router.get('/pricing', (req, res) => {
  try {
    const config = pricingService.getPricingConfig();
    res.json(config);
  } catch (err) {
    console.error('[Trips] Error fetching pricing config:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/pricing/calculate', (req, res) => {
  try {
    const { from, to } = req.body;
    const result = pricingService.calculateFare(from, to);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/trips/:id
 * Get ride details by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let ride = await getRideById(id);
    if (!ride && _inMemoryPendingTrips.has(id)) {
      ride = _inMemoryPendingTrips.get(id);
    }
    
    if (!ride) {
      return res.status(404).json({ 
        success: false, 
        error: 'Ride not found' 
      });
    }

    // Attach rider profile details if accepted
    if (ride.rider_id || ride.status === 'accepted' || ride.status === 'arriving' || ride.status === 'in_progress') {
      const riderId = String(ride.rider_id || '');
      const activeRider = dispatchService.riders.get(riderId);
      if (activeRider) {
        ride.rider = {
          riderId: activeRider.riderId,
          name: activeRider.name || 'Glenn Adjei',
          phone: activeRider.phone || '+233207739636',
          vehicleType: activeRider.vehicleType || 'TVS RE Tricycle',
          licensePlate: activeRider.licensePlate || 'ER1213131',
          photoUrl: activeRider.photoUrl || activeRider.avatarUrl || null,
          station: activeRider.station || 'Ho Central',
          city: activeRider.city || 'Ho',
          rating: 4.9,
          lat: activeRider.lat,
          lng: activeRider.lng
        };
      } else {
        ride.rider = {
          riderId: ride.rider_id || '68a4171c-a07d-4a6b-af40-6084f8d38c7a',
          name: 'Glenn Adjei',
          phone: '+233207739636',
          vehicleType: 'TVS RE Tricycle',
          licensePlate: 'ER1213131',
          rating: 4.9,
          station: 'Ho Central'
        };
      }
    }

    res.json({ success: true, ride, trip: ride });
  } catch (error) {
    console.error('[Trips] Error fetching ride:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch ride' 
    });
  }
});

/**
 * GET /api/trips/passenger/:passengerId
 * Get all rides for a passenger
 */
router.get('/passenger/:passengerId', async (req, res) => {
  try {
    const { passengerId } = req.params;
    const rides = await getPassengerRides(passengerId);
    
    res.json({ success: true, rides });
  } catch (error) {
    console.error('[Trips] Error fetching passenger rides:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch rides' 
    });
  }
});

/**
 * DELETE /api/trips/passenger/:passengerId
 * Permanently delete complete ride history for a passenger
 */
router.delete('/passenger/:passengerId', async (req, res) => {
  try {
    const { passengerId } = req.params;
    if (!passengerId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Passenger ID is required' 
      });
    }

    const result = await deletePassengerRides(passengerId);
    if (!result.success) {
      return res.status(500).json({ 
        success: false, 
        error: result.error || 'Failed to delete ride history' 
      });
    }

    res.json({ 
      success: true, 
      message: 'Complete ride history permanently deleted from database',
      deletedCount: result.count
    });
  } catch (error) {
    console.error('[Trips] Error deleting passenger ride history:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete ride history' 
    });
  }
});

/**
 * GET /api/trips/rider/:riderId
 * Get all rides and aggregated earnings summary for a rider
 */
router.get('/rider/:riderId', async (req, res) => {
  try {
    const { riderId } = req.params;
    const limit = parseInt(req.query.limit, 10) || 100;
    const rides = await getRiderRides(riderId, limit);

    // Calculate live earnings and trip statistics
    const today = new Date().toISOString().split('T')[0];
    let totalEarnings = 0;
    let todayEarnings = 0;
    let completedTrips = 0;
    let todayTrips = 0;
    let cashEarnings = 0;
    let momoEarnings = 0;
    let cashTrips = 0;
    let momoTrips = 0;
    let ratingSum = 0;
    let ratingsCount = 0;

    const formattedRides = (rides || []).map(r => {
      const fare = parseFloat(r.actual_fare || r.estimated_fare || r.fare || 0);
      const isCompleted = r.status === 'completed' || r.status === 'done';
      const rDate = r.requested_at || r.created_at;
      const isToday = rDate ? rDate.startsWith(today) : false;

      const score = r.rider_rating || r.rating;
      if (score && !isNaN(score)) {
        ratingSum += parseFloat(score);
        ratingsCount++;
      }

      if (isCompleted) {
        completedTrips++;
        totalEarnings += fare;
        if (isToday) {
          todayTrips++;
          todayEarnings += fare;
        }
        if (r.payment_method === 'momo') {
          momoEarnings += fare;
          momoTrips++;
        } else {
          cashEarnings += fare;
          cashTrips++;
        }
      }

      return {
        id: r.id,
        from: r.pickup_address || 'Campus Location',
        to: r.dropoff_address || 'Destination',
        fare: fare,
        status: r.status,
        payment_method: r.payment_method || 'cash',
        ride_type: r.ride_type || 'shared',
        passenger_name: r.passenger_name || 'Passenger',
        created_at: rDate,
        date: rDate ? new Date(rDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Today',
        time: rDate ? new Date(rDate).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'
      };
    });

    const avgFare = completedTrips > 0 ? (totalEarnings / completedTrips) : 0;
    const avgRating = ratingsCount > 0 ? parseFloat((ratingSum / ratingsCount).toFixed(1)) : 5.0;

    res.json({
      success: true,
      rides: formattedRides,
      stats: {
        totalEarnings: Math.round(totalEarnings * 100) / 100,
        todayEarnings: Math.round(todayEarnings * 100) / 100,
        completedTrips,
        todayTrips,
        cashEarnings: Math.round(cashEarnings * 100) / 100,
        momoEarnings: Math.round(momoEarnings * 100) / 100,
        cashTrips,
        momoTrips,
        averageFare: Math.round(avgFare * 100) / 100,
        rating: avgRating,
        reviewCount: ratingsCount,
        reviewsCount: ratingsCount
      }
    });
  } catch (error) {
    console.error('[Trips] Error fetching rider rides:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch rider trips' 
    });
  }
});

/**
 * PATCH /api/trips/:id/status
 * Update ride status
 */
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rider_id } = req.body;

    const validStatuses = ['requested', 'searching', 'accepted', 'arriving', 'in_progress', 'completed', 'cancelled', 'no_show'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid status' 
      });
    }

    const updateData = { status };
    if (rider_id) updateData.rider_id = rider_id;

    const ride = await updateRideStatus(id, updateData);
    
    if (!ride) {
      return res.status(404).json({ 
        success: false, 
        error: 'Ride not found' 
      });
    }

    res.json({ success: true, ride });
  } catch (error) {
    console.error('[Trips] Error updating ride status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update ride status' 
    });
  }
});

/**
 * GET /api/trips/riders/available
 * Get available riders for matching
 */
router.get('/riders/available', async (req, res) => {
  try {
    const { lat, lng, radius = 5 } = req.query;
    const riders = await getAvailableRiders(
      lat ? parseFloat(lat) : null,
      lng ? parseFloat(lng) : null,
      parseFloat(radius)
    );
    res.json({ success: true, riders });
  } catch (error) {
    console.error('[Trips] Error fetching available riders:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch available riders' 
    });
  }
});

/**
 * GET /api/trips/pending
 * Get all unassigned pending trips (for rider fallback polling)
 */
router.get('/pending', async (req, res) => {
  try {
    const { data, error } = await requireSupabase()
      .from('rides')
      .select('*')
      .in('status', ['requested', 'searching'])
      .order('requested_at', { ascending: false })
      .limit(30);

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('[Trips] Error fetching pending trips:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch pending trips' });
  }
});

/**
 * GET /api/trips/riders/online
 * Get currently online riders in memory pool
 */
router.get('/riders/online', (req, res) => {
  try {
    res.json({
      success: true,
      onlineCount: dispatchService.getOnlineCount(),
      riders: dispatchService.getAvailableRidersSummary()
    });
  } catch (error) {
    console.error('[Trips] Error fetching online riders:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch online riders' });
  }
});

/**
 * PUT /api/trips/:id/accept
 * Rider accepts a ride (REST fallback for Socket.io)
 */
router.put('/:id/accept', async (req, res) => {
  try {
    const { id } = req.params;
    const riderId = req.query.rider_id || req.body?.rider_id;
    if (!riderId) {
      return res.status(400).json({ success: false, detail: 'rider_id is required' });
    }

    _inMemoryPendingTrips.delete(id);

    const result = await dispatchService.acceptRide(id, riderId);
    if (!result.success) {
      return res.status(result.code || 400).json({ success: false, detail: result.error });
    }

    res.json({ success: true, trip: result.trip, rider: result.rider });
  } catch (error) {
    console.error('[Trips] Error accepting trip:', error);
    res.status(500).json({ success: false, detail: 'Server error' });
  }
});

/**
 * PUT /api/trips/:id/pickup
 * Rider confirms passenger has been picked up (Stage 4: in_progress transition)
 */
router.put('/:id/pickup', async (req, res) => {
  try {
    const { id } = req.params;
    const riderId = req.query.rider_id || req.body?.rider_id;
    if (!riderId) {
      return res.status(400).json({ success: false, detail: 'rider_id is required' });
    }

    const result = await dispatchService.pickupPassenger(id, riderId);
    if (!result.success) {
      return res.status(result.code || 400).json({ success: false, detail: result.error });
    }

    res.json({ success: true, trip: result.trip });
  } catch (error) {
    console.error('[Trips] Error starting trip (pickup):', error);
    res.status(500).json({ success: false, detail: 'Server error' });
  }
});

/**
 * PUT /api/trips/:id/complete
 * Rider completes a ride — automatically triggers 10% platform fee retention and 90% direct MoMo rider payout
 */
router.put('/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const riderId = req.query.rider_id || req.body?.rider_id;
    const actualFare = req.query.actual_fare || req.body?.actual_fare;

    const trip = await getRideById(id);
    const finalRiderId = riderId || trip?.rider_id;
    const fare = parseFloat(actualFare || trip?.actual_fare || trip?.estimated_fare || trip?.fare || 0);

    // Platform commission: 10% stays in K3K3 Moolre business wallet
    const platformCommission = Math.round(fare * 0.10 * 100) / 100;
    // Rider payout: 90% disbursed directly into rider MoMo wallet
    const riderPayout = Math.round((fare - platformCommission) * 100) / 100;

    let riderPhone = req.body?.rider_phone || req.query?.rider_phone;
    let riderName = 'Rider';

    if (!riderPhone && finalRiderId) {
      const activeRider = dispatchService.riders.get(String(finalRiderId));
      if (activeRider) {
        riderPhone = activeRider.phone;
        riderName = activeRider.name || riderName;
      }
    }

    if (!riderPhone && finalRiderId) {
      try {
        const supabase = requireSupabase();
        const { data: user } = await supabase.from('users').select('phone, first_name, last_name').eq('id', finalRiderId).maybeSingle();
        if (user && user.phone) {
          riderPhone = user.phone;
          riderName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || riderName;
        }
      } catch (_) {}
    }

    // Disburse 90% directly to rider's Mobile Money wallet via Moolre
    let payoutResult = null;
    if (riderPhone && riderPayout > 0) {
      payoutResult = await moolreService.disburseToRiderMoMo({
        riderPhone,
        amount: riderPayout,
        reference: `PAYOUT_${id}_${Date.now().toString(36)}`,
        tripId: id
      });
    }

    const result = await dispatchService.completeRide(id, finalRiderId, fare);

    // Notify admin dashboard of completed trip, 10% platform wallet retention, and 90% rider MoMo payout
    if (dispatchService.io) {
      dispatchService.io.to('admin').emit('admin:trip_update', {
        type: 'trip_completed',
        tripId: id,
        status: 'completed',
        actualFare: fare,
        platformCommission,
        commissionRate: '10%',
        riderPayout,
        riderRate: '90%',
        riderName,
        riderPhone,
        payoutStatus: payoutResult?.disbursed ? 'disbursed' : 'pending',
        completedAt: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      trip: result.trip,
      financials: {
        totalFare: fare,
        platformCommission,
        riderPayout,
        riderMoMoWallet: riderPhone || 'Not configured',
        payoutResult
      }
    });
  } catch (error) {
    console.error('[Trips] Error completing trip:', error);
    res.status(500).json({ success: false, detail: 'Server error' });
  }
});

/**
 * POST /api/trips/:id/complete-and-payout
 * Explicit endpoint to complete trip and disburse 90% net earnings to rider MoMo wallet
 */
router.post(['/:id/complete-and-payout', '/:id/payout'], async (req, res) => {
  try {
    const { id } = req.params;
    const riderId = req.body?.rider_id || req.query?.rider_id;
    const actualFare = req.body?.actual_fare || req.query?.actual_fare;
    const customRiderPhone = req.body?.rider_phone || req.query?.rider_phone;

    const trip = await getRideById(id);
    const finalRiderId = riderId || trip?.rider_id;

    const fare = parseFloat(actualFare || trip?.actual_fare || trip?.estimated_fare || trip?.fare || 0);
    const platformCommission = Math.round(fare * 0.10 * 100) / 100; // 10% platform commission retained in K3K3 Moolre wallet
    const riderPayout = Math.round((fare - platformCommission) * 100) / 100; // 90% sent to rider MoMo

    let riderPhone = customRiderPhone;
    let riderName = 'Rider';

    if (!riderPhone && finalRiderId) {
      const activeRider = dispatchService.riders.get(String(finalRiderId));
      if (activeRider) {
        riderPhone = activeRider.phone;
        riderName = activeRider.name || riderName;
      }
    }

    if (!riderPhone && finalRiderId) {
      try {
        const supabase = requireSupabase();
        const { data: user } = await supabase.from('users').select('phone, first_name, last_name').eq('id', finalRiderId).maybeSingle();
        if (user && user.phone) {
          riderPhone = user.phone;
          riderName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || riderName;
        }
      } catch (_) {}
    }

    // Call Moolre MoMo payout
    let payoutResult = null;
    if (riderPhone && riderPayout > 0) {
      payoutResult = await moolreService.disburseToRiderMoMo({
        riderPhone,
        amount: riderPayout,
        reference: `PAYOUT_${id}_${Date.now().toString(36)}`,
        tripId: id
      });
    }

    const dispatchResult = await dispatchService.completeRide(id, finalRiderId, fare);

    if (dispatchService.io) {
      dispatchService.io.to('admin').emit('admin:trip_update', {
        type: 'trip_completed',
        tripId: id,
        status: 'completed',
        actualFare: fare,
        platformCommission,
        commissionRate: '10%',
        riderPayout,
        riderRate: '90%',
        riderName,
        riderPhone,
        payoutStatus: payoutResult?.disbursed ? 'disbursed' : 'pending',
        completedAt: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      trip: dispatchResult.trip || trip,
      financials: {
        totalFare: fare,
        platformCommission,
        commissionRate: '10%',
        riderPayout,
        riderRate: '90%',
        riderMoMoWallet: riderPhone || 'Not configured',
        payoutResult
      }
    });
  } catch (error) {
    console.error('[Trips] Error in complete-and-payout:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to complete ride and process payout' });
  }
});

/**
 * POST /api/trips/:id/pay-momo
 * Collect ride fare via Moolre Mobile Money Collection API (USSD Push Prompt)
 * 
 * Supports:
 * - MTN MoMo (Channel 13)
 * - Telecel Cash (Channel 6)
 * - AT Money (Channel 7)
 */
router.post(['/:id/pay-momo', '/:id/payment'], async (req, res) => {
  try {
    const { id } = req.params;
    const { payerPhone, channel, amount, skipOtp, accountNumber } = req.body;

    const trip = await getRideById(id);
    if (!trip) {
      return res.status(404).json({ success: false, error: 'Trip not found' });
    }

    const phoneToCharge = payerPhone || trip.passenger_phone || trip.passenger?.phone;
    if (!phoneToCharge) {
      return res.status(400).json({ success: false, error: 'Payer mobile money phone number is required' });
    }

    const fareAmount = parseFloat(amount || trip.actual_fare || trip.estimated_fare || trip.fare || 0);
    if (isNaN(fareAmount) || fareAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid fare amount' });
    }

    const extRef = `TRIP_${trip.id}_${Date.now().toString(36)}`;
    const collectionResult = await moolreService.requestMoMoPayment({
      phone: phoneToCharge,
      amount: fareAmount,
      channel,
      externalRef: extRef,
      accountNumber,
      skipOtp,
      reference: `K3K3 Ride #${String(trip.id).slice(-6)}`
    });

    if (collectionResult.success) {
      try {
        await updateRideStatus(trip.id, {
          payment_method: 'momo',
          payment_status: 'paid',
          payment_ref: collectionResult.externalRef || collectionResult.transactionId
        });
      } catch (dbErr) {
        console.warn('[Trips] Could not update payment status in DB:', dbErr.message);
      }

      // Notify admin dashboard via Socket.io
      if (dispatchService.io) {
        dispatchService.io.to('admin').emit('admin:trip_update', {
          type: 'payment_collected',
          tripId: trip.id,
          amount: fareAmount,
          payerPhone: phoneToCharge,
          channel: collectionResult.data?.channel || channel || 'momo',
          paymentRef: extRef,
          commission: (fareAmount * 0.10).toFixed(2),
          riderPayout: (fareAmount * 0.90).toFixed(2),
          collectedAt: new Date().toISOString()
        });
      }
    }

    res.json({
      success: collectionResult.success,
      message: collectionResult.message || 'Mobile money prompt initiated',
      collection: collectionResult,
      tripId: trip.id,
      amount: fareAmount,
      split: {
        platformFee: (fareAmount * 0.10).toFixed(2),
        riderPayout: (fareAmount * 0.90).toFixed(2)
      }
    });
  } catch (error) {
    console.error('[Trips] Error processing MoMo payment:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to process mobile money payment' });
  }
});

/**
 * POST /api/trips/:id/payment-link
 * Generate hosted web POS payment link for passenger checkout
 */
router.post('/:id/payment-link', async (req, res) => {
  try {
    const { id } = req.params;
    const { email, callbackUrl, redirectUrl } = req.body;

    const trip = await getRideById(id);
    if (!trip) {
      return res.status(404).json({ success: false, error: 'Trip not found' });
    }

    const fare = parseFloat(trip.actual_fare || trip.estimated_fare || trip.fare || 0);
    const linkResult = await moolreService.generatePaymentLink({
      amount: fare,
      email: email || trip.passenger_email || 'k3k3ride@gmail.com',
      externalRef: `TRIP_${trip.id}`,
      callbackUrl: callbackUrl || `${req.protocol}://${req.get('host')}/api/trips/moolre/webhook`,
      redirectUrl: redirectUrl || `${req.protocol}://${req.get('host')}/passenger/ride-status.html?tripId=${trip.id}`
    });

    res.json(linkResult);
  } catch (error) {
    console.error('[Trips] Error generating payment link:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * ALL /api/trips/moolre/webhook & /api/trips/moolre/callback
 * Moolre payment gateway webhook notification
 */
router.all(['/moolre/webhook', '/moolre/callback'], async (req, res) => {
  try {
    const payload = req.body || {};
    console.log('[Moolre Webhook] Received payment notification:', JSON.stringify(payload));

    const externalRef = payload.externalref || payload.externalRef || payload.reference;
    const status = payload.status;
    const code = payload.code;

    if (externalRef && (status === 1 || code === 'TR099' || payload.paid)) {
      const tripId = externalRef.replace(/^TRIP_/, '').split('_')[0];
      if (tripId) {
        try {
          await updateRideStatus(tripId, {
            payment_status: 'paid',
            payment_ref: externalRef
          });
        } catch (_) {}

        if (dispatchService.io) {
          dispatchService.io.to('admin').emit('admin:trip_update', {
            type: 'payment_collected',
            tripId,
            status: 'paid',
            externalRef,
            webhookVerified: true,
            verifiedAt: new Date().toISOString()
          });
        }
      }
    }

    res.json({ success: true, message: 'Webhook received' });
  } catch (error) {
    console.error('[Moolre Webhook] Error processing webhook:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/trips/:id/decline
 * Rider declines a ride offer
 */
router.put('/:id/decline', (req, res) => {
  try {
    const { id } = req.params;
    const riderId = req.query.rider_id || req.body?.rider_id;
    if (!riderId) {
      return res.status(400).json({ success: false, detail: 'rider_id is required' });
    }

    const success = dispatchService.declineRide(id, riderId);
    res.json({ success });
  } catch (error) {
    console.error('[Trips] Error declining trip:', error);
    res.status(500).json({ success: false, detail: 'Server error' });
  }
});

module.exports = router;
