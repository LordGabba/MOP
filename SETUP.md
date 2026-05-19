# MOP 2026 — Guia Completo de Configuração

## Estrutura de pastas

```
Atendimento_MOP/
├── index.html      ← Estrutura HTML
├── style.css       ← Estilos e design system
├── script.js       ← Lógica + integração Supabase
└── SETUP.md        ← Este arquivo
```

---

## 1. Configurar o Supabase

### 1.1 Criar o projeto

1. Acesse [supabase.com](https://supabase.com) e faça login
2. Clique em **New Project**
3. Defina nome, senha e região (recomendo **South America (São Paulo)**)
4. Aguarde o projeto ser provisionado (~2 min)

### 1.2 Criar as tabelas (SQL)

Vá em **SQL Editor** no Supabase e execute o script abaixo:

```sql
-- =============================================
-- MOP 2026 — Criação de tabelas
-- Cada tabela armazena um JSON array na coluna "data"
-- =============================================

-- Tabela MOP (colaboradores operacionais)
CREATE TABLE IF NOT EXISTS public.mop (
  id   bigint PRIMARY KEY,
  data jsonb  NOT NULL DEFAULT '[]'::jsonb
);

-- Tabela Staff (supervisores, coordenadores)
CREATE TABLE IF NOT EXISTS public.staff (
  id   bigint PRIMARY KEY,
  data jsonb  NOT NULL DEFAULT '[]'::jsonb
);

-- Tabela Escala (grade mensal de turnos)
CREATE TABLE IF NOT EXISTS public.escala (
  id   bigint PRIMARY KEY,
  data jsonb  NOT NULL DEFAULT '[]'::jsonb
);

-- Tabela Programações (mudanças de status agendadas)
CREATE TABLE IF NOT EXISTS public.programacoes (
  id   bigint PRIMARY KEY,
  data jsonb  NOT NULL DEFAULT '[]'::jsonb
);

-- Inserir linhas iniciais (id=1) para cada tabela
INSERT INTO public.mop (id, data) VALUES (1, '[]'::jsonb)
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.staff (id, data) VALUES (1, '[]'::jsonb)
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.escala (id, data) VALUES (1, '[]'::jsonb)
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.programacoes (id, data) VALUES (1, '[]'::jsonb)
  ON CONFLICT (id) DO NOTHING;
```

### 1.3 Configurar Row Level Security (RLS) e Policies

```sql
-- =============================================
-- Habilitar RLS em todas as tabelas
-- =============================================
ALTER TABLE public.mop          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escala       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programacoes ENABLE ROW LEVEL SECURITY;

-- =============================================
-- Policies: leitura e escrita públicas (anon)
-- Adequado para uso interno / intranet
-- =============================================

-- MOP
CREATE POLICY "mop_select" ON public.mop
  FOR SELECT USING (true);

CREATE POLICY "mop_upsert" ON public.mop
  FOR ALL USING (true) WITH CHECK (true);

-- Staff
CREATE POLICY "staff_select" ON public.staff
  FOR SELECT USING (true);

CREATE POLICY "staff_upsert" ON public.staff
  FOR ALL USING (true) WITH CHECK (true);

-- Escala
CREATE POLICY "escala_select" ON public.escala
  FOR SELECT USING (true);

CREATE POLICY "escala_upsert" ON public.escala
  FOR ALL USING (true) WITH CHECK (true);

-- Programações
CREATE POLICY "prog_select" ON public.programacoes
  FOR SELECT USING (true);

CREATE POLICY "prog_upsert" ON public.programacoes
  FOR ALL USING (true) WITH CHECK (true);
```

> **Nota de segurança:** Estas policies permitem acesso público (anon key).
> Para ambientes com dados sensíveis, considere adicionar autenticação de usuário.

### 1.4 Obter as credenciais

No painel do Supabase:
- Vá em **Settings → API**
- Copie o **Project URL** e o **anon public key**

---

## 2. Configurar o script.js

Abra `script.js` e atualize as duas constantes no topo:

```javascript
const SUPABASE_URL      = 'https://SEU-PROJETO.supabase.co';
const SUPABASE_ANON_KEY = 'eyJ...sua_chave_anon...';
```

---

## 3. Publicar no GitHub Pages

### 3.1 Criar o repositório

```bash
git init
git add index.html style.css script.js
git commit -m "feat: MOP 2026 inicial"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/SEU_REPO.git
git push -u origin main
```

### 3.2 Ativar o GitHub Pages

1. No repositório, vá em **Settings → Pages**
2. Em **Source**, selecione **Deploy from a branch**
3. Branch: **main**, pasta: **/ (root)**
4. Clique em **Save**
5. Aguarde ~60 segundos
6. Acesse: `https://SEU_USUARIO.github.io/SEU_REPO/`

### 3.3 Atualizações futuras

```bash
git add -A
git commit -m "chore: atualização"
git push
```

---

## 4. Estrutura do banco de dados

Cada tabela tem apenas 2 colunas (`id` e `data`).
A coluna `data` armazena um JSON array com todos os registros:

### Exemplo: tabela `mop`

```json
[
  {
    "Colaborador": "João Silva",
    "Status": "Ativo",
    "Célula": "Vendas",
    "Tipo": "5X2",
    "Reporte": "Maria Gerente",
    "Horário": "08:00",
    "Saida": "17:00",
    "1º Pausa": "09:10",
    "Almoço": "12:00",
    "2º Pausa": "15:10",
    "Admissão": "2024-01-15"
  }
]
```

### Exemplo: tabela `escala`

```json
[
  {
    "Colaborador": "João Silva",
    "Status": "Ativo",
    "Célula": "Vendas",
    "Tipo": "5X2",
    "Horário": "08:00",
    "Saida": "17:00",
    "seg 01-05": "C",
    "ter 02-05": "C",
    "qua 03-05": "Folga",
    "qui 04-05": "C",
    "sex 05-05": "C",
    "sáb 06-05": "0",
    "dom 07-05": "0"
  }
]
```

### Exemplo: tabela `programacoes`

```json
[
  {
    "id": 1716000000000,
    "colabName": "João Silva",
    "changes": [
      {
        "status": "Férias",
        "dateStart": "2026-07-01",
        "dateEnd": "2026-07-30",
        "returnStatus": "Ativo",
        "returnDate": "2026-07-31"
      }
    ]
  }
]
```

---

## 5. Funcionalidades do sistema

| Funcionalidade | Descrição |
|---|---|
| **Painel MOP** | Lista colaboradores operacionais com filtros, edição inline e status |
| **Painel Staff** | Lista supervisores/líderes com edição inline |
| **Painel Escala** | Grade visual mensal com turnos coloridos, filtro por mês |
| **Programações** | Agendamento de mudanças de status (Férias, Afastamento, etc.) |
| **Auto-save** | Salva automaticamente 1.5s após qualquer alteração |
| **Sync manual** | Botão ⟳ Sync para forçar sincronização |
| **Export XLSX** | Exporta todos os dados em planilha Excel |
| **Sem escala** | Alerta colaboradores ativos sem grade preenchida |
| **Indicador** | Badge de status da conexão em tempo real |

---

## 6. Variáveis para configurar (resumo)

```javascript
// script.js — linhas 13 e 14
const SUPABASE_URL      = 'https://SEU-PROJETO.supabase.co';
const SUPABASE_ANON_KEY = 'eyJ...';
```

---

## 7. Troubleshooting

### "Erro ao carregar: Timeout"
- Verifique se o projeto Supabase está ativo (não pausado)
- Confirme se a URL e a chave anon estão corretas no `script.js`

### "Erro ao salvar"
- Verifique se as policies RLS foram criadas corretamente
- Confirme que a linha `id=1` foi inserida em cada tabela

### Dados não aparecem após atualizar
- O sistema usa `Cache-Control: no-cache` no HTML para evitar cache do GitHub Pages
- Force reload com `Ctrl+Shift+R`

### Coluna nova não aparece na escala
- As colunas de dias devem seguir o formato: `seg 01-05` (dia da semana + espaço + dd-mm)
- Dias de semana suportados: seg, ter, qua, qui, sex, sáb, dom

---

*MOP 2026 — Sistema de Gestão via GitHub Pages + Supabase*
