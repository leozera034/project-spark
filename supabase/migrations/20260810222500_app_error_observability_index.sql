-- Observabilidade: o dashboard administrativo consulta apenas eventos app.error
-- em ordem cronológica reversa. Um índice parcial evita varrer todo audit_logs
-- conforme o histórico operacional cresce, sem penalizar os demais tipos de log.
CREATE INDEX IF NOT EXISTS audit_logs_app_error_created_idx
  ON public.audit_logs (created_at DESC)
  WHERE action = 'app.error';
