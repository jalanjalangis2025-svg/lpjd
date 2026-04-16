-- SQL Fix for potential constraint issues in road_reports
-- Run this in your Supabase SQL Editor if you have trouble updating certain rows.

-- 1. Ensure 'status' is never NULL and follows constraints
UPDATE road_reports 
SET status = 'pending' 
WHERE status IS NULL;

-- 2. Ensure 'report_source' is never NULL and follows constraints
UPDATE road_reports 
SET report_source = 'public' 
WHERE report_source IS NULL;

-- 3. (Optional) Force 'created_at' to be a valid timestamp if needed
-- UPDATE road_reports SET created_at = NOW() WHERE created_at IS NULL;
