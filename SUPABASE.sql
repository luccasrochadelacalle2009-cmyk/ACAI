-- =====================================================================
-- Acai ERP — SUPABASE.sql
-- Persistência mínima para o PWA offline-first de gestão de açaí
-- Projeto Supabase: tkgdeklhkhutvgskrbgd
-- URL: https://tkgdeklhkhutvgskrbgd.supabase.co (mesmo projeto do painel-vida)
-- Como executar: Supabase Dashboard > SQL Editor > New query > colar > Run
-- =====================================================================

-- ---------------------------------------------------------------------
-- AVISO DE SEGURANÇA — LEIA ANTES DE QUALQUER COISA
-- ---------------------------------------------------------------------
-- A chave publishable (antiga "anon key") é pública por design: pode ficar
-- no navegador, no HTML, no JavaScript e no repositório Git. Ela respeita
-- RLS e só acessa o que a política permitir para o usuário autenticado.
--
-- A chave service_role NUNCA deve ser usada no navegador, no PWA, em
-- localStorage, em arquivos de configuração do cliente ou em repositório.
-- Ela ignora RLS e daria a qualquer visitante acesso total ao estado de
-- TODOS os usuários deste projeto Supabase. Use service_role somente em
-- backend confiável (servidor ou Edge Function) e apenas se for realmente
-- necessário — este aplicativo não precisa dela para nada.
--
-- Todas as tabelas usam o prefixo acai_ para isolar os dados deste app
-- dos dados do painel-vida no mesmo projeto.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 1) Tabela de estado por usuário
-- ---------------------------------------------------------------------
-- O estado completo do aplicativo é UM objeto JSON por usuário.
-- Não existem tabelas normalizadas para vendas, despesas, estoque etc.
--
-- O merge é feito no CLIENTE, registro a registro, comparando `updatedAt`
-- (ISO 8601) com last-write-wins (LWW):
--   * updatedAt remoto mais recente -> substitui o registro local;
--   * updatedAt local mais recente  -> mantém o registro local;
--   * empate                        -> critério determinístico (ex.: maior id),
--                                      para que todos os dispositivos convirjam.
--
-- Registros excluídos são mantidos como tombstone (`deleted: true`) e NUNCA
-- devem ser removidos do JSON, senão a exclusão "ressuscita" no próximo
-- sync com outro dispositivo.
--
-- `version` é incrementada pelo cliente a cada gravação bem-sucedida.
-- `device_id` registra qual dispositivo fez o último push (rastreabilidade).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.acai_data (
  user_id    uuid        PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  data       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  device_id  text,
  version    bigint      NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.acai_data IS
  'Estado completo do PWA Acai ERP por usuário. Merge por registro no cliente com last-write-wins por updatedAt.';
COMMENT ON COLUMN public.acai_data.data IS
  'JSON raiz do app: meta, accounts, partners, suppliers, stockItems, products, recipes, sales, entries, expenses, purchases, stockMovements, bills, goalMovements, partnerTransactions, profitDistributions, transfers, cashCounts e audit.';
COMMENT ON COLUMN public.acai_data.version IS
  'Contador de versão incrementado pelo cliente a cada push bem-sucedido.';
COMMENT ON COLUMN public.acai_data.device_id IS
  'Identificador do dispositivo de origem do último push (somente informativo).';
COMMENT ON COLUMN public.acai_data.updated_at IS
  'Atualizado automaticamente pelo trigger a cada UPDATE.';

-- ---------------------------------------------------------------------
-- 2) Trigger de updated_at
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.acai_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_acai_data_updated_at ON public.acai_data;
CREATE TRIGGER trg_acai_data_updated_at
  BEFORE UPDATE ON public.acai_data
  FOR EACH ROW
  EXECUTE FUNCTION public.acai_touch_updated_at();

-- ---------------------------------------------------------------------
-- 3) Índice de updated_at
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_acai_data_updated_at
  ON public.acai_data (updated_at DESC);

-- ---------------------------------------------------------------------
-- 4) Row Level Security — cada usuário vê e altera somente a própria linha
-- ---------------------------------------------------------------------
ALTER TABLE public.acai_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "acai_data_select_own" ON public.acai_data;
CREATE POLICY "acai_data_select_own"
  ON public.acai_data FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "acai_data_insert_own" ON public.acai_data;
CREATE POLICY "acai_data_insert_own"
  ON public.acai_data FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "acai_data_update_own" ON public.acai_data;
CREATE POLICY "acai_data_update_own"
  ON public.acai_data FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "acai_data_delete_own" ON public.acai_data;
CREATE POLICY "acai_data_delete_own"
  ON public.acai_data FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Defesa em profundidade: anon não recebe nem mesmo privilégio de tabela.
REVOKE ALL ON public.acai_data FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.acai_data TO authenticated;

-- ---------------------------------------------------------------------
-- 5) Auditoria espelhada (opcional, mas recomendada)
-- ---------------------------------------------------------------------
-- O JSON em acai_data.data já contém `audit`. Esta tabela espelha esses
-- eventos para consultas separadas (ex.: "quem alterou essa venda?") sem
-- precisar baixar o estado inteiro. As colunas "before"/"after" são
-- aspas duplas porque são palavras-chave em SQL.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.acai_audit (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  at         timestamptz NOT NULL DEFAULT now(),
  entity     text        NOT NULL,
  entity_id  text        NOT NULL,
  action     text        NOT NULL,
  "before"   jsonb,
  "after"    jsonb,
  reason     text,
  user_email text
);

COMMENT ON TABLE public.acai_audit IS
  'Espelho opcional dos eventos de auditoria do Acai ERP. Nunca exponha registros de outros usuários.';

CREATE INDEX IF NOT EXISTS idx_acai_audit_user_at
  ON public.acai_audit (user_id, at DESC);

ALTER TABLE public.acai_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "acai_audit_select_own" ON public.acai_audit;
CREATE POLICY "acai_audit_select_own"
  ON public.acai_audit FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "acai_audit_insert_own" ON public.acai_audit;
CREATE POLICY "acai_audit_insert_own"
  ON public.acai_audit FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "acai_audit_update_own" ON public.acai_audit;
CREATE POLICY "acai_audit_update_own"
  ON public.acai_audit FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "acai_audit_delete_own" ON public.acai_audit;
CREATE POLICY "acai_audit_delete_own"
  ON public.acai_audit FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

REVOKE ALL ON public.acai_audit FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.acai_audit TO authenticated;

-- ---------------------------------------------------------------------
-- 6) VERIFICAÇÃO — execute este SELECT depois de rodar tudo acima
-- ---------------------------------------------------------------------
-- Resultado esperado no primeiro dia:
--   rls_acai_data = true, policies_acai_data = 4, policies_acai_audit = 4,
--   indice_updated_at = 1, trigger_updated_at = 1,
--   linhas_estado = 0 e linhas_auditoria = 0 (normal: ainda não houve sync).
-- ---------------------------------------------------------------------
SELECT
  to_regclass('public.acai_data')                                             AS tabela_estado,
  to_regclass('public.acai_audit')                                            AS tabela_auditoria,
  (SELECT relrowsecurity
     FROM pg_class
    WHERE oid = 'public.acai_data'::regclass)                                 AS rls_acai_data,
  (SELECT count(*)
     FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'acai_data')                  AS policies_acai_data,
  (SELECT count(*)
     FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'acai_audit')                 AS policies_acai_audit,
  (SELECT count(*)
     FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'acai_data'
      AND indexname = 'idx_acai_data_updated_at')                             AS indice_updated_at,
  (SELECT count(*)
     FROM pg_trigger
    WHERE tgrelid = 'public.acai_data'::regclass
      AND tgname = 'trg_acai_data_updated_at'
      AND NOT tgisinternal)                                                   AS trigger_updated_at,
  (SELECT count(*) FROM public.acai_data)                                     AS linhas_estado,
  (SELECT count(*) FROM public.acai_audit)                                    AS linhas_auditoria;

-- Detalhe das policies criadas (confira SELECT/INSERT/UPDATE/DELETE nas duas tabelas):
SELECT tablename, policyname, cmd
  FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename IN ('acai_data', 'acai_audit')
 ORDER BY tablename, cmd;

-- Fim do script. Reexecutá-lo é seguro: USE IF NOT EXISTS / DROP IF EXISTS.
-- Lembrete final: service_role NUNCA no navegador. Use apenas a publishable key.
