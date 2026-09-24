# Operações e Manutenção

Este documento é destinado a pessoas responsáveis pelo desenvolvimento e pela operação do Dietaday em produção. Usuários finais não precisam instalar ou executar o projeto localmente.

## Ambientes

- Produção: [dietaday.com.br](https://dietaday.com.br)
- Frontend: Vercel
- API: Render
- Banco de dados: PostgreSQL gerenciado
- Armazenamento de fotos: Cloudinary

## Deploy

O frontend é publicado a partir da pasta `frontend`. A API é publicada a partir da pasta `backend` usando o `render.yaml` e o Dockerfile do backend.

Antes de publicar:

1. Confirme que os testes do backend e frontend passaram.
2. Confirme que as variáveis de produção estão configuradas no provedor correto.
3. Verifique se migrations novas estão versionadas em `backend/src/main/resources/db/migration`.
4. Publique a API antes do frontend quando houver alteração de contrato.
5. Confirme o health check da API após o deploy.

## Health check

Verifique:

```text
https://nutrivia-api.onrender.com/api/health
```

A resposta esperada contém `status: UP`.

## Requisitos

- Java 17+
- Maven 3.9+
- Node.js 20+
- Docker Desktop

## Executar localmente

1. Abra o Docker Desktop e inicie o PostgreSQL com `docker compose up -d` na raiz do projeto. O banco usa a porta local `5433` para não conflitar com outras instalações do PostgreSQL.
2. Em `backend`, execute `mvn spring-boot:run`.
3. Em `frontend`, copie `.env.example` para `.env`, execute `npm install` e depois `npm run dev`.
4. Abra `http://localhost:5173`.

Sem `VITE_API_URL`, o frontend abre em modo demonstrativo. Com a URL definida, os dados são salvos no PostgreSQL.

## Fotos

Configure uma conta no Cloudinary e use upload assinado pelo backend. No Render, defina `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` e `CLOUDINARY_API_SECRET`.

Sem essas variáveis ainda é possível registrar refeições sem foto.

## Configuração de produção

No Render, configure:

- `DATABASE_URL`
- `DATABASE_USERNAME`
- `DATABASE_PASSWORD`
- `JWT_SECRET`
- `FRONTEND_URL`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

Na Vercel, configure:

- `VITE_API_URL`

O `DATABASE_URL` esperado pelo Spring tem o formato `jdbc:postgresql://host:5432/database?sslmode=require`. Nunca envie arquivos `.env` para o repositório.

## Variáveis de push

Para habilitar os lembretes de água, configure no backend:

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

O endpoint de teste manual deve permanecer desativado em produção:

```text
APP_PUSH_TEST_ENABLED=false
```

## Backfill De Sexo

Depois de aplicar a migration `V9__user_sex.sql` no banco de produção, execute uma vez:

```powershell
psql -h <host> -U <user> -d <database> -f backend/scripts/backfill-user-sex.sql
```

Informe a senha por um mecanismo seguro, como `PGPASSWORD` temporário. O script valida os dois e-mails, atualiza Keven como `MALE` e Allana como `FEMALE`, e pode ser executado novamente sem alterar o resultado.

## Segurança

Gere o segredo JWT no PowerShell com:

```powershell
[Convert]::ToBase64String([byte[]](1..48 | ForEach-Object { Get-Random -Maximum 256 }))
```

O `API Secret` do Cloudinary fica exclusivamente no Render. Nunca coloque credenciais privadas nas variáveis `VITE_*`.

## Verificação

Execute os comandos a partir das respectivas pastas antes de cada release:

```powershell
# backend
mvn test

# frontend
npm test
npm run build
```

## Observabilidade

Os logs privados do Render são a fonte principal para investigar falhas de produção. Eventos importantes incluem:

- `meal_create_started` e `meal_create_completed` para refeições.
- `sync_event` para sincronização offline.
- `sync_error_events` no banco para falhas persistidas de sincronização, incluindo etapa, tentativa, operação e código do erro.
- `water_push_subscription_saved` para inscrições de push.
- `water_reminder_sent` e `water_push_failed` para lembretes.

Eventos de auditoria de segurança usam o formato `security_audit event=...` e incluem somente IDs técnicos, status e tipos fixos de erro:

- `login_success`.
- `login_failure`.
- `login_blocked`.
- `logout`.
- `profile_updated`.
- `diet_created` e `diet_deleted`.
- `ranking_point_event_created` e `ranking_point_event_revoked`.
- `ranking_day_closed` e `ranking_day_close_failed`, incluindo data, quantidade de eventos e duração.
- `ranking_finalized`, incluindo a duração da finalização.
- `member_invitation_created`, `member_invitation_accepted`, `member_invitation_declined`.
- `member_left` e `member_ownership_transferred`.
- `upload_failure`.
- `push_failure`.

Alertas recomendados no provedor de logs:

- Mais de 10 eventos `login_blocked` em 10 minutos.
- Mais de 20 eventos `login_failure` para o mesmo intervalo curto.
- Aumento repentino de `upload_failure`.
- Aumento repentino de `push_failure`.
- Qualquer `ranking_day_close_failed`.
- Fechamentos com duração anormalmente alta ou dias pendentes além do período esperado.
- Qualquer tentativa de log contendo `password`, `token`, `authorization`, `cookie`, `vapid` ou corpo JSON.

O job `security_maintenance event=refresh_tokens_cleanup` remove refresh tokens expirados diariamente às 03:15 no fuso `America/Sao_Paulo`. O número removido é registrado, mas nenhum token é registrado.

Não registre tokens, senhas, chaves VAPID privadas, URLs privadas de fotos ou dados pessoais desnecessários.

## Fechamento competitivo

O fechamento diário executa à meia-noite no fuso `America/Sao_Paulo` e processa todas as datas da dieta até ontem. Isso permite recuperar dias perdidos após indisponibilidade da API. Cada dieta é bloqueada durante a leitura dos eventos, criação do snapshot e liquidação, e a restrição única de `(diet, data, tipo de refeição)` continua protegendo duplicidades.

O fechamento é idempotente: uma data já registrada em `ranking_daily_closures` não é processada novamente. Para reprocessar uma data específica, execute o método operacional `DailyClosingScheduler.closeDate(dietId, eventDate)` por uma tarefa administrativa controlada; ele mantém a mesma transação e não duplica uma closure existente. Nunca altere diretamente eventos ou snapshots em produção.

## Migrations e rollback

As migrations Flyway são aplicadas automaticamente na inicialização do backend e são forward-only. Antes de publicar uma migration, faça backup do PostgreSQL e valide o `mvn test` com o perfil de teste. Não edite ou remova migrations já aplicadas. Em caso de falha, interrompa o deploy, preserve o histórico Flyway e restaure o backup somente conforme o procedimento de recuperação do provedor; a correção do schema deve ser uma nova migration versionada.

As migrations competitivas são `V12` a `V19` e cobrem dietas, eventos, checks, fechamentos, saldos acumulados e finalização. O rollback operacional não desfaz parcialmente pontuação: restaure o banco inteiro para manter eventos, snapshots e pódio consistentes.

## Incidentes

1. Verifique o health check da API.
2. Consulte os logs do Render no intervalo do incidente.
3. Confirme o status da Vercel, Render, PostgreSQL e Cloudinary.
4. Se houver suspeita de credencial exposta, rotacione imediatamente JWT, banco, Cloudinary ou VAPID conforme o segredo afetado.
5. Se houver suspeita de sessão comprometida, invalide os refresh tokens ativos no banco e solicite novo login dos usuários.
6. Não altere migrations já executadas; crie uma nova migration corretiva.
7. Registre a causa, o impacto, os eventos observados e a correção aplicada.
