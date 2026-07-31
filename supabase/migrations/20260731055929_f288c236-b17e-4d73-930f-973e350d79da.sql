CREATE OR REPLACE FUNCTION private.orders_hash_tracking_token()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, private, extensions
AS $$
BEGIN
  IF NEW.public_tracking_token IS NOT NULL THEN
    NEW.tracking_token_hash :=
      encode(sha256(convert_to(NEW.public_tracking_token, 'UTF8')), 'hex');
    NEW.public_tracking_token := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_hash_tracking_token ON public.orders;
CREATE TRIGGER orders_hash_tracking_token
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION private.orders_hash_tracking_token();
