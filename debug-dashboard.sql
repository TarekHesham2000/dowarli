-- DEBUGGING SQL QUERIES FOR DASHBOARD ISSUE
-- Run these queries in Supabase SQL Editor to debug the data issue

-- 1. Check all properties in the database
SELECT 
  id,
  title,
  owner_id,
  created_at,
  status
FROM properties 
ORDER BY created_at DESC;

-- 2. Check all users in auth.users (if you have access)
-- Note: This might not work directly, but you can check profiles table instead
SELECT 
  id,
  name,
  email,
  created_at
FROM profiles
ORDER BY created_at DESC;

-- 3. Check if owner_id values match any profile IDs
SELECT 
  p.id as property_id,
  p.title,
  p.owner_id as property_owner_id,
  pr.id as profile_id,
  pr.name as profile_name,
  pr.email
FROM properties p
LEFT JOIN profiles pr ON p.owner_id = pr.id
ORDER BY p.created_at DESC;

-- 4. Find properties with missing/invalid owner_id
SELECT 
  id,
  title,
  owner_id,
  status
FROM properties 
WHERE owner_id IS NULL 
   OR owner_id = ''
   OR owner_id NOT IN (SELECT id FROM profiles);

-- 5. Check RLS policies on properties table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'properties';

-- 6. Sample fix: Update owner_id if needed (example)
-- WARNING: Only run this if you're sure about the mapping!
-- UPDATE properties 
-- SET owner_id = 'your-correct-user-id' 
-- WHERE id = your-property-id;
