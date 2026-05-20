-- ============================================================
-- SISTEMA DE GESTÃO OPERACIONAL - SUPABASE SCHEMA COMPLETO
-- ============================================================
-- Execute este SQL no SQL Editor do Supabase

-- ============================================================
-- EXTENSÕES
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
-- ÍNDICES PARA PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_colaboradores_status ON colaboradores(status);
CREATE INDEX IF NOT EXISTS idx_colaboradores_celula ON colaboradores(celula);
CREATE INDEX IF NOT EXISTS idx_colaboradores_grupo ON colaboradores(grupo);
CREATE INDEX IF NOT EXISTS idx_colaboradores_filial ON colaboradores(filial);
CREATE INDEX IF NOT EXISTS idx_colaboradores_escala ON colaboradores(escala);
CREATE INDEX IF NOT EXISTS idx_colaboradores_nome ON colaboradores(nome);
CREATE INDEX IF NOT EXISTS idx_colaboradores_matricula ON colaboradores(matricula);

CREATE INDEX IF NOT EXISTS idx_escalas_data ON escalas(data);
CREATE INDEX IF NOT EXISTS idx_escalas_colaborador ON escalas(colaborador_id);

CREATE INDEX IF NOT EXISTS idx_programacoes_colaborador ON programacoes(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_programacoes_data_inicio ON programacoes(data_inicio);
CREATE INDEX IF NOT EXISTS idx_programacoes_tipo ON programacoes(tipo);
CREATE INDEX IF NOT EXISTS idx_programacoes_status ON programacoes(status);

CREATE INDEX IF NOT EXISTS idx_auditoria_tabela ON auditoria(tabela);
CREATE INDEX IF NOT EXISTS idx_auditoria_created ON auditoria(created_at);

-- ============================================================
-- FUNÇÃO: atualiza updated_at automaticamente
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers updated_at
CREATE TRIGGER trg_colaboradores_updated BEFORE UPDATE ON colaboradores FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_staff_updated BEFORE UPDATE ON staff FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_escalas_updated BEFORE UPDATE ON escalas FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_programacoes_updated BEFORE UPDATE ON programacoes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_usuarios_updated BEFORE UPDATE ON usuarios FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_configuracoes_updated BEFORE UPDATE ON configuracoes FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalas ENABLE ROW LEVEL SECURITY;
ALTER TABLE programacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracoes ENABLE ROW LEVEL SECURITY;

-- Policies: acesso total para anon (sistema de uso próprio)
CREATE POLICY "allow_all_colaboradores" ON colaboradores FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_staff" ON staff FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_escalas" ON escalas FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_programacoes" ON programacoes FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_auditoria" ON auditoria FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_usuarios" ON usuarios FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_configuracoes" ON configuracoes FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================================
-- DADOS INICIAIS DE CONFIGURAÇÃO
-- ============================================================
INSERT INTO configuracoes (chave, valor, descricao) VALUES
  ('tema', '"claro"', 'Tema da interface'),
  ('empresa', '"Minha Empresa"', 'Nome da empresa'),
  ('celulas', '["Célula A","Célula B","Célula C","Suporte","Operações"]', 'Células disponíveis'),
  ('grupos', '["Grupo 1","Grupo 2","Grupo 3","Especialistas"]', 'Grupos disponíveis'),
  ('horarios', '["06:00-14:00","14:00-22:00","22:00-06:00","08:00-17:00","09:00-18:00","10:00-19:00"]', 'Horários padrão'),
  ('filiais', '["Matriz","Filial SP","Filial RJ","Filial BH"]', 'Filiais cadastradas'),
  ('tipos_escala', '["Normal","Day Off","Férias","Folga","Treinamento","Home Office","Licença"]', 'Tipos de escala'),
  ('cargos', '["Analista","Coordenador","Gerente","Assistente","Especialista","Supervisor","Diretor"]', 'Cargos disponíveis')
ON CONFLICT (chave) DO NOTHING;

-- ============================================================
-- FIM DO SCHEMA
-- ============================================================
