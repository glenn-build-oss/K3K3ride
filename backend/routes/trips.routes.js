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

  return inBoundingBox || distKm <= 35;
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
    if (!passenger_id || !pickup_label || !dest_label || !fare_estimate) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: passenger_id, pickup_label, dest_label, fare_estimate' 
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

    const rideData = {
      passenger_id,
      pickup_address: pickup_label,
      pickup_latitude: pickup_lat,
      pickup_longitude: pickup_lng,
      dropoff_address: dest_label,
      dropoff_latitude: dest_lat,
      dropoff_longitude: dest_lng,
      estimated_fare: fare_estimate,
      ride_type: ride_type || 'shared',
      payment_method: payment_method || 'cash',
      status: 'requested'
    };

    const ride = await createRide(rideData);
    
    if (ride) {
      // Trigger real-time dispatch engine
      dispatchService.dispatchRide(ride).catch(err => {
        console.error('[Trips] Dispatch error:', err);
      });
    }

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
    const { data, error } = await supabase
      .from('rides')
      .select('*')
      .in('status', ['requested', 'searching'])
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      return res.json({ success: true, trips: [] });
    }
    res.json({ success: true, trips: data || [] });
  } catch (error) {
    res.json({ success: true, trips: [] });
  }
});

/**
 * GET /api/trips/:id
 * Get ride details by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const ride = await getRideById(id);
    
    if (!ride) {
      return res.status(404).json({ 
        success: false, 
        error: 'Ride not found' 
      });
    }

    res.json({ success: true, ride });
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

    const formattedRides = (rides || []).map(r => {
      const fare = parseFloat(r.actual_fare || r.estimated_fare || r.fare || 0);
      const isCompleted = r.status === 'completed' || r.status === 'done';
      const rDate = r.requested_at || r.created_at;
      const isToday = rDate ? rDate.startsWith(today) : false;

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
        averageFare: Math.round(avgFare * 100) / 100
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
 * PUT /api/trips/:id/complete
 * Rider completes a ride
 */
router.put('/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const riderId = req.query.rider_id || req.body?.rider_id;
    const actualFare = req.query.actual_fare || req.body?.actual_fare;

    const result = await dispatchService.completeRide(id, riderId, actualFare);
    res.json({ success: true, trip: result.trip });
  } catch (error) {
    console.error('[Trips] Error completing trip:', error);
    res.status(500).json({ success: false, detail: 'Server error' });
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
