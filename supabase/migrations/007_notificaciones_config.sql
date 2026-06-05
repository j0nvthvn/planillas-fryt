-- Agrega claves de configuración para el sistema de notificaciones por email
INSERT INTO public.configuracion (clave, valor) VALUES
  ('notificaciones_activas',     to_jsonb(true)),
  ('notificaciones_email_extra', 'null'::jsonb)
ON CONFLICT (clave) DO NOTHING;
