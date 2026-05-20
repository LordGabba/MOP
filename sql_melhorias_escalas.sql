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


-- Garante que cada colaborador tenha apenas uma escala por dia.
-- Se já houver duplicadas, mantém a de maior id e remove as anteriores.
DELETE FROM escalas antiga
USING escalas nova
WHERE antiga.colaborador_id = nova.colaborador_id
  AND antiga.data = nova.data
  AND antiga.id < nova.id
  AND antiga.colaborador_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'escalas_colaborador_data_unique'
  ) THEN
    ALTER TABLE escalas
    ADD CONSTRAINT escalas_colaborador_data_unique UNIQUE (colaborador_id, data);
  END IF;
END $$;
