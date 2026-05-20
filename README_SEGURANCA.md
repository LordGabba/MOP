# Entrega de seguranca

Substitua no repositorio os arquivos:

- `index.html`
- `style.css`
- `script.js`
- `supabase.js`
- `supabase_schema.sql`

Adicione tambem:

- `auth.js`
- `permissions.js`
- `security.js`

## Antes de publicar

1. No Supabase, habilite o provedor Google em **Authentication > Providers > Google**.
2. Em **Authentication > URL Configuration**, cadastre a URL do Netlify em **Site URL** e em **Redirect URLs**.
3. Execute `supabase_schema.sql` no SQL Editor do Supabase.
4. Cadastre pelo SQL Editor o primeiro administrador:

```sql
INSERT INTO usuarios_autorizados (email, nome, perfil, status)
VALUES ('seu-email-google@empresa.com', 'Seu Nome', 'ADMIN', 'Ativo')
ON CONFLICT (email) DO UPDATE
SET nome = EXCLUDED.nome,
    perfil = EXCLUDED.perfil,
    status = EXCLUDED.status;
```

Depois disso, o proprio sistema permite ao ADMIN cadastrar novos usuarios autorizados em **Configuracoes > Usuarios Autorizados**.

## Perfis

- `ADMIN`: acesso total, incluindo usuarios, permissoes, auditoria e configuracoes.
- `GESTOR`: visualiza, cadastra, edita, importa e exporta; nao exclui dados criticos nem gerencia permissoes.
- `CONSULTA`: visualiza e exporta relatorios.
- `AGENTE`: ve somente a propria escala, vinculada pelo e-mail Google ao campo `colaboradores.email`.
- `BLOQUEADO`/`INATIVO`: nao acessa o sistema.

## Observacao importante

O front-end oculta menus e bloqueia chamadas indevidas, mas a seguranca definitiva esta no RLS do Supabase. Mesmo chamadas manuais pelo console ficam limitadas pelas policies.
