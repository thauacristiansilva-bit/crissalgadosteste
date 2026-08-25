# SaborFlow — FASE 25.3.2

## Perfil completo do colaborador + gestão de login

Esta fase completa o ciclo de manutenção da equipe sem reativar o legado.

### O que entra

- botão **Editar** em cada colaborador;
- edição de nome, e-mail, telefone, função e status;
- data de entrada, tipo de vínculo e observações internas;
- função só pode ser alterada por quem possui `access.manage`;
- acesso ao sistema continua separado do perfil operacional;
- gerar/renovar convite, recuperação de senha e revogação permanecem disponíveis;
- e-mail de um login já ativo não é reescrito silenciosamente ao editar o perfil;
- duplicidade de e-mail entre colaboradores da mesma empresa é bloqueada;
- PostgreSQL tenant-aware, sem `store.json` e sem bypass RLS.

### Migration

`database/migrations/026_staff_profile_details.sql`

Ela adiciona somente colunas em `sf_staff_members`:

- `hire_date`
- `employment_type`
- `notes`

A tabela continua com RLS `ENABLE + FORCE`.

### Health

`/api/admin/staff-profile-health`
