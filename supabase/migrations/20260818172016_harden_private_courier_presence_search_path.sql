-- Harden private helper search paths flagged by Supabase Security Advisor.
ALTER FUNCTION private.courier_presence_window()
  SET search_path TO public, private, pg_temp;

ALTER FUNCTION private.courier_presence_status(boolean, timestamptz)
  SET search_path TO public, private, pg_temp;
