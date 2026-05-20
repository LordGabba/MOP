-- Melhorias da aba Escalas
-- Execute no SQL Editor do Supabase antes de testar as novas funções.

ALTER TABLE escalas
ADD COLUMN IF NOT EXISTS data_fim DATE,
ADD COLUMN IF NOT EXISTS pausa1 TEXT,
ADD COLUMN IF NOT EXISTS pausa2 TEXT,
ADD COLUMN IF NOT EXISTS almoco TEXT,
ADD COLUMN IF NOT EXISTS hora_extra NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tipo_alteracao TEXT,
ADD COLUMN IF NOT EXISTS observacao TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Normal';

CREATE INDEX IF NOT EXISTS escalas_colaborador_id_idx ON escalas (colaborador_id);
CREATE INDEX IF NOT EXISTS escalas_data_idx ON escalas (data);
