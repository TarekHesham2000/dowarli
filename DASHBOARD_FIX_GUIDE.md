# Dashboard Data Issue - Complete Fix Guide

## Problem Summary
The dashboard is not showing any properties even though data exists in the database. The issue is likely related to:
1. `owner_id` mismatch between `properties.owner_id` and `auth.users.id`
2. Row Level Security (RLS) policies blocking data access
3. Incorrect data relationships

## Step 1: Debug the Issue

### Run the Debug Version
1. Replace your current `page.tsx` with `page-fixed.tsx`
2. This version includes comprehensive debugging logs
3. Check browser console for debug information

### Check Console Logs
Look for these debug outputs:
- `=== DEBUG INFO ===`
- Auth user ID vs Profile ID
- All properties vs Filtered properties
- Matching properties count

## Step 2: Database Investigation

### Run SQL Queries
Execute the queries in `debug-dashboard.sql` in your Supabase SQL Editor:

```sql
-- Check all properties and their owner_id
SELECT id, title, owner_id, created_at FROM properties ORDER BY created_at DESC;

-- Check profiles table
SELECT id, name, email FROM profiles ORDER BY created_at DESC;

-- Find mismatched owner_id
SELECT p.id, p.title, p.owner_id, pr.id as profile_id, pr.name
FROM properties p 
LEFT JOIN profiles pr ON p.owner_id = pr.id
WHERE pr.id IS NULL;
```

## Step 3: Common Issues & Solutions

### Issue 1: owner_id uses profile.id instead of auth.users.id
**Problem**: Properties were created with `profiles.id` but query uses `auth.users.id`

**Solution**: Update the query to use profile ID:
```typescript
// Get the profile first
const { data: profile } = await supabase
  .from('profiles')
  .select('id')
  .eq('id', user.id)
  .single()

// Then use profile.id for properties
const { data: props } = await supabase
  .from('properties')
  .select('*, profiles(name, phone, id)')
  .eq('owner_id', profile.id)
```

### Issue 2: RLS Policy Blocking Access
**Problem**: Row Level Security policy doesn't allow users to see their own properties

**Solution**: Create/Update RLS Policy:
```sql
-- Drop existing policy
DROP POLICY IF EXISTS "Users can view their own properties" ON properties;

-- Create new policy
CREATE POLICY "Users can view their own properties" ON properties
  FOR SELECT USING (auth.uid() = owner_id);

-- For inserts
CREATE POLICY "Users can insert their own properties" ON properties
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- For updates
CREATE POLICY "Users can update their own properties" ON properties
  FOR UPDATE USING (auth.uid() = owner_id);
```

### Issue 3: owner_id is NULL or Empty
**Problem**: Properties exist but `owner_id` is NULL

**Solution**: Update properties with correct owner_id:
```sql
-- First, find the correct user ID
SELECT id, email FROM auth.users WHERE email = 'user@example.com';

-- Then update properties
UPDATE properties 
SET owner_id = 'correct-user-id-here' 
WHERE owner_id IS NULL;
```

## Step 4: Production-Ready Solution

### Option A: Fix Data (Recommended)
1. Update all `properties.owner_id` to use correct `auth.users.id`
2. Ensure RLS policies are properly configured
3. Use the original query structure

### Option B: Fix Query Logic
1. Always query through profiles table
2. Use profile ID for property filtering
3. Maintain data consistency

### Final Query Structure:
```typescript
const loadDashboard = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, wallet_balance, is_active, phone')
    .eq('id', user.id)
    .single()

  // Get properties using profile ID
  const { data: properties } = await supabase
    .from('properties')
    .select(`
      id, title, area, price, status, created_at,
      rejection_reason, description, address, images, unit_type,
      owner_id
    `)
    .eq('owner_id', user.id) // or profile.id if different
    .order('created_at', { ascending: false })

  // Rest of the logic...
}
```

## Step 5: Verify Fix

1. Clear browser cache
2. Log out and log back in
3. Check console for any errors
4. Verify properties appear in dashboard
5. Test property creation and editing

## Additional Checks

### RLS Status
```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'properties';

-- Check existing policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'properties';
```

### Data Integrity
```sql
-- Check for orphaned properties
SELECT COUNT(*) as orphaned_properties
FROM properties p
LEFT JOIN auth.users u ON p.owner_id = u.id::text
WHERE u.id IS NULL;

-- Check for duplicate properties
SELECT owner_id, COUNT(*) as property_count
FROM properties
GROUP BY owner_id
HAVING COUNT(*) > 1;
```

## Quick Fix Commands

If you need to quickly test, temporarily disable RLS:
```sql
ALTER TABLE properties DISABLE ROW LEVEL SECURITY;
```

⚠️ **Remember to re-enable RLS after testing!**
```sql
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
```

## Support

If you're still experiencing issues:
1. Check browser console for specific error messages
2. Verify Supabase connection and authentication
3. Ensure all required columns exist in tables
4. Test with a fresh user account
