-- Aplicar pela equipe responsável pelo Supabase após confirmar que não há request_id NULL.
-- A tabela e os dados existentes são preservados.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM resultados_previsoes_ia WHERE request_id IS NULL) THEN
    RAISE EXCEPTION 'Corrija request_id NULL antes de aplicar NOT NULL';
  END IF;
END $$;
ALTER TABLE resultados_previsoes_ia ALTER COLUMN request_id SET NOT NULL;
DROP POLICY IF EXISTS "Permitir SELECT publico anon para resultados_previsoes_ia" ON resultados_previsoes_ia;
DROP POLICY IF EXISTS "Permitir SELECT publico para resultados_previsoes_ia" ON resultados_previsoes_ia;
REVOKE SELECT ON resultados_previsoes_ia FROM anon, authenticated;
GRANT SELECT, INSERT ON resultados_previsoes_ia TO service_role;
