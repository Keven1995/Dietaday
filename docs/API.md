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
PUT    /diets/{dietId}
DELETE /diets/{dietId}
POST   /diets/{dietId}/invitations
GET    /invitations
POST   /invitations/{id}/accept
POST   /invitations/{id}/decline
POST   /diets/{dietId}/leave
```

Uma resposta de dieta inclui `competitiveMode`:

```json
{
  "id": "7b9d6c2f-3e0f-4f55-bf5b-4f3c0e6bc123",
  "name": "Desafio de setembro",
  "startDate": "2026-09-01",
  "endDate": "2026-09-30",
  "competitiveMode": true
}
```

`competitiveMode` só é definido na criação. Tentativas de alterá-lo depois retornam conflito.

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

Para uma dieta competitiva, os checks usam endpoints vinculados à dieta:

```text
GET  /diets/{dietId}/water/today
PUT  /diets/{dietId}/water/goal
POST /diets/{dietId}/water/checks
```

Esses endpoints exigem que o usuário seja membro da dieta. A meta continua sendo do usuário, mas os checks competitivos são associados à dieta. Dietas não competitivas continuam usando os endpoints gerais acima.

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

## Ranking competitivo

O contrato abaixo é o contrato-alvo do módulo competitivo para as fases de fechamento e ranking oficial. O ranking só está disponível para dietas competitivas e exige membership:

```text
GET /diets/{dietId}/ranking?page=0&size=20
GET /diets/{dietId}/ranking/me
```

O ranking oficial é atualizado pelo fechamento diário. `officialPoints` e `position` não incluem eventos pendentes. A resposta canônica contém o período da dieta, o status do ranking, a data do último fechamento, o usuário atual, os participantes e a paginação. O endpoint `/ranking/me` aceita os mesmos parâmetros `page` e `size`:

```json
{
  "dietId": "7b9d6c2f-3e0f-4f55-bf5b-4f3c0e6bc123",
  "status": "ACTIVE",
  "startDate": "2026-09-01",
  "endDate": "2026-09-30",
  "lastClosedDate": "2026-09-23",
  "currentUser": {
    "userId": "0b5c4aa2-11d2-4e4a-b7a6-1f78fcb9f321",
    "position": 2,
    "officialPoints": 37,
    "pendingPoints": 5
  },
  "participants": [
    {
      "position": 1,
      "userId": "f1b1b4c0-674c-4b72-8c20-f41dc1a8ec2",
      "displayName": "Ana Silva",
      "officialPoints": 42,
      "activeDays": 8,
      "firstReachedAt": "2026-09-08T23:59:00-03:00"
    }
  ],
  "page": {
    "number": 0,
    "size": 20,
    "totalElements": 3,
    "totalPages": 1
  }
}
```

### Pontos pendentes

O detalhamento do usuário atual separa eventos elegíveis desde o último fechamento. Esses valores não alteram a posição oficial:

```json
{
  "userId": "0b5c4aa2-11d2-4e4a-b7a6-1f78fcb9f321",
  "pendingPoints": 5,
  "mealCountByType": {
    "CAFE_DA_MANHA": 1,
    "ALMOCO": 0,
    "JANTAR": 0
  },
  "eligibleWaterChecks": 1,
  "events": [
    {
      "sourceType": "MEAL",
      "eventDate": "2026-09-24",
      "points": 5,
      "status": "PENDING"
    }
  ]
}
```

### Ranking finalizado

Depois do encerramento, o status passa para `FINALIZED`. O ranking permanece disponível, mas novos eventos e alterações competitivas são rejeitados. O contrato inclui o pódio final:

```json
{
  "status": "FINALIZED",
  "podium": {
    "first": "f1b1b4c0-674c-4b72-8c20-f41dc1a8ec2",
    "second": "0b5c4aa2-11d2-4e4a-b7a6-1f78fcb9f321",
    "third": "2a3d8d44-3b2e-4c01-a4c7-7e8e1b2d4f90"
  }
}
```

`finalizedAt` é persistido internamente para auditoria operacional, mas não faz parte da resposta atual do ranking.

O desempate oficial segue esta ordem: pontos acumulados, dias ativos, primeiro alcance da pontuação e ordem inicial persistida para empates em zero.

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
