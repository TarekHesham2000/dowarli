-- =====================================================
-- RLS POLICIES FIX FOR PROPERTIES TABLE
-- =====================================================

-- Step 1: Check if RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'properties';

-- Step 2: Enable RLS if not enabled
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

-- Step 3: Drop existing policies (if any)
DROP POLICY IF EXISTS "Users can view their own properties" ON properties;
DROP POLICY IF EXISTS "Users can insert their own properties" ON properties;
DROP POLICY IF EXISTS "Users can update their own properties" ON properties;
DROP POLICY IF EXISTS "Users can delete their own properties" ON properties;

-- Step 4: Create secure policies for authenticated users
CREATE POLICY "Users can view their own properties" 
ON properties 
FOR SELECT 
USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert their own properties" 
ON properties 
FOR INSERT 
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own properties" 
ON properties 
FOR UPDATE 
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own properties" 
ON properties 
FOR DELETE 
USING (auth.uid() = owner_id);

-- Step 5: Verify policies are created
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
WHERE tablename = 'properties'
ORDER BY policyname;

-- =====================================================
-- DEBUG POLICY (TEMPORARY - REMOVE AFTER DEBUGGING)
-- =====================================================

-- Uncomment this line ONLY for debugging to allow all reads
-- CREATE POLICY "debug_select_all" ON properties FOR SELECT USING (true);

-- =====================================================
-- PROFILES TABLE RLS (if needed)
-- =====================================================

-- Enable RLS on profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Create policies for profiles
CREATE POLICY "Users can view own profile" 
ON profiles 
FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
ON profiles 
FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
