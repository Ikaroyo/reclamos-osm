-- Enable RLS
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret';

-- Create profiles table for user roles
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create distributors table
CREATE TABLE distributors (
  id SERIAL PRIMARY KEY,
  calle TEXT NOT NULL,
  repartidor TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create complaints table
CREATE TABLE complaints (
  id SERIAL PRIMARY KEY,
  mes INTEGER NOT NULL,
  año INTEGER NOT NULL,
  cuenta TEXT NOT NULL,
  calle TEXT NOT NULL,
  numero TEXT NOT NULL,
  repartidor TEXT NOT NULL,
  observaciones TEXT,
  entregar BOOLEAN DEFAULT FALSE,
  emitido BOOLEAN DEFAULT FALSE,
  enviar_por_mail BOOLEAN DEFAULT FALSE,
  mail TEXT,
  telefono TEXT,
  tomado_por TEXT,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Insert initial distributor data
INSERT INTO distributors (calle, repartidor) VALUES
('Rafael Cortez', 'Mariela'),
('Salta', 'Mariela'),


-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE distributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;

-- Create functions for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers
CREATE TRIGGER update_profiles_updated_at 
    BEFORE UPDATE ON profiles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_distributors_updated_at 
    BEFORE UPDATE ON distributors 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_complaints_updated_at 
    BEFORE UPDATE ON complaints 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Drop existing problematic policies if they exist
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can create profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;

-- Create simple policies for profiles that avoid infinite recursion
CREATE POLICY "Allow authenticated users to read profiles" 
ON profiles FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Allow service role to manage profiles" 
ON profiles FOR ALL 
USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own profile" 
ON profiles FOR SELECT 
USING (auth.uid() = id);

-- Create policies for distributors
CREATE POLICY "Users can view all distributors" ON distributors FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can insert distributors" ON distributors FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "Admins can update distributors" ON distributors FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "Admins can delete distributors" ON distributors FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- Create policies for complaints
CREATE POLICY "Users can view own complaints or admins can view all" ON complaints FOR SELECT USING (
  auth.uid() = user_id OR 
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

CREATE POLICY "Users can insert own complaints" ON complaints FOR INSERT WITH CHECK (
  auth.uid() = user_id
);

CREATE POLICY "Users can update own complaints or admins can update all" ON complaints FOR UPDATE USING (
  auth.uid() = user_id OR 
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

CREATE POLICY "Users can delete own complaints or admins can delete all" ON complaints FOR DELETE USING (
  auth.uid() = user_id OR 
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- Drop and recreate the user creation trigger with better error handling
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Enhanced function to handle new user profile creation with better handling of admin-created users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    admin_emails text[] := ARRAY['email1@gmail.com', 'email2@gmail.com'];
    is_admin_user boolean := false;
    retry_count integer := 0;
    max_retries integer := 3;
    is_created_by_admin boolean := false;
BEGIN
    -- Check if user was created by admin
    IF NEW.raw_user_meta_data->>'created_by_admin' = 'true' OR 
       NEW.raw_user_meta_data->>'force_password_change' = 'true' THEN
        is_created_by_admin := true;
    END IF;

    -- Check if the email is in the admin list (only for manually added admins or existing admins, not new users created by admin)
    IF NEW.email = ANY(admin_emails) AND NOT is_created_by_admin THEN
        is_admin_user := true;
    END IF;

    -- Try to insert the profile with retries
    WHILE retry_count < max_retries LOOP
        BEGIN
            INSERT INTO public.profiles (id, email, is_admin, created_at, updated_at)
            VALUES (
                NEW.id, 
                NEW.email, 
                is_admin_user,  -- Will be false for admin-created users
                NOW(),
                NOW()
            );
            
            -- If we get here, the insert was successful
            RAISE NOTICE 'Profile created successfully for user % on attempt % (admin: %)', NEW.email, retry_count + 1, is_admin_user;
            RETURN NEW;
            
        EXCEPTION
            WHEN unique_violation THEN
                -- Profile already exists, this is fine
                RAISE NOTICE 'Profile already exists for user %', NEW.email;
                RETURN NEW;
            WHEN OTHERS THEN
                retry_count := retry_count + 1;
                RAISE WARNING 'Attempt % failed to create profile for user %: %. Retrying...', retry_count, NEW.email, SQLERRM;
                
                IF retry_count >= max_retries THEN
                    -- Last attempt failed, log error but don't fail user creation
                    RAISE WARNING 'Failed to create profile for user % after % attempts: %', NEW.email, max_retries, SQLERRM;
                    RETURN NEW;
                END IF;
                
                -- Small delay before retry
                PERFORM pg_sleep(0.1);
        END;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add a fallback policy for profile creation that works even if RLS fails
CREATE OR REPLACE POLICY "Allow profile creation for new users" 
ON profiles FOR INSERT 
WITH CHECK (
    -- Allow if it's the trigger creating the profile
    current_setting('application_name', true) LIKE '%trigger%' OR
    -- Allow if it's a service role
    auth.role() = 'service_role' OR
    -- Allow if it's the user creating their own profile
    auth.uid() = id OR
    -- Allow any authenticated user to create a profile (fallback)
    auth.role() = 'authenticated'
);

-- Create a function that users can call to create their own profile if it doesn't exist
CREATE OR REPLACE FUNCTION public.ensure_user_profile()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_id uuid;
    current_user_email text;
    admin_emails text[] := ARRAY['email1@gmail.com', 'email2@gmail.com'];
    is_admin_user boolean := false;
BEGIN
    -- Get current user info
    SELECT auth.uid() INTO current_user_id;
    SELECT auth.email() INTO current_user_email;
    
    IF current_user_id IS NULL OR current_user_email IS NULL THEN
        RETURN false;
    END IF;
    
    -- Check if profile already exists
    IF EXISTS (SELECT 1 FROM profiles WHERE id = current_user_id) THEN
        RETURN true;
    END IF;
    
    -- Check if user should be admin
    IF current_user_email = ANY(admin_emails) THEN
        is_admin_user := true;
    END IF;
    
    -- Create the profile
    INSERT INTO public.profiles (id, email, is_admin, created_at, updated_at)
    VALUES (
        current_user_id,
        current_user_email,
        is_admin_user,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO NOTHING;
    
    RETURN true;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to ensure profile for user %: %', current_user_email, SQLERRM;
        RETURN false;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.ensure_user_profile() TO authenticated;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_admin_status(text) TO authenticated;

-- Function to get admin status by user ID
CREATE OR REPLACE FUNCTION get_user_admin_status_by_id(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    is_admin_result boolean := false;
BEGIN
    SELECT COALESCE(is_admin, false) INTO is_admin_result
    FROM profiles
    WHERE id = user_id
    LIMIT 1;
    
    RETURN COALESCE(is_admin_result, false);
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_user_admin_status_by_id(uuid) TO authenticated;

-- Function to get all users (admin only)
CREATE OR REPLACE FUNCTION get_all_users_admin()
RETURNS TABLE (
    id UUID,
    email TEXT,
    is_admin BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if current user is admin
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    ) THEN
        RAISE EXCEPTION 'Access denied: Admin privileges required';
    END IF;
    
    RETURN QUERY
    SELECT p.id, p.email, p.is_admin, p.created_at, p.updated_at
    FROM profiles p
    ORDER BY p.created_at DESC;
END;
$$;

-- Function to update admin status
CREATE OR REPLACE FUNCTION update_user_admin_status(target_user_id UUID, new_admin_status BOOLEAN)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if current user is admin
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    ) THEN
        RAISE EXCEPTION 'Access denied: Admin privileges required';
    END IF;
    
    -- Prevent user from modifying their own admin status
    IF target_user_id = auth.uid() THEN
        RAISE EXCEPTION 'Cannot modify your own admin status';
    END IF;
    
    -- Update the user
    UPDATE profiles 
    SET is_admin = new_admin_status, updated_at = NOW()
    WHERE id = target_user_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found';
    END IF;
    
    RETURN true;
END;
$$;

-- Enhanced function to completely delete a user from both profiles and auth
CREATE OR REPLACE FUNCTION delete_user_complete(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    target_email TEXT;
BEGIN
    -- Check if current user is admin
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    ) THEN
        RAISE EXCEPTION 'Access denied: Admin privileges required';
    END IF;
    
    -- Prevent user from deleting their own account
    IF target_user_id = auth.uid() THEN
        RAISE EXCEPTION 'Cannot delete your own account';
    END IF;
    
    -- Get the email for logging purposes
    SELECT email INTO target_email FROM profiles WHERE id = target_user_id;
    
    IF target_email IS NULL THEN
        RAISE EXCEPTION 'User not found in profiles';
    END IF;
    
    -- Delete from profiles table first (this is what actually matters for app access)
    DELETE FROM profiles WHERE id = target_user_id;
    
    -- Try to delete from auth.users table but don't fail if it doesn't work
    BEGIN
        -- This will likely fail unless function has service role privileges
        DELETE FROM auth.users WHERE id = target_user_id;
        RAISE NOTICE 'User % completely deleted from system', target_email;
        
    EXCEPTION
        WHEN insufficient_privilege THEN
            RAISE NOTICE 'User % deleted from profiles (auth user remains but cannot access app)', target_email;
        WHEN OTHERS THEN
            RAISE NOTICE 'User % deleted from profiles, auth deletion failed: %', target_email, SQLERRM;
    END;
    
    RETURN true;
END;
$$;

-- Function specifically for auth deletion that requires service role
CREATE OR REPLACE FUNCTION delete_user_auth_only(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- This function should only be callable by service role
    IF auth.role() != 'service_role' THEN
        RAISE EXCEPTION 'Service role required for auth deletion';
    END IF;
    
    DELETE FROM auth.users WHERE id = target_user_id;
    
    RETURN FOUND;
END;
$$;

-- Grant execute permissions for admin functions
GRANT EXECUTE ON FUNCTION get_all_users_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_admin_status(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_user_complete(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_user_auth_only(UUID) TO service_role;

-- Insert/update admin users (replace with your actual admin emails)
INSERT INTO profiles (id, email, is_admin, created_at, updated_at)
SELECT 
    id, 
    email, 
    true,
    NOW(),
    NOW()
FROM auth.users 
WHERE email IN ('email1@gmail.com', 'email2@gmail.com')
ON CONFLICT (id) 
DO UPDATE SET 
    is_admin = true,
    updated_at = NOW();