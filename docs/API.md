# API

A API é consumida pelo frontend hospedado e usa JSON. Os endpoints protegidos exigem:

```http
Authorization: Bearer <jwt>
```

URL de produção: `https://nutrivia-api.onrender.com/api`.

## Autenticação

```text
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET  /profile
PUT  /profile
```

`register` e `login` retornam um access token para uso no header `Authorization`. Eles também criam um refresh token rotativo em cookie `HttpOnly`; o frontend deve enviar `credentials: include` e o header `X-Requested-With: Dietaday` nos endpoints `refresh` e `logout`.

O access token tem validade padrão de 30 minutos. O refresh token fica armazenado somente como hash no backend e é invalidado após cada rotação.

O cadastro exige `sex` com um dos valores `MALE` ou `FEMALE`:

```json
{
  "fullName": "Nome do usuário",
  "email": "usuario@exemplo.com",
  "password": "senha-com-no-minimo-8-caracteres",
  "sex": "FEMALE"
}
```

## Dietas

```text
GET    /diets
POST   /diets
DELETE /diets/{dietId}
POST   /diets/{dietId}/invitations
GET    /invitations
POST   /invitations/{id}/accept
POST   /invitations/{id}/decline
POST   /diets/{dietId}/leave
```

## Refeições

```text
GET    /diets/{dietId}/meals
POST   /diets/{dietId}/meals
GET    /diets/{dietId}/meals/{mealId}
PUT    /diets/{dietId}/meals/{mealId}
DELETE /diets/{dietId}/meals/{mealId}

Comentários e reações usam os recursos abaixo:

```text
GET    /diets/{dietId}/meals/{mealId}/comments
POST   /diets/{dietId}/meals/{mealId}/comments
PUT    /diets/{dietId}/meals/{mealId}/comments/{commentId}
DELETE /diets/{dietId}/meals/{mealId}/comments/{commentId}
PUT    /diets/{dietId}/meals/{mealId}/reaction
DELETE /diets/{dietId}/meals/{mealId}/reaction
```

## Notificações no aplicativo

```text
GET /notifications
GET /notifications/unread-count
PUT /notifications/{id}/read
PUT /notifications/read-all
```
```

O envio de refeições sincronizadas pode incluir `operationId` para garantir idempotência.

## Hidratação

```text
GET  /water/today
PUT  /water/goal
POST /water/checks
```

Os valores de meta e check são enviados em mililitros. Os valores válidos ficam entre `500` e `4000`, em intervalos de `500`.

Exemplo de atualização da meta:

```json
{
  "goalMl": 2000
}
```

Exemplo de check:

```json
{
  "amountMl": 500
}
```

## Push

```text
GET    /push/public-key
POST   /push/subscriptions
DELETE /push/subscriptions?endpoint={endpoint}
```

## Arquivos e telemetria

```text
POST /uploads/signature
POST /telemetry/sync
```

Detalhes internos de credenciais, chaves privadas e infraestrutura não fazem parte do contrato da API e devem permanecer apenas na configuração operacional.
