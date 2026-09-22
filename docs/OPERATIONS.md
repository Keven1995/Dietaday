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
- `water_push_subscription_saved` para inscrições de push.
- `water_reminder_sent` e `water_push_failed` para lembretes.

Não registre tokens, senhas, chaves VAPID privadas, URLs privadas de fotos ou dados pessoais desnecessários.

## Incidentes

1. Verifique o health check da API.
2. Consulte os logs do Render no intervalo do incidente.
3. Confirme o status da Vercel, Render, PostgreSQL e Cloudinary.
4. Não altere migrations já executadas; crie uma nova migration corretiva.
5. Registre a causa, o impacto e a correção aplicada.
