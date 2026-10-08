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
PUT  /profile/water-goal-suggestion
```

`register` e `login` retornam um access token para uso no header `Authorization`. Eles também criam um refresh token rotativo em cookie `HttpOnly`; o frontend deve enviar `credentials: include` e o header `X-Requested-With: Dietaday` nos endpoints `refresh` e `logout`.

O access token tem validade padrão de 30 minutos. O refresh token fica armazenado somente como hash no backend e é invalidado após cada rotação.

O cadastro exige `sex` com um dos valores `MALE` ou `FEMALE` e `birthDate` no formato ISO `YYYY-MM-DD`. A data não pode estar no futuro:

```json
{
  "fullName": "Nome do usuário",
  "email": "usuario@exemplo.com",
  "password": "senha-com-no-minimo-8-caracteres",
  "sex": "FEMALE",
  "birthDate": "1990-04-15"
}
```

As respostas de cadastro, login e renovação de sessão incluem `birthDate` (`YYYY-MM-DD`)
quando disponível. O perfil também informa esse campo. Em contas criadas antes da
inclusão do nascimento, ele permanece sem valor (`null`; a propriedade pode ser omitida
na serialização JSON) até que seja informado.

`PUT /profile` aceita `birthDate` no mesmo formato e rejeita datas futuras. O campo pode
ser omitido ou enviado como `null` sem apagar uma data já salva, permitindo que clientes
anteriores continuem atualizando os demais dados do perfil. Envie uma data válida para
preencher ou atualizar o nascimento.

`GET /profile` inclui `waterGoalSuggestionReview`, com `status` igual a `NOT_REQUIRED`,
`PENDING` ou `RESOLVED` e `suggestedGoalMl` nullable. Contas antigas sem data de nascimento
recebem `status = PENDING` quando informam pela primeira vez uma data válida e há uma
sugestão hídrica disponível; novos cadastros não recebem essa revisão.
Para resolver a decisão, use `PUT /profile/water-goal-suggestion`:

```json
{
  "decision": "APPLY_RECOMMENDATION",
  "dietId": "7b9d6c2f-3e0f-4f55-bf5b-4f3c0e6bc123"
}
```

`decision` aceita `KEEP_CURRENT` ou `APPLY_RECOMMENDATION`; `dietId` é opcional e, quando
enviado, exige membership em uma dieta competitiva ativa. `KEEP_CURRENT` preserva a meta;
`APPLY_RECOMMENDATION` recalcula a sugestão no backend e a aplica à meta atual. Ambos
resolvem a revisão. Repetir uma decisão já resolvida não altera a meta novamente. Fechar
ou adiar o modal no frontend não envia decisão e mantém o estado pendente.

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
GET    /diets/{dietId}/meals/mine/status
GET    /diets/{dietId}/meals/social/status
POST   /diets/{dietId}/meals
GET    /diets/{dietId}/meals/{mealId}
PUT    /diets/{dietId}/meals/{mealId}
DELETE /diets/{dietId}/meals/{mealId}
```

`GET /diets/{dietId}/meals/mine/status` retorna `true` quando o usuário autenticado
tem ao menos uma refeição própria na dieta e `false` quando não tem. A consulta
abrange o histórico completo, sem depender da paginação da listagem, e exige que
o usuário seja membro da dieta.

`GET /diets/{dietId}/meals/social/status` retorna `true` quando o usuário já
comentou ou reagiu a uma refeição de outro membro dessa dieta. O status considera
todo o histórico de interações da dieta e exige que o usuário seja membro.

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

O progresso diário da dieta considera os seis tipos oficiais de refeição
(`Café da manhã`, `Lanche da manhã`, `Almoço`, `Lanche da tarde`, `Jantar` e
`Ceia`). A resposta também informa o streak de dias consecutivos completos:

```text
GET /diets/{dietId}/progress
```

```json
{
  "dietId": "7b9d6c2f-3e0f-4f55-bf5b-4f3c0e6bc123",
  "date": "2026-09-29",
  "dailyGoal": 6,
  "completedMeals": 4,
  "completedMealTypes": ["Café da manhã", "Almoço", "Jantar", "Ceia"],
  "dailyGoalCompleted": false,
  "streakDays": 3
}
```

O envio de refeições sincronizadas pode incluir `operationId` para garantir idempotência.

O `POST /diets/{dietId}/meals` retorna a refeição criada com o campo
`pointsEarned`. Esse valor é calculado pelo backend, vale `0` fora do modo
competitivo e permanece idempotente em novas tentativas com o mesmo
`Idempotency-Key`.

## Hidratação

```text
GET  /water/today
GET  /water/has-checks
GET  /water/history?month=YYYY-MM
PUT  /water/goal
POST /water/checks
```

`GET /water/has-checks` retorna `true` se o usuário autenticado já registrou
algum check de hidratação, em qualquer data ou dieta; `false` significa que
nenhum check histórico foi encontrado.

Para uma dieta competitiva, os checks usam endpoints vinculados à dieta:

```text
GET  /diets/{dietId}/water/today
GET  /diets/{dietId}/water/history?month=YYYY-MM
PUT  /diets/{dietId}/water/goal
POST /diets/{dietId}/water/checks
```

Esses endpoints exigem que o usuário seja membro da dieta. A meta continua sendo do usuário, mas os checks competitivos são associados à dieta. Dietas não competitivas continuam usando os endpoints gerais acima. O histórico competitivo também valida que a dieta seja competitiva e permite consulta após o encerramento, enquanto o usuário mantiver membership.

Metas e checks são enviados em mililitros e têm validações distintas. Metas válidas vão de
`2000` a `4000`, em intervalos de `50` (por exemplo, `2450`). Checks válidos vão de
`500` a `4000`, em intervalos de `500`. Como exceção, um check final entre `1` e `499` é
aceito somente quando seu valor é exatamente o restante positivo da meta e esse restante
é inferior a `500`; o backend rejeita valores arbitrários abaixo de `500`. Na migração,
metas já salvas abaixo de `2000` são ajustadas para `2000`; checks existentes não são
alterados.

As respostas de `/water/today` e `/diets/{dietId}/water/today` incluem
`suggestedGoalMl`, nullable. A sugestão é calculada como `35 mL × peso em kg`, arredondada
ao múltiplo de `50 mL` mais próximo (empates para cima), apenas para adultos com peso e
data de nascimento disponíveis. Só é retornada quando fica entre `2000` e `4000` mL;
menores de idade, dados ausentes ou resultados fora desse intervalo recebem `null`.
`goalMl` continua representando a meta atual escolhida e não é substituída pela sugestão.

A meta efetiva de cada dia é salva por usuário e escopo (geral ou dieta) no primeiro check
ou quando a meta é alterada. Uma alteração atualiza apenas o snapshot da data e do escopo
atuais; snapshots anteriores permanecem imutáveis. Checks legados sem snapshot não recebem
uma meta histórica inferida. Se checks do dia atual já existirem antes de seu primeiro
snapshot, a meta desse dia permanece indisponível em vez de ser atribuída retroativamente.

Os endpoints de histórico usam o usuário autenticado e agregam checks junto aos snapshots do
escopo solicitado, sem misturar registros gerais e competitivos. `month` deve estar no
formato `YYYY-MM`; formatos ou meses inválidos retornam `400`. A resposta inclui apenas dias
com checks ou snapshot (o cliente completa os dias vazios do calendário):

```json
{
  "month": "2026-10",
  "days": [
    {"date": "2026-10-01", "consumedMl": 1500, "goalMl": 2000, "percentage": 75, "hasRecords": true},
    {"date": "2026-10-02", "consumedMl": 500, "goalMl": null, "percentage": null, "hasRecords": true},
    {"date": "2026-10-03", "consumedMl": 0, "goalMl": 2450, "percentage": null, "hasRecords": false}
  ]
}
```

`percentage` é `null` quando não há checks ou uma meta histórica comprovada; com ambos,
é arredondado para inteiro e limitado a `100`. Um dia sem checks não é apresentado como
`0%` confirmado. Datas sem checks e sem snapshot não aparecem na resposta.

As respostas de registro de check incluem `pointsEarned`, calculado pelo
backend. O campo vale `0` para hidratação não competitiva e contém o delta
confirmado quando o check gera um evento competitivo.

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

Para completar uma meta de `2450` mL após consumir `2000` mL, o check final pode ser
`{"amountMl":450}`. Esse valor abaixo de `500` só é aceito quando é exatamente o saldo
positivo restante; outras quantidades menores são rejeitadas.

## Ranking competitivo

O contrato abaixo é o contrato do módulo competitivo para ranking ao vivo e fechamento. O ranking só está disponível para dietas competitivas e exige membership:

```text
GET /diets/{dietId}/ranking?page=0&size=20
GET /diets/{dietId}/ranking/me
GET /diets/{dietId}/ranking/activity
```

Enquanto a dieta está ativa, `officialPoints` e `position` incluem imediatamente os eventos pendentes não revogados. O fechamento diário consolida esses eventos em `ranking_scores`, sem alterar o resultado exibido nem duplicar pontos. `pendingPoints` indica a parcela ainda não consolidada. A resposta canônica contém o período da dieta, o status do ranking, a data do último fechamento, o usuário atual, os participantes e a paginação. O endpoint `/ranking/me` aceita os mesmos parâmetros `page` e `size`:

`/ranking/activity` exige membership e retorna a pontuação mais recente registrada por outro participante. O frontend consulta esse recurso periodicamente para destacar o acesso ao ranking até que o usuário clique no ícone. O autor da própria pontuação não recebe essa notificação.

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

O detalhamento do usuário atual separa eventos elegíveis desde o último fechamento. Esses valores já aparecem na pontuação ao vivo e aguardam apenas a consolidação diária:

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
POST /telemetry/ux
```

Falhas de sincronização informadas por esse endpoint são persistidas internamente em `sync_error_events` para diagnóstico operacional. Essa tabela não é exposta ao usuário final. O corpo inclui `operationId`, `dietId`, `phase`, `attempt`, `durationMs`, `httpStatus`, `errorType`, `fileType` e `fileSizeBytes`.

Eventos de UX confirmados pelo frontend são enviados autenticados para `/telemetry/ux` e persistidos internamente em `ux_events`; a identidade vem do token e nunca do payload. `dietId` é obrigatório para eventos de domínio existentes e pode ser nulo ou omitido nos eventos de descoberta e de formulário, quando não houver dieta ativa. O `eventId` é idempotente por usuário; a telemetria não participa do fluxo da ação principal.

Nomes aceitos: `meal_created`, `water_logged`, `daily_goal_completed`, `hydration_goal_completed`, `reaction_created`, `ranking_position_changed`, `streak_incremented`, `feature_hint_viewed`, `feature_hint_clicked`, `feature_hint_dismissed`, `feature_adopted`, `meal_form_started` e `meal_saved_locally`.

Eventos `feature_hint_*` e `feature_adopted` exigem em `details` `campaign`, `version`, `page` e `exposureId`. `meal_form_started` e `meal_saved_locally` exigem `formSessionId` efêmero compartilhado pelo par. Nesses eventos o backend aceita apenas as propriedades previstas pelo contrato; não envie e-mail, conteúdo/fotos de refeições ou dados corporais.

Detalhes internos de credenciais, chaves privadas e infraestrutura não fazem parte do contrato da API e devem permanecer apenas na configuração operacional.
