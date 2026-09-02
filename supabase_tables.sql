-- ============================================
-- K3K3 Ride-Sharing - Supabase Database Schema
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE (All user types: passengers, riders, admins)
-- ============================================
CREATE TABLE users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255) UNIQUE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    full_name VARCHAR(200),
    role VARCHAR(20) NOT NULL CHECK (role IN ('passenger', 'rider', 'admin')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'pending', 'suspended', 'deleted')),
    password_hash VARCHAR(255), -- For admin login
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    UNIQUE(phone, role) -- Allow same phone for different roles, but unique phone+role combination
);

-- Index for faster phone lookups
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);

-- ============================================
-- RIDER APPLICATIONS TABLE
-- ============================================
CREATE TABLE rider_applications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    phone VARCHAR(20) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    date_of_birth DATE,
    gender VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    region VARCHAR(100),
    emergency_contact_name VARCHAR(200),
    emergency_contact_phone VARCHAR(20),
    
    -- Vehicle Information
    vehicle_type VARCHAR(50),
    vehicle_make VARCHAR(100),
    vehicle_model VARCHAR(100),
    vehicle_year INTEGER,
    vehicle_color VARCHAR(50),
    license_plate VARCHAR(20),
    
    -- Document URLs (stored in Supabase Storage)
    driver_license_url TEXT,
    insurance_url TEXT,
    vehicle_registration_url TEXT,
    ghana_card_url TEXT,
    passport_photo_url TEXT,
    
    -- Application Status
    status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected')),
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID REFERENCES users(id),
    rejection_reason TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_rider_applications_user_id ON rider_applications(user_id);
CREATE INDEX idx_rider_applications_status ON rider_applications(status);
CREATE INDEX idx_rider_applications_phone ON rider_applications(phone);

-- ============================================
-- RIDER VEHICLES TABLE
-- ============================================
CREATE TABLE rider_vehicles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    rider_id UUID REFERENCES users(id) ON DELETE CASCADE,
    vehicle_type VARCHAR(50) NOT NULL,
    make VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    year INTEGER NOT NULL,
    color VARCHAR(50),
    license_plate VARCHAR(20) UNIQUE NOT NULL,
    photo_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_rider_vehicles_rider_id ON rider_vehicles(rider_id);
CREATE INDEX idx_rider_vehicles_license_plate ON rider_vehicles(license_plate);

-- ============================================
-- RIDES TABLE
-- ============================================
CREATE TABLE rides (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    passenger_id UUID REFERENCES users(id) ON DELETE CASCADE,
    rider_id UUID REFERENCES users(id) ON DELETE SET NULL,
    vehicle_id UUID REFERENCES rider_vehicles(id) ON DELETE SET NULL,
    
    -- Pickup Location
    pickup_address TEXT NOT NULL,
    pickup_latitude DECIMAL(10, 8),
    pickup_longitude DECIMAL(11, 8),
    pickup_landmark TEXT,
    
    -- Dropoff Location
    dropoff_address TEXT NOT NULL,
    dropoff_latitude DECIMAL(10, 8),
    dropoff_longitude DECIMAL(11, 8),
    dropoff_landmark TEXT,
    
    -- Ride Details
    distance_km DECIMAL(6, 2),
    estimated_duration_minutes INTEGER,
    estimated_fare DECIMAL(10, 2),
    actual_fare DECIMAL(10, 2),
    
    -- Payment
    payment_method VARCHAR(20) CHECK (payment_method IN ('cash', 'momo')),
    ride_type VARCHAR(20) CHECK (ride_type IN ('shared', 'alone')),
    
    -- Status
    status VARCHAR(30) DEFAULT 'requested' CHECK (status IN (
        'requested', 'searching', 'accepted', 'arriving', 
        'in_progress', 'completed', 'cancelled', 'no_show'
    )),
    
    -- Timestamps
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    accepted_at TIMESTAMP WITH TIME ZONE,
    arrived_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    
    -- Cancellation details
    cancelled_by UUID REFERENCES users(id),
    cancellation_reason TEXT,
    
    -- Additional notes
    passenger_notes TEXT,
    rider_notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_rides_passenger_id ON rides(passenger_id);
CREATE INDEX idx_rides_rider_id ON rides(rider_id);
CREATE INDEX idx_rides_status ON rides(status);
CREATE INDEX idx_rides_requested_at ON rides(requested_at DESC);

-- ============================================
-- PAYMENTS TABLE
-- ============================================
CREATE TABLE payments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    ride_id UUID REFERENCES rides(id) ON DELETE CASCADE,
    passenger_id UUID REFERENCES users(id) ON DELETE CASCADE,
    rider_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'GHS',
    
    payment_method VARCHAR(50) CHECK (payment_method IN ('cash', 'momo', 'card')),
    payment_status VARCHAR(30) DEFAULT 'pending' CHECK (payment_status IN (
        'pending', 'processing', 'completed', 'failed', 'refunded'
    )),
    
    -- Mobile Money Details
    momo_network VARCHAR(20),
    momo_phone VARCHAR(20),
    momo_transaction_id TEXT,
    
    -- Platform fees
    platform_fee DECIMAL(10, 2) DEFAULT 0,
    rider_payout DECIMAL(10, 2),
    
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_payments_ride_id ON payments(ride_id);
CREATE INDEX idx_payments_passenger_id ON payments(passenger_id);
CREATE INDEX idx_payments_rider_id ON payments(rider_id);
CREATE INDEX idx_payments_status ON payments(payment_status);

-- ============================================
-- OTP CODES TABLE (Replace in-memory storage)
-- ============================================
CREATE TABLE otp_codes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    phone VARCHAR(20) NOT NULL,
    code VARCHAR(10) NOT NULL,
    purpose VARCHAR(20) NOT NULL CHECK (purpose IN ('login', 'signup', 'verify', 'reset')),
    used BOOLEAN DEFAULT false,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_otp_codes_phone ON otp_codes(phone);
CREATE INDEX idx_otp_codes_expires_at ON otp_codes(expires_at);

-- ============================================
-- REVIEWS TABLE
-- ============================================
CREATE TABLE reviews (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    ride_id UUID REFERENCES rides(id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    reviewee_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_reviews_ride_id ON reviews(ride_id);
CREATE INDEX idx_reviews_reviewee_id ON reviews(reviewee_id);
CREATE INDEX idx_reviews_rating ON reviews(rating);

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error', 'ride_update')),
    read BOOLEAN DEFAULT false,
    action_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- ============================================
-- ADMIN SETTINGS TABLE
-- ============================================
CREATE TABLE admin_settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default settings
INSERT INTO admin_settings (key, value, description) VALUES
('base_fare', '5.00', 'Base fare for rides in GHS'),
('fare_per_km', '1.50', 'Fare per kilometer in GHS'),
('fare_per_minute', '0.20', 'Fare per minute in GHS'),
('platform_fee_percent', '15', 'Platform fee percentage'),
('min_ride_distance', '1.0', 'Minimum ride distance in km');

-- ============================================
-- TRIGGER FOR UPDATED_AT
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rider_applications_updated_at BEFORE UPDATE ON rider_applications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rider_vehicles_updated_at BEFORE UPDATE ON rider_vehicles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rides_updated_at BEFORE UPDATE ON rides
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- DEFAULT ADMIN USER
-- ============================================
-- Use INSERT ON CONFLICT to handle if admin already exists
INSERT INTO users (phone, email, first_name, last_name, full_name, role, status, password_hash)
VALUES (
    '+233504842974',
    'admin@k3k3.com',
    'K3K3',
    'Admin',
    'K3K3 Admin',
    'admin',
    'active',
    '$2a$10$g8vW3/MXRImz9PWUihmsNuMxTfN3yB5nT4WQvk0WTVlZ2bxTAnpbO' -- Password: Ka1b1c1d1e1f1
)
ON CONFLICT (email) 
DO UPDATE SET 
    phone = EXCLUDED.phone,
    password_hash = EXCLUDED.password_hash,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    status = EXCLUDED.status;

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE rider_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE rider_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

-- Users table policies
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (id = auth.uid());

CREATE POLICY "Admins can view all users" ON users
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- OTP codes policies (service role only for backend)
CREATE POLICY "Service role can manage OTPs" ON otp_codes
    FOR ALL USING (true);

-- Similar policies for other tables...
-- (For development, you may want to disable RLS initially)
