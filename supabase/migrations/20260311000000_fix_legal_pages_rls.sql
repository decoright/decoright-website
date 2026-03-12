
-- Fix RLS policy for legal_pages to allow both admin and super_admin
-- Also use the existing is_admin() function for consistency

DROP POLICY IF EXISTS "Admins can manage legal pages" ON legal_pages;

CREATE POLICY "Admins can manage legal pages" ON legal_pages 
FOR ALL TO authenticated 
USING (is_admin());
