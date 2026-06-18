-- Captures account/data deletion requests submitted from the public
-- /delete-account page by users who no longer have the app installed.
-- Satisfies Google Play's data deletion policy (web request method).

CREATE TABLE IF NOT EXISTS public.deletion_requests (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL,
  message    text,
  status     text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Basic guard against malformed email addresses.
ALTER TABLE public.deletion_requests
  DROP CONSTRAINT IF EXISTS deletion_requests_email_check;
ALTER TABLE public.deletion_requests
  ADD CONSTRAINT deletion_requests_email_check
  CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');

ALTER TABLE public.deletion_requests ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous visitors) may submit a deletion request,
-- because users without the app are not authenticated.
DROP POLICY IF EXISTS "Anyone can submit a deletion request" ON public.deletion_requests;
CREATE POLICY "Anyone can submit a deletion request" ON public.deletion_requests
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Only admins may read and manage the queued requests.
DROP POLICY IF EXISTS "Admins can manage deletion requests" ON public.deletion_requests;
CREATE POLICY "Admins can manage deletion requests" ON public.deletion_requests
  FOR ALL TO authenticated
  USING (is_admin());

GRANT INSERT ON public.deletion_requests TO anon, authenticated;
