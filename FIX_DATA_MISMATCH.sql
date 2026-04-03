-- =====================================================
-- DATA MISMATCH FIX SCRIPTS
-- =====================================================

-- Step 1: Identify the issue
-- Check if properties.owner_id matches auth.users.id or profiles.id

SELECT 
  p.id as property_id,
  p.title,
  p.owner_id as property_owner_id,
  au.id as auth_user_id,
  au.email as auth_email,
  pr.id as profile_id,
  pr.email as profile_email
FROM properties p
LEFT JOIN auth.users au ON p.owner_id = au.id::text
LEFT JOIN profiles pr ON p.owner_id = pr.id
ORDER BY p.created_at DESC;

-- Step 2: Find properties with mismatched owner_id
SELECT 
  p.id as property_id,
  p.title,
  p.owner_id as current_owner_id,
  CASE 
    WHEN au.id IS NOT NULL THEN 'MATCHES_AUTH_USERS'
    WHEN pr.id IS NOT NULL THEN 'MATCHES_PROFILES'
    ELSE 'NO_MATCH'
  END as owner_type
FROM properties p
LEFT JOIN auth.users au ON p.owner_id = au.id::text
LEFT JOIN profiles pr ON p.owner_id = pr.id
WHERE au.id IS NULL AND pr.id IS NULL;

-- =====================================================
-- FIX OPTION A: Update owner_id to match auth.users.id
-- =====================================================

-- First, get mapping of emails to user IDs
CREATE TEMPORARY TABLE user_email_mapping AS
SELECT 
  au.id as auth_user_id,
  au.email,
  pr.id as profile_id
FROM auth.users au
LEFT JOIN profiles pr ON au.email = pr.email;

-- Update properties where owner_id should be auth_user_id
UPDATE properties p
SET owner_id = uem.auth_user_id
FROM user_email_mapping uem
WHERE p.owner_id = uem.profile_id;

-- =====================================================
-- FIX OPTION B: If profiles.id should be used instead
-- =====================================================

-- Get all users and their profiles
SELECT 
  au.id as auth_user_id,
  au.email as auth_email,
  pr.id as profile_id,
  pr.email as profile_email
FROM auth.users au
JOIN profiles pr ON au.email = pr.email OR au.id = pr.id;

-- Update properties to use profile_id if that's the correct approach
-- (Uncomment and run if profile.id is the correct reference)

/*
UPDATE properties p
SET owner_id = pr.id
FROM auth.users au
JOIN profiles pr ON au.email = pr.email
WHERE p.owner_id = au.id::text AND pr.id IS NOT NULL;
*/

-- =====================================================
-- FIX OPTION C: Assign orphaned properties to users
-- =====================================================

-- Find properties with NULL or invalid owner_id
SELECT 
  id,
  title,
  owner_id,
  created_at
FROM properties
WHERE owner_id IS NULL 
   OR owner_id = ''
   OR owner_id NOT IN (SELECT id::text FROM auth.users)
   AND owner_id NOT IN (SELECT id FROM profiles);

-- If you have a specific user that should own orphaned properties:
-- UPDATE properties 
-- SET owner_id = 'your-user-id-here' 
-- WHERE owner_id IS NULL OR owner_id = '';

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check final state
SELECT 
  COUNT(*) as total_properties,
  COUNT(CASE WHEN owner_id IN (SELECT id::text FROM auth.users) THEN 1 END) as valid_auth_refs,
  COUNT(CASE WHEN owner_id IN (SELECT id FROM profiles) THEN 1 END) as valid_profile_refs,
  COUNT(CASE WHEN owner_id NOT IN (SELECT id::text FROM auth.users) 
              AND owner_id NOT IN (SELECT id FROM profiles) THEN 1 END) as invalid_refs
FROM properties;

-- Check specific user's properties
-- Replace 'user-email@example.com' with actual email
SELECT 
  p.id,
  p.title,
  p.owner_id,
  au.email as user_email
FROM properties p
JOIN auth.users au ON p.owner_id = au.id::text
WHERE au.email = 'user-email@example.com';
