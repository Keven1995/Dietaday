# Dietaday

PWA para registrar dietas e refeições com amigos. O projeto usa React com TypeScript no frontend, Spring Boot no backend e PostgreSQL.

## Requisitos

- Java 17+
- Maven 3.9+
- Node.js 20+
- Docker Desktop

## Executar localmente

1. Abra o Docker Desktop e inicie o PostgreSQL com `docker compose up -d` na raiz do projeto. O banco do projeto usa a porta local `5433` para não conflitar com outras instalações do PostgreSQL.
2. Em `backend`, execute `mvn spring-boot:run`.
3. Em `frontend`, copie `.env.example` para `.env` e execute `npm install` e `npm run dev`.
4. Abra `http://localhost:5173`.

Sem `VITE_API_URL`, o frontend abre em modo demonstrativo. Com a URL definida, os dados são salvos no PostgreSQL.

## Fotos

Configure uma conta no Cloudinary e use upload assinado pelo backend. No Render, defina `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` e `CLOUDINARY_API_SECRET`.

Sem essas variáveis ainda é possível registrar refeições sem foto.

## Hospedagem gratuita

1. Envie este projeto para um repositório privado ou público no GitHub.
2. Crie um projeto PostgreSQL gratuito no Neon e copie host, database, usuário e senha.
3. No Render, crie um Blueprint usando o `render.yaml` ou um Web Service Docker com raiz `backend`.
4. Configure no Render `DATABASE_URL`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`, `JWT_SECRET`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` e, provisoriamente, `FRONTEND_URL=http://localhost:5173`.
5. Depois da publicação, confirme `https://sua-api.onrender.com/api/health`.
6. Na Vercel, importe o mesmo repositório, defina `frontend` como Root Directory e adicione a variável `VITE_API_URL`.
7. Após a Vercel fornecer a URL final, substitua `FRONTEND_URL` no Render por essa URL e faça novo deploy da API. Para uma migração entre domínios, separe temporariamente as origens permitidas por vírgula, por exemplo `FRONTEND_URL=https://dietaday.vercel.app,https://dietaday.com.br`.

O `DATABASE_URL` esperado pelo Spring tem o formato `jdbc:postgresql://host:5432/database?sslmode=require`. Não envie arquivos `.env` para o GitHub.

Gere o segredo JWT no PowerShell com:

```powershell
[Convert]::ToBase64String([byte[]](1..48 | ForEach-Object { Get-Random -Maximum 256 }))
```

No Cloudinary, o `API Secret` fica exclusivamente no Render; nunca coloque credenciais do Cloudinary nas variáveis `VITE_*`.

## Verificação

Execute `mvn test` em `backend`. Em `frontend`, execute `npm test` e `npm run build`.
