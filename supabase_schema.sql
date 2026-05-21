-- ============================================================
-- SISTEMA DE GESTÃƒÆ’O OPERACIONAL - SUPABASE SCHEMA COMPLETO
-- ============================================================
-- Execute este SQL no SQL Editor do Supabase

-- ============================================================
-- EXTENSÃƒâ€¢ES
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABELA: configuracoes
-- ============================================================
CREATE TABLE IF NOT EXISTS configuracoes (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  chave TEXT NOT NULL UNIQUE,
  valor JSONB,
  descricao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: colaboradores
-- ============================================================
CREATE TABLE IF NOT EXISTS colaboradores (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  matricula TEXT UNIQUE,
  centro_custo TEXT,
  nome TEXT NOT NULL,
  user_jira TEXT,
  user_blip TEXT,
  email TEXT,
  reporte TEXT,
  status TEXT DEFAULT 'Ativo',
  celula TEXT,
  grupo TEXT,
  tipo TEXT,
  horario TEXT,
  escala TEXT,
  saida TEXT,
  admissao DATE,
  tempo_meses INT,
  cargo TEXT,
  cpf TEXT,
  data_nasc DATE,
  idade INT,
  sexo TEXT,
  filial TEXT,
  area TEXT,
  telefone TEXT,
  programacao_ferias TEXT,
  primeiro_dia_ferias DATE,
  ultimo_dia_ferias DATE,
  turno TEXT,
  supervisor TEXT,
  coordenador TEXT,
  escala_ativa BOOLEAN DEFAULT TRUE,
  banco_horas NUMERIC(10,2) DEFAULT 0,
  jornada_semanal NUMERIC(5,2) DEFAULT 44,
  data_desligamento DATE,
  motivo_desligamento TEXT,
  observacoes TEXT,
  tags JSONB DEFAULT '[]',
  status_operacional TEXT DEFAULT 'Normal',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: staff
-- ============================================================
CREATE TABLE IF NOT EXISTS staff (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  matricula TEXT UNIQUE,
  centro_custo TEXT,
  nome TEXT NOT NULL,
  user_jira TEXT,
  user_blip TEXT,
  email TEXT,
  reporte TEXT,
  status TEXT DEFAULT 'Ativo',
  celula TEXT,
  grupo TEXT,
  tipo TEXT,
  horario TEXT,
  escala TEXT,
  saida TEXT,
  admissao DATE,
  tempo_meses INT,
  cargo TEXT,
  cpf TEXT,
  data_nasc DATE,
  idade INT,
  sexo TEXT,
  filial TEXT,
  area TEXT,
  telefone TEXT,
  nivel_hierarquico TEXT,
  equipe_responsavel TEXT,
  quantidade_colaboradores INT DEFAULT 0,
  permissoes JSONB DEFAULT '[]',
  tipo_lideranca TEXT,
  indicadores JSONB DEFAULT '{}',
  observacoes TEXT,
  tags JSONB DEFAULT '[]',
  status_operacional TEXT DEFAULT 'Normal',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: escalas
-- ============================================================
CREATE TABLE IF NOT EXISTS escalas (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  colaborador_id BIGINT REFERENCES colaboradores(id) ON DELETE CASCADE,
  colaborador_nome TEXT,
  data DATE NOT NULL,
  horario TEXT,
  entrada TEXT,
  saida TEXT,
  almoco TEXT,
  pausa1 TEXT,
  pausa2 TEXT,
  hora_extra NUMERIC(5,2) DEFAULT 0,
  escala_aplicada TEXT,
  tipo_alteracao TEXT,
  responsavel_alteracao TEXT,
  observacao TEXT,
  status TEXT DEFAULT 'Normal',
  cor TEXT DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: programacoes
-- ============================================================
CREATE TABLE IF NOT EXISTS programacoes (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  colaborador_id BIGINT REFERENCES colaboradores(id) ON DELETE CASCADE,
  colaborador_nome TEXT,
  tipo TEXT NOT NULL,
  data_inicio DATE NOT NULL,
  data_fim DATE,
  recorrente BOOLEAN DEFAULT FALSE,
  recorrencia JSONB,
  aprovado BOOLEAN DEFAULT FALSE,
  aprovado_por TEXT,
  aprovado_em TIMESTAMPTZ,
  motivo TEXT,
  observacao TEXT,
  status TEXT DEFAULT 'Pendente',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: auditoria
-- ============================================================
CREATE TABLE IF NOT EXISTS auditoria (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  tabela TEXT NOT NULL,
  operacao TEXT NOT NULL,
  registro_id BIGINT,
  dados_anteriores JSONB,
  dados_novos JSONB,
  usuario TEXT DEFAULT 'Sistema',
  ip TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: usuarios
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  perfil TEXT DEFAULT 'Operador',
  permissoes JSONB DEFAULT '{}',
  ativo BOOLEAN DEFAULT TRUE,
  ultimo_acesso TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: usuarios_autorizados
-- Controle oficial de acesso usado pelo Supabase Auth/RLS.
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios_autorizados (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  email TEXT UNIQUE NOT NULL,
  nome TEXT,
  perfil TEXT NOT NULL DEFAULT 'CONSULTA'
    CHECK (perfil IN ('ADMIN','GESTOR','CONSULTA','AGENTE','BLOQUEADO','INATIVO')),
  status TEXT NOT NULL DEFAULT 'Ativo'
    CHECK (status IN ('Ativo','Bloqueado','Inativo')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: auth_logs
-- Logs de login/logout/tentativas negadas.
-- ============================================================
CREATE TABLE IF NOT EXISTS auth_logs (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  operacao TEXT NOT NULL,
  user_id UUID,
  email TEXT,
  perfil TEXT,
  detalhes JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ÃƒÂNDICES PARA PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_colaboradores_status ON colaboradores(status);
CREATE INDEX IF NOT EXISTS idx_colaboradores_celula ON colaboradores(celula);
CREATE INDEX IF NOT EXISTS idx_colaboradores_grupo ON colaboradores(grupo);
CREATE INDEX IF NOT EXISTS idx_colaboradores_filial ON colaboradores(filial);
CREATE INDEX IF NOT EXISTS idx_colaboradores_escala ON colaboradores(escala);
CREATE INDEX IF NOT EXISTS idx_colaboradores_nome ON colaboradores(nome);
CREATE INDEX IF NOT EXISTS idx_colaboradores_matricula ON colaboradores(matricula);
CREATE INDEX IF NOT EXISTS idx_colaboradores_email_lower ON colaboradores(LOWER(email));

CREATE INDEX IF NOT EXISTS idx_escalas_data ON escalas(data);
CREATE INDEX IF NOT EXISTS idx_escalas_colaborador ON escalas(colaborador_id);

CREATE INDEX IF NOT EXISTS idx_programacoes_colaborador ON programacoes(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_programacoes_data_inicio ON programacoes(data_inicio);
CREATE INDEX IF NOT EXISTS idx_programacoes_tipo ON programacoes(tipo);
CREATE INDEX IF NOT EXISTS idx_programacoes_status ON programacoes(status);

CREATE INDEX IF NOT EXISTS idx_auditoria_tabela ON auditoria(tabela);
CREATE INDEX IF NOT EXISTS idx_auditoria_created ON auditoria(created_at);
CREATE INDEX IF NOT EXISTS idx_usuarios_autorizados_email_lower ON usuarios_autorizados(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_usuarios_autorizados_perfil ON usuarios_autorizados(perfil);
CREATE INDEX IF NOT EXISTS idx_usuarios_autorizados_status ON usuarios_autorizados(status);
CREATE INDEX IF NOT EXISTS idx_auth_logs_email ON auth_logs(email);
CREATE INDEX IF NOT EXISTS idx_auth_logs_created ON auth_logs(created_at);

-- ============================================================
-- FUNÃƒâ€¡ÃƒÆ’O: atualiza updated_at automaticamente
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers updated_at
DROP TRIGGER IF EXISTS trg_colaboradores_updated ON colaboradores;
DROP TRIGGER IF EXISTS trg_staff_updated ON staff;
DROP TRIGGER IF EXISTS trg_escalas_updated ON escalas;
DROP TRIGGER IF EXISTS trg_programacoes_updated ON programacoes;
DROP TRIGGER IF EXISTS trg_usuarios_updated ON usuarios;
DROP TRIGGER IF EXISTS trg_usuarios_autorizados_updated ON usuarios_autorizados;
DROP TRIGGER IF EXISTS trg_configuracoes_updated ON configuracoes;

CREATE TRIGGER trg_colaboradores_updated BEFORE UPDATE ON colaboradores FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_staff_updated BEFORE UPDATE ON staff FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_escalas_updated BEFORE UPDATE ON escalas FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_programacoes_updated BEFORE UPDATE ON programacoes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_usuarios_updated BEFORE UPDATE ON usuarios FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_usuarios_autorizados_updated BEFORE UPDATE ON usuarios_autorizados FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_configuracoes_updated BEFORE UPDATE ON configuracoes FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (RLS) - SEGURANCA REAL POR PERFIL
-- ============================================================
ALTER TABLE colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalas ENABLE ROW LEVEL SECURITY;
ALTER TABLE programacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios_autorizados ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_logs ENABLE ROW LEVEL SECURITY;

-- Remove policies antigas/permissivas e permite reexecutar este schema sem erro.
DROP POLICY IF EXISTS "allow_all_colaboradores" ON colaboradores;
DROP POLICY IF EXISTS "allow_all_staff" ON staff;
DROP POLICY IF EXISTS "allow_all_escalas" ON escalas;
DROP POLICY IF EXISTS "allow_all_programacoes" ON programacoes;
DROP POLICY IF EXISTS "allow_all_auditoria" ON auditoria;
DROP POLICY IF EXISTS "allow_all_usuarios" ON usuarios;
DROP POLICY IF EXISTS "allow_all_configuracoes" ON configuracoes;

DROP POLICY IF EXISTS usuarios_autorizados_select_self_or_admin ON usuarios_autorizados;
DROP POLICY IF EXISTS usuarios_autorizados_admin_insert ON usuarios_autorizados;
DROP POLICY IF EXISTS usuarios_autorizados_admin_update ON usuarios_autorizados;
DROP POLICY IF EXISTS usuarios_autorizados_admin_delete ON usuarios_autorizados;

DROP POLICY IF EXISTS colaboradores_select_por_perfil ON colaboradores;
DROP POLICY IF EXISTS colaboradores_insert_admin_gestor ON colaboradores;
DROP POLICY IF EXISTS colaboradores_update_admin_gestor ON colaboradores;
DROP POLICY IF EXISTS colaboradores_delete_admin ON colaboradores;

DROP POLICY IF EXISTS staff_select_admin_gestor_consulta ON staff;
DROP POLICY IF EXISTS staff_insert_admin_gestor ON staff;
DROP POLICY IF EXISTS staff_update_admin_gestor ON staff;
DROP POLICY IF EXISTS staff_delete_admin ON staff;

DROP POLICY IF EXISTS escalas_select_por_perfil ON escalas;
DROP POLICY IF EXISTS escalas_insert_admin_gestor ON escalas;
DROP POLICY IF EXISTS escalas_update_admin_gestor ON escalas;
DROP POLICY IF EXISTS escalas_delete_admin ON escalas;

DROP POLICY IF EXISTS programacoes_select_admin_gestor_consulta ON programacoes;
DROP POLICY IF EXISTS programacoes_insert_admin_gestor ON programacoes;
DROP POLICY IF EXISTS programacoes_update_admin_gestor ON programacoes;
DROP POLICY IF EXISTS programacoes_delete_admin ON programacoes;

DROP POLICY IF EXISTS configuracoes_select_admin ON configuracoes;
DROP POLICY IF EXISTS configuracoes_write_admin ON configuracoes;
DROP POLICY IF EXISTS auditoria_select_admin ON auditoria;
DROP POLICY IF EXISTS auditoria_insert_autorizado ON auditoria;
DROP POLICY IF EXISTS auth_logs_select_admin ON auth_logs;
DROP POLICY IF EXISTS auth_logs_insert_authenticated ON auth_logs;
DROP POLICY IF EXISTS usuarios_select_admin ON usuarios;
DROP POLICY IF EXISTS usuarios_write_admin ON usuarios;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

CREATE OR REPLACE FUNCTION app_user_email()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT LOWER(COALESCE(auth.jwt() ->> 'email', ''));
$$;

CREATE OR REPLACE FUNCTION app_user_profile()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ua.perfil
  FROM usuarios_autorizados ua
  WHERE LOWER(ua.email) = app_user_email()
    AND ua.status = 'Ativo'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION app_is_authorized()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM usuarios_autorizados ua
    WHERE LOWER(ua.email) = app_user_email()
      AND ua.status = 'Ativo'
      AND ua.perfil IN ('ADMIN','GESTOR','CONSULTA','AGENTE')
  );
$$;

CREATE OR REPLACE FUNCTION app_has_profile(perfis TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT app_user_profile() = ANY(perfis);
$$;

CREATE OR REPLACE FUNCTION app_colaborador_id()
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id
  FROM colaboradores c
  WHERE LOWER(c.email) = app_user_email()
  ORDER BY c.id
  LIMIT 1;
$$;

CREATE POLICY usuarios_autorizados_select_self_or_admin ON usuarios_autorizados
FOR SELECT TO authenticated
USING (LOWER(email) = app_user_email() OR app_has_profile(ARRAY['ADMIN']::TEXT[]));

CREATE POLICY usuarios_autorizados_admin_insert ON usuarios_autorizados
FOR INSERT TO authenticated
WITH CHECK (app_has_profile(ARRAY['ADMIN']::TEXT[]));

CREATE POLICY usuarios_autorizados_admin_update ON usuarios_autorizados
FOR UPDATE TO authenticated
USING (app_has_profile(ARRAY['ADMIN']::TEXT[]))
WITH CHECK (app_has_profile(ARRAY['ADMIN']::TEXT[]));

CREATE POLICY usuarios_autorizados_admin_delete ON usuarios_autorizados
FOR DELETE TO authenticated
USING (app_has_profile(ARRAY['ADMIN']::TEXT[]));

CREATE POLICY colaboradores_select_por_perfil ON colaboradores
FOR SELECT TO authenticated
USING (
  app_is_authorized()
  AND (
    app_has_profile(ARRAY['ADMIN','GESTOR','CONSULTA']::TEXT[])
    OR (app_has_profile(ARRAY['AGENTE']::TEXT[]) AND LOWER(email) = app_user_email())
  )
);

CREATE POLICY colaboradores_insert_admin_gestor ON colaboradores
FOR INSERT TO authenticated
WITH CHECK (app_has_profile(ARRAY['ADMIN','GESTOR']::TEXT[]));

CREATE POLICY colaboradores_update_admin_gestor ON colaboradores
FOR UPDATE TO authenticated
USING (app_has_profile(ARRAY['ADMIN','GESTOR']::TEXT[]))
WITH CHECK (app_has_profile(ARRAY['ADMIN','GESTOR']::TEXT[]));

CREATE POLICY colaboradores_delete_admin ON colaboradores
FOR DELETE TO authenticated
USING (app_has_profile(ARRAY['ADMIN']::TEXT[]));

CREATE POLICY staff_select_admin_gestor_consulta ON staff
FOR SELECT TO authenticated
USING (app_has_profile(ARRAY['ADMIN','GESTOR','CONSULTA']::TEXT[]));

CREATE POLICY staff_insert_admin_gestor ON staff
FOR INSERT TO authenticated
WITH CHECK (app_has_profile(ARRAY['ADMIN','GESTOR']::TEXT[]));

CREATE POLICY staff_update_admin_gestor ON staff
FOR UPDATE TO authenticated
USING (app_has_profile(ARRAY['ADMIN','GESTOR']::TEXT[]))
WITH CHECK (app_has_profile(ARRAY['ADMIN','GESTOR']::TEXT[]));

CREATE POLICY staff_delete_admin ON staff
FOR DELETE TO authenticated
USING (app_has_profile(ARRAY['ADMIN']::TEXT[]));

CREATE POLICY escalas_select_por_perfil ON escalas
FOR SELECT TO authenticated
USING (
  app_has_profile(ARRAY['ADMIN','GESTOR','CONSULTA']::TEXT[])
  OR (app_has_profile(ARRAY['AGENTE']::TEXT[]) AND colaborador_id = app_colaborador_id())
);

CREATE POLICY escalas_insert_admin_gestor ON escalas
FOR INSERT TO authenticated
WITH CHECK (app_has_profile(ARRAY['ADMIN','GESTOR']::TEXT[]));

CREATE POLICY escalas_update_admin_gestor ON escalas
FOR UPDATE TO authenticated
USING (app_has_profile(ARRAY['ADMIN','GESTOR']::TEXT[]))
WITH CHECK (app_has_profile(ARRAY['ADMIN','GESTOR']::TEXT[]));

CREATE POLICY escalas_delete_admin ON escalas
FOR DELETE TO authenticated
USING (app_has_profile(ARRAY['ADMIN']::TEXT[]));

CREATE POLICY programacoes_select_admin_gestor_consulta ON programacoes
FOR SELECT TO authenticated
USING (app_has_profile(ARRAY['ADMIN','GESTOR','CONSULTA']::TEXT[]));

CREATE POLICY programacoes_insert_admin_gestor ON programacoes
FOR INSERT TO authenticated
WITH CHECK (app_has_profile(ARRAY['ADMIN','GESTOR']::TEXT[]));

CREATE POLICY programacoes_update_admin_gestor ON programacoes
FOR UPDATE TO authenticated
USING (app_has_profile(ARRAY['ADMIN','GESTOR']::TEXT[]))
WITH CHECK (app_has_profile(ARRAY['ADMIN','GESTOR']::TEXT[]));

CREATE POLICY programacoes_delete_admin ON programacoes
FOR DELETE TO authenticated
USING (app_has_profile(ARRAY['ADMIN']::TEXT[]));

CREATE POLICY configuracoes_select_admin ON configuracoes
FOR SELECT TO authenticated
USING (app_has_profile(ARRAY['ADMIN']::TEXT[]));

CREATE POLICY configuracoes_write_admin ON configuracoes
FOR ALL TO authenticated
USING (app_has_profile(ARRAY['ADMIN']::TEXT[]))
WITH CHECK (app_has_profile(ARRAY['ADMIN']::TEXT[]));

CREATE POLICY auditoria_select_admin ON auditoria
FOR SELECT TO authenticated
USING (app_has_profile(ARRAY['ADMIN']::TEXT[]));

CREATE POLICY auditoria_insert_autorizado ON auditoria
FOR INSERT TO authenticated
WITH CHECK (app_is_authorized());

CREATE POLICY auth_logs_select_admin ON auth_logs
FOR SELECT TO authenticated
USING (app_has_profile(ARRAY['ADMIN']::TEXT[]));

CREATE POLICY auth_logs_insert_authenticated ON auth_logs
FOR INSERT TO authenticated
WITH CHECK (LOWER(email) = app_user_email() OR email IS NULL);

CREATE POLICY usuarios_select_admin ON usuarios
FOR SELECT TO authenticated
USING (app_has_profile(ARRAY['ADMIN']::TEXT[]));

CREATE POLICY usuarios_write_admin ON usuarios
FOR ALL TO authenticated
USING (app_has_profile(ARRAY['ADMIN']::TEXT[]))
WITH CHECK (app_has_profile(ARRAY['ADMIN']::TEXT[]));
-- ============================================================
-- DADOS INICIAIS DE CONFIGURAÃƒâ€¡ÃƒÆ’O
-- ============================================================
INSERT INTO configuracoes (chave, valor, descricao) VALUES
  ('tema', '"claro"', 'Tema da interface'),
  ('empresa', '"Minha Empresa"', 'Nome da empresa'),
  ('celulas', '["CÃƒÂ©lula A","CÃƒÂ©lula B","CÃƒÂ©lula C","Suporte","OperaÃƒÂ§ÃƒÂµes"]', 'CÃƒÂ©lulas disponÃƒÂ­veis'),
  ('grupos', '["Grupo 1","Grupo 2","Grupo 3","Especialistas"]', 'Grupos disponÃƒÂ­veis'),
  ('horarios', '["06:00-14:00","14:00-22:00","22:00-06:00","08:00-17:00","09:00-18:00","10:00-19:00"]', 'HorÃƒÂ¡rios padrÃƒÂ£o'),
  ('filiais', '["Matriz","Filial SP","Filial RJ","Filial BH"]', 'Filiais cadastradas'),
  ('tipos_escala', '["Normal","Day Off","FÃƒÂ©rias","Folga","Treinamento","Home Office","LicenÃƒÂ§a"]', 'Tipos de escala'),
  ('cargos', '["Analista","Coordenador","Gerente","Assistente","Especialista","Supervisor","Diretor"]', 'Cargos disponÃƒÂ­veis')
ON CONFLICT (chave) DO NOTHING;

-- ============================================================
-- FIM DO SCHEMA
-- ============================================================


