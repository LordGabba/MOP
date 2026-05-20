# OpGest â€” Sistema de GestÃ£o Operacional
## InstruÃ§Ãµes Completas de Deploy

---

## ðŸ“ Estrutura de Arquivos

```
opgest/
â”œâ”€â”€ index.html       â†’ PÃ¡gina principal + modais
â”œâ”€â”€ style.css        â†’ Estilos completos (tema claro/escuro)
â”œâ”€â”€ script.js        â†’ LÃ³gica do sistema
â”œâ”€â”€ supabase.js      â†’ ConexÃ£o e operaÃ§Ãµes com o banco
â””â”€â”€ supabase_schema.sql â†’ SQL para criar as tabelas
```

---

## 1ï¸âƒ£ CONFIGURAR O SUPABASE

### 1.1 Criar as Tabelas
1. Acesse https://app.supabase.com
2. Selecione seu projeto
3. VÃ¡ em **SQL Editor** â†’ **New Query**
4. Cole o conteÃºdo completo de `supabase_schema.sql`
5. Clique em **Run**

### 1.2 Verificar as Tabelas
ApÃ³s executar o SQL, em **Table Editor** vocÃª deve ver:
- `colaboradores`
- `staff`
- `escalas`
- `programacoes`
- `auditoria`
- `usuarios`
- `configuracoes`

### 1.3 Verificar Policies (RLS)
Em **Authentication -> Policies**, confirme que as policies por perfil do arquivo `supabase_schema.sql` foram criadas. Nao use policies abertas para `anon`.

---

## 2ï¸âƒ£ DEPLOY NO GITHUB PAGES

### 2.1 Criar o RepositÃ³rio
1. Acesse https://github.com â†’ **New repository**
2. Nome: `opgest` (ou o nome que preferir)
3. Visibilidade: **Public** (necessÃ¡rio para GitHub Pages gratuito)
4. Clique em **Create repository**

### 2.2 Fazer Upload dos Arquivos
**OpÃ§Ã£o A â€” Via Interface Web:**
1. No repositÃ³rio criado, clique em **Add file â†’ Upload files**
2. Arraste os 4 arquivos: `index.html`, `style.css`, `script.js`, `supabase.js`
3. Clique em **Commit changes**

**OpÃ§Ã£o B â€” Via Git (linha de comando):**
```bash
git clone https://github.com/SEU_USUARIO/opgest.git
cd opgest
# Copie os arquivos para esta pasta
git add .
git commit -m "Sistema OpGest - deploy inicial"
git push origin main
```

### 2.3 Ativar GitHub Pages
1. No repositÃ³rio, vÃ¡ em **Settings â†’ Pages**
2. Em **Source**, selecione:
   - Branch: `main`
   - Folder: `/ (root)`
3. Clique em **Save**
4. Aguarde 2-5 minutos
5. O sistema estarÃ¡ disponÃ­vel em: `https://SEU_USUARIO.github.io/opgest/`

---

## 3ï¸âƒ£ VERIFICAR O SISTEMA

### Checklist pÃ³s-deploy:
- [ ] A pÃ¡gina carrega sem erros no console (F12)
- [ ] O loader some apÃ³s alguns segundos
- [ ] O Dashboard exibe os cards de estatÃ­sticas
- [ ] Ã‰ possÃ­vel cadastrar um colaborador de teste
- [ ] O toast de sucesso aparece ao salvar
- [ ] Os dados aparecem na tabela

---

## 4ï¸âƒ£ FUNCIONALIDADES DO SISTEMA

### ðŸ“Š Dashboard
- Totais em tempo real: colaboradores, ativos, fÃ©rias, day off
- ProgramaÃ§Ãµes pendentes
- Lista de colaboradores ativos
- GrÃ¡fico de distribuiÃ§Ã£o por cÃ©lula

### ðŸ‘¥ Colaboradores
- Cadastro completo (30+ campos)
- ValidaÃ§Ã£o automÃ¡tica de CPF
- CÃ¡lculo automÃ¡tico de idade e tempo de empresa
- Filtros por status, cÃ©lula, grupo, filial
- Busca instantÃ¢nea
- PaginaÃ§Ã£o
- SeleÃ§Ã£o mÃºltipla para exclusÃ£o em lote
- ExportaÃ§Ã£o CSV e PDF
- EdiÃ§Ã£o inline via modal

### ðŸ‘” Staff / LideranÃ§a
- Mesma estrutura de colaboradores
- Campos extras: nÃ­vel hierÃ¡rquico, tipo de lideranÃ§a, equipe responsÃ¡vel, quantidade de colaboradores

### ðŸ“… Escalas
- CalendÃ¡rio visual mensal
- Clique em qualquer dia para ver/adicionar escalas
- Tipos: Normal, FÃ©rias, Day Off, Folga, Treinamento, Home Office, LicenÃ§a, Hora Extra
- IdentificaÃ§Ã£o visual por cores

### ðŸ“‹ ProgramaÃ§Ãµes
- Registros de fÃ©rias, treinamentos, HO, licenÃ§as, trocas, ausÃªncias
- ProgramaÃ§Ãµes recorrentes
- Fluxo de aprovaÃ§Ã£o (Pendente â†’ Aprovado)
- Filtros por tipo e status

### ðŸ–ï¸ FÃ©rias
- VisÃ£o consolidada de todos colaboradores com fÃ©rias programadas
- CÃ¡lculo automÃ¡tico de dias de fÃ©rias
- ExportaÃ§Ã£o

### ðŸ“ˆ RelatÃ³rios
- ExportaÃ§Ã£o CSV de todos os mÃ³dulos
- ExportaÃ§Ã£o PDF (abre janela de impressÃ£o)
- RelatÃ³rio completo multi-mÃ³dulo

### ðŸ“¤ ImportaÃ§Ã£o em Massa
- Upload via drag-and-drop ou clique
- Suporte a CSV e Excel (XLSX)
- PrÃ©-visualizaÃ§Ã£o antes de importar
- Mapeamento automÃ¡tico de colunas
- AtualizaÃ§Ã£o em massa sem duplicatas (upsert por matrÃ­cula)

### âš™ï¸ ConfiguraÃ§Ãµes
- Nome da empresa
- Tema claro/escuro (persistido localmente)
- Teste de conexÃ£o com Supabase
- Logs de auditoria

---

## 5ï¸âƒ£ REALTIME

O sistema usa o Realtime do Supabase para atualizar automaticamente:
- Tabela de colaboradores
- ProgramaÃ§Ãµes
- Dashboard

Qualquer alteraÃ§Ã£o feita em outra aba ou dispositivo reflete automaticamente.

---

## 6ï¸âƒ£ PERSONALIZAÃ‡ÃƒO

### Alterar nome da empresa:
Em `index.html`, linha da sidebar:
```html
<div class="sidebar-logo-text">OpGest</div>
```

### Alterar cores:
Em `style.css`, altere as variÃ¡veis CSS:
```css
--primary: #3b82f6;  /* Cor principal */
--success: #10b981;  /* Verde */
--danger: #ef4444;   /* Vermelho */
```

### Adicionar colunas na tabela:
1. Adicione a coluna na SQL: `ALTER TABLE colaboradores ADD COLUMN nova_coluna TEXT;`
2. Adicione o campo no formulÃ¡rio em `index.html`
3. Adicione a coluna na tabela em `script.js` (funÃ§Ã£o `renderizarTabelaColaboradores`)

---

## 7ï¸âƒ£ TROUBLESHOOTING

**Problema:** Tela branca ao abrir
**SoluÃ§Ã£o:** Abra o console (F12) e veja o erro. Geralmente Ã© CORS ou credenciais do Supabase.

**Problema:** "Erro ao conectar com o banco de dados"
**SoluÃ§Ã£o:** Verifique se o SQL foi executado corretamente e se as Policies estÃ£o habilitadas.

**Problema:** Dados nÃ£o salvam
**SoluÃ§Ã£o:** Verifique se o usuario existe em `usuarios_autorizados`, se o status esta `Ativo` e se o perfil tem permissao para a acao.

**Problema:** ImportaÃ§Ã£o Excel nÃ£o funciona
**SoluÃ§Ã£o:** Salve o arquivo como CSV primeiro. Para suporte a XLSX completo, adicione a biblioteca SheetJS:
```html
<script src="https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js"></script>
```

---

## ðŸ“ž Tecnologias Utilizadas

| Tecnologia | Uso |
|------------|-----|
| HTML5 | Estrutura e modais |
| CSS3 | Estilos, temas, animaÃ§Ãµes |
| JavaScript ES6+ | LÃ³gica do sistema |
| Supabase JS v2 | Banco de dados, RLS, Realtime |
| GitHub Pages | Hospedagem gratuita |
| Google Fonts | Tipografia (DM Sans + JetBrains Mono) |

---

*Sistema desenvolvido para uso pessoal. Dados persistidos no Supabase (PostgreSQL).*

