# OpGest — Sistema de Gestão Operacional
## Instruções Completas de Deploy

---

## 📁 Estrutura de Arquivos

```
opgest/
├── index.html       → Página principal + modais
├── style.css        → Estilos completos (tema claro/escuro)
├── script.js        → Lógica do sistema
├── supabase.js      → Conexão e operações com o banco
└── supabase_schema.sql → SQL para criar as tabelas
```

---

## 1️⃣ CONFIGURAR O SUPABASE

### 1.1 Criar as Tabelas
1. Acesse https://app.supabase.com
2. Selecione seu projeto
3. Vá em **SQL Editor** → **New Query**
4. Cole o conteúdo completo de `supabase_schema.sql`
5. Clique em **Run**

### 1.2 Verificar as Tabelas
Após executar o SQL, em **Table Editor** você deve ver:
- `colaboradores`
- `staff`
- `escalas`
- `programacoes`
- `auditoria`
- `usuarios`
- `configuracoes`

### 1.3 Verificar Policies (RLS)
Em **Authentication → Policies**, confirme que todas as tabelas têm a policy `allow_all_*` habilitada para role `anon`.

---

## 2️⃣ DEPLOY NO GITHUB PAGES

### 2.1 Criar o Repositório
1. Acesse https://github.com → **New repository**
2. Nome: `opgest` (ou o nome que preferir)
3. Visibilidade: **Public** (necessário para GitHub Pages gratuito)
4. Clique em **Create repository**

### 2.2 Fazer Upload dos Arquivos
**Opção A — Via Interface Web:**
1. No repositório criado, clique em **Add file → Upload files**
2. Arraste os 4 arquivos: `index.html`, `style.css`, `script.js`, `supabase.js`
3. Clique em **Commit changes**

**Opção B — Via Git (linha de comando):**
```bash
git clone https://github.com/SEU_USUARIO/opgest.git
cd opgest
# Copie os arquivos para esta pasta
git add .
git commit -m "Sistema OpGest - deploy inicial"
git push origin main
```

### 2.3 Ativar GitHub Pages
1. No repositório, vá em **Settings → Pages**
2. Em **Source**, selecione:
   - Branch: `main`
   - Folder: `/ (root)`
3. Clique em **Save**
4. Aguarde 2-5 minutos
5. O sistema estará disponível em: `https://SEU_USUARIO.github.io/opgest/`

---

## 3️⃣ VERIFICAR O SISTEMA

### Checklist pós-deploy:
- [ ] A página carrega sem erros no console (F12)
- [ ] O loader some após alguns segundos
- [ ] O Dashboard exibe os cards de estatísticas
- [ ] É possível cadastrar um colaborador de teste
- [ ] O toast de sucesso aparece ao salvar
- [ ] Os dados aparecem na tabela

---

## 4️⃣ FUNCIONALIDADES DO SISTEMA

### 📊 Dashboard
- Totais em tempo real: colaboradores, ativos, férias, day off
- Programações pendentes
- Lista de colaboradores ativos
- Gráfico de distribuição por célula

### 👥 Colaboradores
- Cadastro completo (30+ campos)
- Validação automática de CPF
- Cálculo automático de idade e tempo de empresa
- Filtros por status, célula, grupo, filial
- Busca instantânea
- Paginação
- Seleção múltipla para exclusão em lote
- Exportação CSV e PDF
- Edição inline via modal

### 👔 Staff / Liderança
- Mesma estrutura de colaboradores
- Campos extras: nível hierárquico, tipo de liderança, equipe responsável, quantidade de colaboradores

### 📅 Escalas
- Calendário visual mensal
- Clique em qualquer dia para ver/adicionar escalas
- Tipos: Normal, Férias, Day Off, Folga, Treinamento, Home Office, Licença, Hora Extra
- Identificação visual por cores

### 📋 Programações
- Registros de férias, treinamentos, HO, licenças, trocas, ausências
- Programações recorrentes
- Fluxo de aprovação (Pendente → Aprovado)
- Filtros por tipo e status

### 🏖️ Férias
- Visão consolidada de todos colaboradores com férias programadas
- Cálculo automático de dias de férias
- Exportação

### 📈 Relatórios
- Exportação CSV de todos os módulos
- Exportação PDF (abre janela de impressão)
- Relatório completo multi-módulo

### 📤 Importação em Massa
- Upload via drag-and-drop ou clique
- Suporte a CSV e Excel (XLSX)
- Pré-visualização antes de importar
- Mapeamento automático de colunas
- Atualização em massa sem duplicatas (upsert por matrícula)

### ⚙️ Configurações
- Nome da empresa
- Tema claro/escuro (persistido localmente)
- Teste de conexão com Supabase
- Logs de auditoria

---

## 5️⃣ REALTIME

O sistema usa o Realtime do Supabase para atualizar automaticamente:
- Tabela de colaboradores
- Programações
- Dashboard

Qualquer alteração feita em outra aba ou dispositivo reflete automaticamente.

---

## 6️⃣ PERSONALIZAÇÃO

### Alterar nome da empresa:
Em `index.html`, linha da sidebar:
```html
<div class="sidebar-logo-text">OpGest</div>
```

### Alterar cores:
Em `style.css`, altere as variáveis CSS:
```css
--primary: #3b82f6;  /* Cor principal */
--success: #10b981;  /* Verde */
--danger: #ef4444;   /* Vermelho */
```

### Adicionar colunas na tabela:
1. Adicione a coluna na SQL: `ALTER TABLE colaboradores ADD COLUMN nova_coluna TEXT;`
2. Adicione o campo no formulário em `index.html`
3. Adicione a coluna na tabela em `script.js` (função `renderizarTabelaColaboradores`)

---

## 7️⃣ TROUBLESHOOTING

**Problema:** Tela branca ao abrir
**Solução:** Abra o console (F12) e veja o erro. Geralmente é CORS ou credenciais do Supabase.

**Problema:** "Erro ao conectar com o banco de dados"
**Solução:** Verifique se o SQL foi executado corretamente e se as Policies estão habilitadas.

**Problema:** Dados não salvam
**Solução:** Verifique no Supabase em Authentication → Policies se as policies `allow_all_*` existem para a tabela.

**Problema:** Importação Excel não funciona
**Solução:** Salve o arquivo como CSV primeiro. Para suporte a XLSX completo, adicione a biblioteca SheetJS:
```html
<script src="https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js"></script>
```

---

## 📞 Tecnologias Utilizadas

| Tecnologia | Uso |
|------------|-----|
| HTML5 | Estrutura e modais |
| CSS3 | Estilos, temas, animações |
| JavaScript ES6+ | Lógica do sistema |
| Supabase JS v2 | Banco de dados, RLS, Realtime |
| GitHub Pages | Hospedagem gratuita |
| Google Fonts | Tipografia (DM Sans + JetBrains Mono) |

---

*Sistema desenvolvido para uso pessoal. Dados persistidos no Supabase (PostgreSQL).*
