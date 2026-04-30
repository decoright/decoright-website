-- Function to delete user account and all related data
-- Run this in Supabase SQL Editor

CREATE OR REPLACE FUNCTION delete_user_account(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Delete related data in order (respecting foreign keys)
  DELETE FROM messages WHERE sender_id = p_user_id;
  DELETE FROM service_requests WHERE user_id = p_user_id;
  DELETE FROM request_attachments WHERE request_id IN (SELECT id FROM service_requests WHERE user_id = p_user_id);
  DELETE FROM likes WHERE user_id = p_user_id;
  DELETE FROM profiles WHERE id = p_user_id;
  -- Finally delete auth user
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users (they can only delete their own account)
GRANT EXECUTE ON FUNCTION delete_user_account(UUID) TO authenticated;