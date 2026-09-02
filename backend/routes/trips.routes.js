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
  getPassengerRides, 
  updateRideStatus,
  getAvailableRiders
} = require('../services/supabase.service');

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

module.exports = router;
