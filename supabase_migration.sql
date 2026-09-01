-- ============================================
-- MIGRATION: Allow same phone for multiple roles
-- ============================================
-- Run this in your Supabase SQL Editor to update existing database

-- Step 1: Drop the unique constraint on phone
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_phone_key;

-- Step 2: Add composite unique constraint on phone + role
-- This allows same phone for different roles, but prevents duplicate phone+role
ALTER TABLE users ADD CONSTRAINT users_phone_role_key UNIQUE (phone, role);

-- Step 3: Verify the change
SELECT 
    constraint_name, 
    constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'users';
