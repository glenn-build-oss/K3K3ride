# K3K3 Admin Dashboard - API Integration Guide

## Overview
The K3K3 Admin Dashboard is now **ready for real data integration**. The dashboard automatically connects to your backend API and falls back to mock data if the API is unavailable.

## API Endpoints Required

### Base URL
```
/api/v1
```

### Authentication
All API requests require Bearer token authentication:
```javascript
Authorization: Bearer <token>
```

### Required Endpoints

#### 1. Dashboard Stats
```
GET /api/v1/dashboard/stats?period={today|week|month|year}
```

**Response:**
```json
{
  "activeRides": 12,
  "completedRides": 45,
  "avgDuration": "18m",
  "totalRevenue": 2850.75,
  "totalTrips": 32,
  "totalCustomers": 1200,
  "totalDrivers": 150
}
```

#### 2. Recent Trips
```
GET /api/v1/trips/recent?limit=10
```

**Response:**
```json
[
  {
    "id": "K3T-20241216-000001",
    "riderName": "Kwame Asante",
    "driverName": "Kofi Osei",
    "pickup": "Accra Mall",
    "dropoff": "Kotoka Airport",
    "vehicleType": "car",
    "fare": 45.50,
    "duration": "12m",
    "status": "active",
    "startTime": "2024-12-16T10:30:00Z",
    "distance": 8.5
  }
]
```

#### 3. Live Vehicles
```
GET /api/v1/vehicles/live
```

**Response:**
```json
{
  "vehicles": [
    {
      "id": "K3V-1001",
      "position": {
        "lat": 25,
        "lng": 40
      },
      "status": "active",
      "type": "car",
      "driverName": "Kofi Osei"
    }
  ]
}
```

#### 4. Active Rides (Monitoring)
```
GET /api/v1/rides/active
```

#### 5. Monitoring Stats
```
GET /api/v1/monitoring/stats
```

#### 6. Analytics
```
GET /api/v1/analytics/overview?period={today|week|month|year}
GET /api/v1/analytics/realtime
```

#### 7. Rider Management
```
POST /api/v1/riders
GET /api/v1/riders/{id}
```

#### 8. Ride Management
```
PATCH /api/v1/rides/{id}/status
POST /api/v1/rides/{id}/assign
POST /api/v1/rides/{id}/cancel
GET /api/v1/rides/{id}
```

#### 9. Reports Export
```
GET /api/v1/reports/export?format={csv|pdf|json|txt}&period={today|week|month|year}
```

## Real-time Updates

### WebSocket Connection
```
WS /api/v1/ws/monitoring
```

**Message Format:**
```json
{
  "type": "vehicle_update|ride_update|new_ride|stats_update",
  "payload": { ... }
}
```

## Frontend Integration

### 1. Authentication
The dashboard expects authentication tokens in:
- `localStorage.getItem('k3k3_admin_token')`
- `sessionStorage.getItem('k3k3_admin_token')`

### 2. Auto-refresh
- Dashboard: Every 30 seconds
- Live Monitoring: Every 15 seconds
- WebSocket: Real-time updates

### 3. Error Handling
- Automatic fallback to mock data if API fails
- User notifications for all operations
- Console logging for debugging

## Quick Setup

### Step 1: Implement API Endpoints
Create the required API endpoints in your backend following the specifications above.

### Step 2: Configure Authentication
Implement JWT or session-based authentication and return tokens on login.

### Step 3: Set Up WebSocket (Optional)
For real-time updates, implement WebSocket server at `/api/v1/ws/monitoring`.

### Step 4: Test Integration
1. Open dashboard: `http://localhost:5500/public/admin/dashboard.html`
2. Open monitoring: `http://localhost:5500/public/admin/ride-monitoring.html`
3. Check browser console for API calls
4. Verify real data appears

## Features Ready for Real Data

### Dashboard
- ✅ Real-time statistics
- ✅ Interactive metrics with period filtering
- ✅ Recent trips with details
- ✅ Live map with vehicle positions
- ✅ Export reports (CSV, PDF, JSON, TXT)
- ✅ Rider creation form
- ✅ Auto-refresh every 30 seconds

### Live Monitoring
- ✅ Real-time ride tracking
- ✅ Live vehicle positions
- ✅ Uber-style professional map
- ✅ Interactive controls (Satellite, 3D, Traffic, etc.)
- ✅ Ride status management
- ✅ Driver assignment
- ✅ WebSocket real-time updates
- ✅ Auto-refresh every 15 seconds

## Error Handling

The dashboard includes comprehensive error handling:
- Network failures → Fallback to mock data
- API errors → User notifications
- Authentication errors → Redirect to login
- WebSocket disconnection → Auto-reconnect

## Performance Optimizations

- Parallel API calls for faster loading
- Tab visibility detection to pause updates
- Efficient DOM updates
- Debounced user interactions
- Optimized animations

The dashboard is **production-ready** and will seamlessly work with your real backend API! 🚀


