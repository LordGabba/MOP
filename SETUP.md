# MOP 2026 — Guia de Configuração (v29)

## Estrutura de arquivos

```
Atendimento_MOP/
├── index.html      ← Estrutura HTML (todos os painéis e modais)
├── style.css       ← Design system completo
├── script.js       ← Toda a lógica + integração Supabase
└── SETUP.md        ← Este guia
```

---

## 1. Criar tabelas no Supabase

Vá em **SQL Editor** no painel do Supabase e execute:

```sql
-- Tabelas do MOP 2026
CREATE TABLE IF NOT EXISTS public.mop (
  id   bigint PRIMARY KEY,
  data jsonb  NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS public.staff (
  id   bigint PRIMARY KEY,
  data jsonb  NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS public.escala (
  id   bigint PRIMARY KEY,
  data jsonb  NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS public.programacoes (
  id   bigint PRIMARY KEY,
  data jsonb  NOT NULL DEFAULT '[]'::jsonb
);

-- Inserir linha inicial id=1 em cada tabela
INSERT INTO public.mop          (id, data) VALUES (1, '[]') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.staff        (id, data) VALUES (1, '[]') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.escala       (id, data) VALUES (1, '[]') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.programacoes (id, data) VALUES (1, '[]') ON CONFLICT (id) DO NOTHING;
```

---

## 2. Configurar RLS e Policies

```sql
-- Habilitar Row Level Security
ALTER TABLE public.mop          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escala       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programacoes ENABLE ROW LEVEL SECURITY;

-- Policies: acesso público (anon key) para leitura e escrita
CREATE POLICY "allow_all_mop"   ON public.mop          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_staff" ON public.staff        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_esc"   ON public.escala       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_prog"  ON public.programacoes FOR ALL USING (true) WITH CHECK (true);
```

---

## 3. Atualizar credenciais no script.js

Edite as linhas 12-13 do `script.js`:

```javascript
const SUPABASE_URL      = 'https://SEU-PROJETO.supabase.co';
const SUPABASE_ANON_KEY = 'eyJ...sua_chave_anon...';
```

Obtenha em: **Painel Supabase → Settings → API**.

---

## 4. Publicar no GitHub Pages

```bash
git init
git add index.html style.css script.js
git commit -m "feat: MOP 2026 v29"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/SEU_REPO.git
git push -u origin main
```

No repositório: **Settings → Pages → Source: main / root → Save**

URL de acesso: `https://SEU_USUARIO.github.io/SEU_REPO/`

---

## 5. Melhorias da v29 (sem quebrar compatibilidade)

| O que foi melhorado | Como |
|---|---|
| Retry automático | 3 tentativas com backoff 2s/4s |
| Anti-colisão de sync | Fila `syncPending` evita sobreposição |
| Filtros com debounce | 120ms de delay melhora performance |
| Preserva seleção de filtros | `fillSel` mantém valor ao recarregar |
| Limpeza de campos `_` antes de salvar | Evita metadados nos dados do banco |
| renderMop/Staff com stats dinâmicas | KPIs atualizados a cada render |
| `renderProg` com cards + badges | Estado visual claro (Ativo/Pendente) |
| `openDayEditor` popup inline | Sem modal, edição rápida na escala |
| Filtro `esc-dow` funcional | Filtra colunas por dia da semana |
| Filtro `show-miss` funcional | Mostra colaboradores sem escala inline |
| `beforeunload` | Avisa antes de fechar com dados não salvos |
| `mop-grp` filter | Filtro de Grupo no painel MOP |

---

## 6. Compatibilidade de dados

O sistema é 100% compatível com dados do banco existente:
- Estrutura `{ id: 1, data: [...] }` preservada
- Campos `_id`, `_src`, `_admissao`, `_origStatus` são internos (não salvos)
- Todos os campos de dados são preservados na gravação
- Nomes de campos (`Horário`, `Horario`, `1º Pausa`, etc.) mantidos

---

## 7. Estrutura de dados esperada

### Tabela `escala` — colunas de dias
Formato obrigatório: `"seg 01-05"` (dia da semana + espaço + dd-mm)

Dias aceitos: `seg`, `ter`, `qua`, `qui`, `sex`, `sáb`, `dom`

### Tabela `programacoes`
```json
{
  "id": 1716000000000,
  "colabName": "Nome Completo",
  "changes": [
    {
      "status": "Férias",
      "dateStart": "2026-07-01",
      "dateEnd": "2026-07-31",
      "returnStatus": "Ativo",
      "returnDate": "2026-08-01"
    }
  ]
}
```
