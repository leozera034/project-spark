UPDATE public.store_settings s
   SET manual_override_open = true, updated_at = now()
  FROM public.stores st
 WHERE st.id = s.store_id AND st.slug = 'mercado-aurora';